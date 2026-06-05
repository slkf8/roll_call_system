"""Maintenance-only database rollback core for the Roll Call backend.

This module powers the repair CLI (``roll_call_backend list|validate|restore|
history``). It is **not** a user-facing feature and has no HTTP surface; it is
meant to be run from a Terminal with the app stopped.

Design / safety (see RC8-A1 plan):

* Only bare basenames inside ``data/backups/`` are accepted. Path separators,
  ``..``, absolute paths, sub-directories, non-``.db`` and ``.tmp`` names are
  rejected before any filesystem access.
* Every database touched is validated with ``PRAGMA integrity_check`` plus a
  required-schema check before it is trusted.
* ``restore`` refuses to run while the service is up (health probe + a short
  SQLite write-lock probe). It never kills a process.
* ``restore`` first snapshots the live ``app.db`` to a timestamped emergency
  backup, copies the chosen backup to a temp file, validates it, then
  ``os.replace`` swaps it into place and validates the result. On post-replace
  validation failure it rolls back from the emergency backup. ``app.db`` is
  never bit-overwritten in place and never left missing.
* Every restore attempt that reaches the replace stage is appended to
  ``data/restore_history.jsonl``.

The copy primitive (:func:`backup_service._online_backup`), path helpers and
filename constants are reused from :mod:`app.services.backup_service` rather
than re-implemented.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import urllib.request
from datetime import datetime
from pathlib import Path

from app.config import data_dir_fingerprint, get_data_dir, get_host, get_port
from app.services import backup_service as bs
from app.services.app_lock import AppLock

logger = logging.getLogger("rollcall.restore")

# ---------------------------------------------------------------------------
# Constants (reuse backup_service vocabulary where it already exists)
# ---------------------------------------------------------------------------

PRIMARY_DB_NAME = bs.PRIMARY_DB_NAME          # "app.db"
LATEST_DB_NAME = bs.LATEST_DB_NAME            # "app_latest.db"
_DAILY_RE = bs._DAILY_RE                      # app_YYYY-MM-DD.db

# app_before_restore_YYYY-MM-DD_HHMMSS.db  (+ optional _N de-dup suffix)
EMERGENCY_RE = re.compile(
    r"^app_before_restore_\d{4}-\d{2}-\d{2}_\d{6}(?:_\d+)?\.db$"
)

HISTORY_FILENAME = "restore_history.jsonl"

# Core tables every real app.db must expose. Used as a schema-sanity gate on
# top of integrity_check so a structurally-valid but wrong-shaped file is not
# trusted as a restore source.
EXPECTED_TABLES = frozenset(
    {"students", "student_schedule_rules", "sessions", "global_events"}
)

# Short probes: long enough to be reliable, short enough not to hang the CLI.
_HEALTH_TIMEOUT_SECONDS = 0.75
_LOCK_TIMEOUT_SECONDS = 0.3


class RestoreError(Exception):
    """Raised for any refusal or failure in the restore workflow."""


class RestoreRollbackError(RestoreError):
    """Raised when restore validation failed and a rollback was attempted.

    Carries the emergency backup name and the rollback outcome so the CLI can
    emit an appropriately urgent message (a clean rollback vs a rollback that
    itself failed and needs manual intervention).
    """

    def __init__(self, message: str, *, emergency: str | None, rollback_result: str):
        super().__init__(message)
        self.emergency = emergency
        self.rollback_result = rollback_result


# ``data_dir_fingerprint`` is the shared helper from app.config (re-exported
# here for callers/tests that reference it via this module).


# ---------------------------------------------------------------------------
# Path resolution / filename safety
# ---------------------------------------------------------------------------

def _resolve_data_dir(data_dir: Path | str | None) -> Path:
    if data_dir is not None:
        path = Path(data_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path
    return get_data_dir()


def _classify(name: str) -> str | None:
    """Return the backup kind for a legal backup file name, else None."""
    if name == LATEST_DB_NAME:
        return "latest"
    if _DAILY_RE.match(name):
        return "daily"
    if EMERGENCY_RE.match(name):
        return "emergency"
    return None


def _resolve_backup_path(data_dir: Path, filename: str) -> Path:
    """Validate ``filename`` and resolve it inside ``data/backups/``.

    Raises :class:`RestoreError` on any illegal name, unknown pattern, escape
    attempt, or missing file.
    """
    if not filename or not isinstance(filename, str):
        raise RestoreError("backup filename is required")
    if filename in (".", ".."):
        raise RestoreError(f"illegal backup filename: {filename!r}")
    if "/" in filename or "\\" in filename:
        raise RestoreError(
            f"backup filename must be a bare name (no path separators): {filename!r}"
        )
    if os.path.isabs(filename):
        raise RestoreError(f"absolute paths are not allowed: {filename!r}")
    if filename != os.path.basename(filename):
        raise RestoreError(f"illegal backup filename: {filename!r}")
    if not filename.endswith(".db"):
        raise RestoreError(f"only .db backups are allowed: {filename!r}")
    if _classify(filename) is None:
        raise RestoreError(f"unrecognized backup name: {filename!r}")

    backups_dir = bs._backups_dir(data_dir)
    candidate = backups_dir / filename
    # Defense in depth: the resolved parent must be exactly the backups dir.
    if candidate.resolve().parent != backups_dir.resolve():
        raise RestoreError(f"resolved path escapes backups dir: {filename!r}")
    if not candidate.is_file():
        raise RestoreError(f"backup not found: {filename!r}")
    return candidate


# ---------------------------------------------------------------------------
# SQLite validation
# ---------------------------------------------------------------------------

def _validate_db_file(path: Path) -> None:
    """Raise :class:`RestoreError` unless ``path`` is a sound app database.

    Checks ``PRAGMA integrity_check == ok`` and that the required core tables
    are present. Opens the file read-only so validation never mutates it.
    """
    if not path.is_file():
        raise RestoreError(f"not a file: {path}")
    try:
        uri = path.resolve().as_uri() + "?mode=ro"
        con = sqlite3.connect(uri, uri=True)
    except sqlite3.Error as exc:
        raise RestoreError(f"cannot open SQLite database {path.name}: {exc}") from exc
    try:
        try:
            rows = con.execute("PRAGMA integrity_check").fetchall()
        except sqlite3.DatabaseError as exc:
            raise RestoreError(
                f"not a valid SQLite database: {path.name}: {exc}"
            ) from exc
        result = rows[0][0] if rows else ""
        if result != "ok":
            raise RestoreError(f"integrity_check failed for {path.name}: {result}")
        try:
            names = {
                r[0]
                for r in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
        except sqlite3.DatabaseError as exc:
            raise RestoreError(
                f"cannot read schema from {path.name}: {exc}"
            ) from exc
        missing = EXPECTED_TABLES - names
        if missing:
            raise RestoreError(
                f"missing required tables in {path.name}: {sorted(missing)}"
            )
    finally:
        con.close()


def _verify_restored_primary(primary: Path) -> None:
    """Post-replace validation seam (separate name so tests can force failure)."""
    _validate_db_file(primary)


# ---------------------------------------------------------------------------
# Running-app detection (never kills a process)
# ---------------------------------------------------------------------------

_FINGERPRINT_RE = re.compile(r"^[0-9a-f]{16}$")


def _is_valid_fingerprint(value: object) -> bool:
    """True only for a well-formed 16-char lowercase-hex fingerprint string."""
    return isinstance(value, str) and _FINGERPRINT_RE.fullmatch(value) is not None


def _service_health_running(data_dir: Path) -> bool:
    """True if /health indicates restore must be blocked for this data dir.

    Blocks when the responder is a RollCall instance that either (a) serves the
    same data directory (fingerprint match), or (b) is an older / unidentifiable
    instance predating the fingerprint (legacy ``{"ok": true}``) — the latter is
    refused conservatively because such versions also lack the lifecycle lock.

    Does NOT block (advisory only) for: a different data dir, a non-RollCall 200
    response, a non-200 status, unparseable JSON, or a connection failure. The
    lifecycle lock and SQLite exclusive-lock probe remain the authoritative
    same-dir gates.
    """
    target_fingerprint = data_dir_fingerprint(data_dir)
    try:
        host = get_host()
        if host in ("0.0.0.0", "::"):
            host = "127.0.0.1"
        port = get_port()
    except Exception:
        return False  # misconfigured env -> rely on the lock probe instead
    url = f"http://{host}:{port}/health"
    try:
        with urllib.request.urlopen(url, timeout=_HEALTH_TIMEOUT_SECONDS) as resp:
            status = getattr(resp, "status", None)
            if status is None:
                status = resp.getcode()
            if status != 200:
                return False
            try:
                payload = json.loads(resp.read().decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return False  # not JSON -> cannot identify -> advisory
            if not isinstance(payload, dict) or payload.get("ok") is not True:
                return False  # not a RollCall health response -> advisory
            fingerprint = payload.get("dataDirFingerprint")
            if not _is_valid_fingerprint(fingerprint):
                # Missing / null / non-string / empty / wrong-length / non-hex:
                # legacy or unidentifiable instance whose data dir cannot be
                # confirmed -> refuse conservatively (such versions also predate
                # the lifecycle lock).
                logger.warning(
                    "health responder has no usable dataDirFingerprint "
                    "(legacy/unidentifiable); blocking restore conservatively"
                )
                return True
            return fingerprint == target_fingerprint
    except Exception:
        return False


def _db_write_locked(primary: Path) -> bool:
    """True if a write (EXCLUSIVE) lock on ``app.db`` cannot be acquired."""
    if not primary.is_file():
        return False
    try:
        con = sqlite3.connect(str(primary), timeout=_LOCK_TIMEOUT_SECONDS)
    except sqlite3.Error:
        return False
    try:
        con.execute(f"PRAGMA busy_timeout={int(_LOCK_TIMEOUT_SECONDS * 1000)}")
        try:
            con.execute("BEGIN EXCLUSIVE")
            con.execute("ROLLBACK")
            return False
        except sqlite3.OperationalError:
            return True  # locked -> service likely active
        except sqlite3.DatabaseError:
            return False  # not a usable db -> not a "locked" condition
    finally:
        con.close()


def _ensure_app_not_running(data_dir: Path) -> None:
    if _service_health_running(data_dir):
        raise RestoreError(
            "restore refused by health check: a RollCall instance is responding "
            "for this data directory, or an older / unidentifiable instance could "
            "not be confirmed safe (stop that instance and retry). "
            "Do not kill any process."
        )
    if _db_write_locked(bs._primary_db(data_dir)):
        raise RestoreError(
            "app.db is write-locked (the service may be running); "
            "stop it before restoring."
        )


# ---------------------------------------------------------------------------
# Copy / emergency backup / rollback primitives
# ---------------------------------------------------------------------------

def _safe_unlink(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except Exception:
        logger.exception("failed to unlink %s", path)


def _copy_db(src: Path, dst_tmp: Path) -> None:
    """Copy ``src`` to ``dst_tmp`` via the online-backup API (validates source)."""
    _safe_unlink(dst_tmp)
    try:
        bs._online_backup(src, dst_tmp)
    except Exception as exc:
        _safe_unlink(dst_tmp)
        raise RestoreError(f"failed to copy database from {src.name}: {exc}") from exc


def _create_emergency_backup(data_dir: Path, *, now: datetime) -> str:
    """Snapshot the live ``app.db`` to a unique, validated emergency backup."""
    primary = bs._primary_db(data_dir)
    backups_dir = bs._backups_dir(data_dir)
    backups_dir.mkdir(parents=True, exist_ok=True)

    base = f"app_before_restore_{now:%Y-%m-%d_%H%M%S}"
    final = backups_dir / f"{base}.db"
    counter = 2
    while final.exists():
        final = backups_dir / f"{base}_{counter}.db"
        counter += 1

    tmp = backups_dir / (final.name + ".tmp")
    _copy_db(primary, tmp)
    try:
        _validate_db_file(tmp)
    except RestoreError as exc:
        _safe_unlink(tmp)
        raise RestoreError(
            f"emergency backup failed validation; aborting restore: {exc}"
        ) from exc
    os.replace(tmp, final)
    _validate_db_file(final)
    return final.name


def _rollback(data_dir: Path, emergency_name: str | None) -> str:
    """Restore ``app.db`` from the emergency backup. Returns a status string."""
    if not emergency_name:
        return "no_emergency_backup"
    primary = bs._primary_db(data_dir)
    emergency = bs._backups_dir(data_dir) / emergency_name
    rb_tmp = data_dir / (PRIMARY_DB_NAME + ".rollback.tmp")
    try:
        _copy_db(emergency, rb_tmp)
        _validate_db_file(rb_tmp)
        os.replace(rb_tmp, primary)
        _validate_db_file(primary)
        return "success"
    except Exception:
        logger.exception("rollback failed for emergency backup %s", emergency_name)
        _safe_unlink(rb_tmp)
        return "failed"


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

def _append_history(data_dir: Path, entry: dict) -> bool:
    """Append one history record. Returns False (never raises) on write failure.

    History is best-effort: a logging failure must never undo a completed DB
    restore, so callers treat a False return as a soft warning only.
    """
    path = data_dir / HISTORY_FILENAME
    try:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return True
    except Exception:
        logger.exception("failed to append restore history")
        return False


def read_history(*, data_dir: Path | str | None = None) -> list[dict]:
    """Return restore-history records (oldest first); tolerant of bad lines."""
    data_dir = _resolve_data_dir(data_dir)
    path = data_dir / HISTORY_FILENAME
    if not path.is_file():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _history_entry(
    *, source: str, emergency: str | None, result: str,
    error: str | None = None, rollback_result: str | None = None,
) -> dict:
    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "source": source,
        "emergency": emergency,
        "result": result,
        "error": error,
        "rollback_result": rollback_result,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_backups(*, data_dir: Path | str | None = None) -> list[dict]:
    """List legal backups in ``data/backups/`` (latest / daily / emergency)."""
    data_dir = _resolve_data_dir(data_dir)
    backups_dir = bs._backups_dir(data_dir)
    if not backups_dir.is_dir():
        return []
    out: list[dict] = []
    for entry in sorted(backups_dir.iterdir()):
        if not entry.is_file():
            continue
        kind = _classify(entry.name)
        if kind is None:
            continue  # skip .tmp, history, unknown files
        stat = entry.stat()
        out.append(
            {
                "filename": entry.name,
                "kind": kind,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
            }
        )
    return out


def validate_backup(filename: str, *, data_dir: Path | str | None = None) -> dict:
    """Validate a single backup. Returns info dict; raises RestoreError if bad."""
    data_dir = _resolve_data_dir(data_dir)
    path = _resolve_backup_path(data_dir, filename)
    _validate_db_file(path)
    return {"filename": filename, "ok": True, "size": path.stat().st_size}


def restore_backup(
    filename: str,
    *,
    data_dir: Path | str | None = None,
    now: datetime | None = None,
    check_running: bool = True,
) -> dict:
    """Atomically restore ``app.db`` from a validated backup.

    Flow: filename safety -> acquire lifecycle lock -> validate source -> ensure
    app stopped -> emergency backup -> copy to temp -> validate temp ->
    os.replace -> verify new app.db; on verify failure, roll back from the
    emergency backup. The lifecycle lock is held through the whole restore /
    rollback and released in a ``finally``. Records every attempt that reaches
    the replace stage in the history log.

    Returns a result dict on success (including ``history_written``). Raises
    :class:`RestoreRollbackError` when restore validation failed (after a
    rollback attempt), or :class:`RestoreError` on any other refusal/failure.

    The port-independent lifecycle lock is the primary gate and is always
    attempted (never skipped by an env flag); the /health probe and SQLite
    exclusive-lock checks remain as defence in depth.
    """
    data_dir = _resolve_data_dir(data_dir)
    primary = bs._primary_db(data_dir)

    # 1. Validate the filename / resolve it inside data/backups/.
    src = _resolve_backup_path(data_dir, filename)

    # 2. Acquire and hold the lifecycle lock for the whole restore (primary
    #    gate). If another process holds it, the backend is up or another
    #    restore is in progress -> refuse. Never kill a process.
    lock = AppLock(data_dir)
    if not lock.acquire():
        raise RestoreError(
            "could not acquire the application lock "
            f"({data_dir / 'app.lock'}); the backend may be running or another "
            "restore is in progress. Stop the app and retry. Do not kill any "
            "process."
        )

    try:
        # 3. Validate the source backup content.
        _validate_db_file(src)

        # 4. Defence in depth: refuse if the service still looks alive.
        if check_running:
            _ensure_app_not_running(data_dir)

        now = now or datetime.now()

        # 5. Emergency backup of the current primary (if one exists).
        emergency_name: str | None = None
        if primary.is_file():
            emergency_name = _create_emergency_backup(data_dir, now=now)

        # 6. Copy source -> temp, validate temp.
        restore_tmp = data_dir / (PRIMARY_DB_NAME + ".restore.tmp")
        try:
            _copy_db(src, restore_tmp)
            _validate_db_file(restore_tmp)
        except RestoreError:
            _safe_unlink(restore_tmp)
            raise

        # 7. Atomic swap into place.
        os.replace(restore_tmp, primary)

        # 8. Verify the new primary; roll back on failure.
        try:
            _verify_restored_primary(primary)
        except RestoreError as exc:
            rollback_result = _rollback(data_dir, emergency_name)
            _append_history(
                data_dir,
                _history_entry(
                    source=filename,
                    emergency=emergency_name,
                    result="rolled_back",
                    error=str(exc),
                    rollback_result=rollback_result,
                ),
            )
            raise RestoreRollbackError(
                f"restore validation failed; rollback {rollback_result}: {exc}",
                emergency=emergency_name,
                rollback_result=rollback_result,
            ) from exc

        history_written = _append_history(
            data_dir,
            _history_entry(
                source=filename, emergency=emergency_name, result="success"
            ),
        )
        return {
            "result": "success",
            "source": filename,
            "emergency": emergency_name,
            "history_written": history_written,
        }
    finally:
        lock.release()
