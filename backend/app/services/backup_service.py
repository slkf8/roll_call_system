"""Event-driven SQLite backup for the Roll Call backend.

Design (see project plan v5):

* A rolling ``app_latest.db`` is refreshed after database mutations using a
  debounce (quiet period) + max-wait (force) state machine, plus once at
  startup and once at shutdown.
* An immutable per-day ``app_YYYY-MM-DD.db`` snapshot is created at a fixed
  local time (default 03:00) with startup catch-up, and old daily snapshots
  beyond the retention window are pruned -- only after a daily snapshot is
  successfully created or confirmed present.
* All copies use the SQLite online backup API with a read-only source URI,
  write to a ``*.tmp`` and ``os.replace`` atomically.
* Source missing / backup failure / un-removable stale tmp never delete
  history, never overwrite a valid backup, and never block the app.

Pure functions (``refresh_latest_backup``, ``create_daily_snapshot``,
``cleanup_old_daily_snapshots``, ``preflight_primary_db`` and the timing
helpers) are import-light and deterministic so they can be unit tested with
``tmp_path`` and injected clocks. The :class:`BackupScheduler` wires them to
the asyncio event loop.

Threading model:
* ``_state_lock`` guards scheduler bookkeeping (generation / dirty /
  timestamps / active pointer). The ``after_commit`` hook only ever takes
  this lock briefly to ``mark_dirty`` -- it never runs a backup.
* ``_backup_lock`` guards the SQLite online-backup critical section so two
  refreshers cannot write concurrently.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import sqlite3
import threading
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path

logger = logging.getLogger("rollcall.backup")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LATEST_DB_NAME = "app_latest.db"
PRIMARY_DB_NAME = "app.db"
BACKUPS_DIR_NAME = "backups"

# Strict daily-snapshot filename: app_YYYY-MM-DD.db (nothing else is touched).
_DAILY_RE = re.compile(r"^app_(\d{4}-\d{2}-\d{2})\.db$")

# Rate limits so failures cannot turn into a busy loop.
LATEST_RETRY_SECONDS = 60
DAILY_RETRY_SECONDS = 300

# Defaults (overridable via env, with safe fallback).
DEFAULT_DEBOUNCE_SECONDS = 30
DEFAULT_MAX_WAIT_SECONDS = 300
DEFAULT_DAILY_TIME = time(3, 0)
DEFAULT_RETENTION_DAYS = 30

_TRUTHY = frozenset({"1", "true", "yes"})
_FALSY = frozenset({"0", "false", "no", ""})

# Locks (module-level; single process / single worker portable deployment).
_state_lock = threading.Lock()
_backup_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Enable flags (resolved at runtime so tests/conftest can toggle via env)
# ---------------------------------------------------------------------------

def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in _TRUTHY:
        return True
    if normalized in _FALSY:
        return False
    logger.warning("invalid %s=%r; using default %s", name, raw, default)
    return default


def backup_enabled() -> bool:
    """Controls scheduler, mutation hooks, latest + daily snapshots."""
    return _env_flag("ROLL_CALL_ENABLE_BACKUP", True)


def primary_db_preflight_enabled() -> bool:
    """Controls the init_db primary-DB-missing guard (independent of backup)."""
    return _env_flag("ROLL_CALL_ENABLE_PRIMARY_DB_PREFLIGHT", True)


# ---------------------------------------------------------------------------
# Config parsing (invalid values fall back; never raise -> never block start)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BackupSettings:
    debounce_seconds: int = DEFAULT_DEBOUNCE_SECONDS
    max_wait_seconds: int = DEFAULT_MAX_WAIT_SECONDS
    daily_time: time = DEFAULT_DAILY_TIME
    retention_days: int = DEFAULT_RETENTION_DAYS


def _parse_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        logger.warning("invalid %s=%r; using default %d", name, raw, default)
        return default
    if value <= 0:
        logger.warning("non-positive %s=%r; using default %d", name, raw, default)
        return default
    return value


def _parse_daily_time(name: str, default: time) -> time:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    text = raw.strip()
    if not re.fullmatch(r"\d{1,2}:\d{2}", text):
        logger.warning("invalid %s=%r; using default %s", name, raw, default)
        return default
    hh, mm = (int(p) for p in text.split(":"))
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        logger.warning("out-of-range %s=%r; using default %s", name, raw, default)
        return default
    return time(hh, mm)


def load_settings() -> BackupSettings:
    debounce = _parse_positive_int("ROLL_CALL_BACKUP_DEBOUNCE_SECONDS", DEFAULT_DEBOUNCE_SECONDS)
    max_wait = _parse_positive_int("ROLL_CALL_BACKUP_MAX_WAIT_SECONDS", DEFAULT_MAX_WAIT_SECONDS)
    if max_wait < debounce:
        logger.warning(
            "max_wait (%d) < debounce (%d); using default max_wait %d",
            max_wait, debounce, DEFAULT_MAX_WAIT_SECONDS,
        )
        max_wait = DEFAULT_MAX_WAIT_SECONDS
    daily_time = _parse_daily_time("ROLL_CALL_DAILY_BACKUP_TIME", DEFAULT_DAILY_TIME)
    retention = _parse_positive_int("ROLL_CALL_BACKUP_RETENTION_DAYS", DEFAULT_RETENTION_DAYS)
    return BackupSettings(
        debounce_seconds=debounce,
        max_wait_seconds=max_wait,
        daily_time=daily_time,
        retention_days=retention,
    )


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _backups_dir(data_dir: Path) -> Path:
    return data_dir / BACKUPS_DIR_NAME


def _primary_db(data_dir: Path) -> Path:
    return data_dir / PRIMARY_DB_NAME


def _has_any_backup(backups_dir: Path) -> bool:
    """True if a rolling latest or any legal daily snapshot exists.

    Only inspects file names / existence -- never opens a database.
    """
    if (backups_dir / LATEST_DB_NAME).is_file():
        return True
    if not backups_dir.is_dir():
        return False
    for entry in backups_dir.iterdir():
        if entry.is_file() and _DAILY_RE.match(entry.name):
            return True
    return False


# ---------------------------------------------------------------------------
# SQLite online backup core
# ---------------------------------------------------------------------------

def _online_backup(src: Path, dst_tmp: Path) -> None:
    """Copy ``src`` to ``dst_tmp`` via the SQLite online backup API.

    Source is opened read-only through a proper file URI so paths containing
    spaces / unicode are handled correctly.
    """
    src_uri = src.resolve().as_uri() + "?mode=ro"
    src_conn = sqlite3.connect(src_uri, uri=True)
    try:
        dst_conn = sqlite3.connect(str(dst_tmp))
        try:
            src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
    finally:
        src_conn.close()


def _atomic_backup_to(src: Path, final: Path, tmp: Path) -> bool:
    """Best-effort atomic backup ``src`` -> ``final`` via ``tmp``.

    Returns True on success. On any failure: logs, removes this round's tmp,
    leaves any existing ``final`` untouched, and returns False (never raises).
    Guarded by ``_backup_lock`` so concurrent refreshers serialize.
    """
    with _backup_lock:
        # Remove our own stale tmp first. If we cannot remove it, the target is
        # untrustworthy (lock/permission anomaly) -> abort this refresh.
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                logger.exception("stale tmp unlink failed; abort refresh: %s", tmp)
                return False
        try:
            _online_backup(src, tmp)
            os.replace(tmp, final)
            return True
        except Exception:
            logger.exception("backup failed: %s -> %s", src, final)
            try:
                if tmp.exists():
                    tmp.unlink()
            except Exception:
                logger.exception("tmp cleanup after failure failed: %s", tmp)
            return False


# ---------------------------------------------------------------------------
# Rolling latest
# ---------------------------------------------------------------------------

def refresh_latest_backup(data_dir: Path) -> str | None:
    """Refresh ``backups/app_latest.db`` from the live primary DB.

    Returns the file name on success, else None. Never raises.
    """
    src = _primary_db(data_dir)
    if not src.is_file():
        logger.warning("source DB missing; skip latest refresh: %s", src)
        return None
    backups_dir = _backups_dir(data_dir)
    backups_dir.mkdir(parents=True, exist_ok=True)
    final = backups_dir / LATEST_DB_NAME
    tmp = backups_dir / (LATEST_DB_NAME + ".tmp")
    return LATEST_DB_NAME if _atomic_backup_to(src, final, tmp) else None


# ---------------------------------------------------------------------------
# Daily snapshot + cleanup
# ---------------------------------------------------------------------------

def cleanup_old_daily_snapshots(
    backups_dir: Path, *, today: date, retention_days: int = DEFAULT_RETENTION_DAYS
) -> list[str]:
    """Delete daily snapshots older than the retention window.

    Only files matching ``app_YYYY-MM-DD.db`` with a parseable date strictly
    older than ``today - (retention_days - 1)`` are removed. Everything else
    (app_latest.db, unknown files, manual backups, .tmp, invalid dates) is
    left untouched.
    """
    if not backups_dir.is_dir():
        return []
    cutoff = today - timedelta(days=retention_days - 1)
    removed: list[str] = []
    for entry in sorted(backups_dir.iterdir()):
        if not entry.is_file():
            continue
        m = _DAILY_RE.match(entry.name)
        if not m:
            continue
        try:
            snap_date = date.fromisoformat(m.group(1))
        except ValueError:
            continue  # malformed date -> leave alone
        if snap_date < cutoff:
            try:
                entry.unlink()
                removed.append(entry.name)
            except Exception:
                logger.exception("failed to remove old daily snapshot: %s", entry)
    return removed


def create_daily_snapshot(
    data_dir: Path,
    *,
    today: date | None = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> str | None:
    """Create today's immutable daily snapshot if missing, then cleanup.

    * If today's snapshot already exists -> return None without cleanup
      (created nothing; never overwrite an immutable snapshot).
    * Else online-backup the live primary -> app_<today>.db; on success run
      cleanup and return the name; on failure do NOT cleanup, return None.
    Never raises.
    """
    today = today or date.today()
    backups_dir = _backups_dir(data_dir)
    backups_dir.mkdir(parents=True, exist_ok=True)
    final = backups_dir / f"app_{today.isoformat()}.db"

    if final.is_file():
        return None

    src = _primary_db(data_dir)
    if not src.is_file():
        logger.warning("source DB missing; skip daily snapshot AND cleanup: %s", src)
        return None

    tmp = backups_dir / f"app_{today.isoformat()}.db.tmp"
    if not _atomic_backup_to(src, final, tmp):
        return None  # failure -> no cleanup, history preserved

    cleanup_old_daily_snapshots(backups_dir, today=today, retention_days=retention_days)
    return final.name


# ---------------------------------------------------------------------------
# Primary DB missing preflight
# ---------------------------------------------------------------------------

def preflight_primary_db(data_dir: Path) -> None:
    """Guard against silently re-creating a lost primary DB.

    Only inspects file names / existence -- never opens any database.

    * app.db exists                       -> ok (return).
    * app.db missing, no backups          -> fresh install -> ok (return).
    * app.db missing, backups present     -> suspected loss -> RuntimeError.
    """
    if _primary_db(data_dir).is_file():
        return
    backups_dir = _backups_dir(data_dir)
    if _has_any_backup(backups_dir):
        raise RuntimeError(
            f"Primary database {PRIMARY_DB_NAME!r} is missing but backups exist "
            f"in {backups_dir}. Refusing to start and create an empty database, "
            "which would mask data loss. Restore app.db from a backup (e.g. "
            f"{LATEST_DB_NAME}) or move the backups aside to start fresh."
        )


# ---------------------------------------------------------------------------
# Timing helpers (pure, deterministic)
# ---------------------------------------------------------------------------

def compute_latest_wait(
    state: "SchedulerState", *, now: float, debounce: float, max_wait: float
) -> float | None:
    """Seconds to wait before the next latest refresh, or None if not dirty."""
    if not state.dirty:
        return None
    debounce_deadline = (state.last_commit_mono or now) + debounce
    maxwait_deadline = (state.first_dirty_mono or now) + max_wait
    return max(0.0, min(debounce_deadline, maxwait_deadline) - now)


def seconds_until_next_daily(now_dt: datetime, daily_time: time) -> float:
    """Seconds from ``now_dt`` until the next occurrence of ``daily_time``."""
    today_target = datetime.combine(now_dt.date(), daily_time)
    target = today_target if now_dt < today_target else today_target + timedelta(days=1)
    return max(0.0, (target - now_dt).total_seconds())


def daily_due_now(data_dir: Path, now_dt: datetime, daily_time: time) -> bool:
    """True when today's snapshot is missing and we are at/after daily_time."""
    if now_dt.time() < daily_time:
        return False
    final = _backups_dir(data_dir) / f"app_{now_dt.date().isoformat()}.db"
    return not final.is_file()


# ---------------------------------------------------------------------------
# Scheduler state
# ---------------------------------------------------------------------------

@dataclass
class SchedulerState:
    generation: int = 0
    last_backed_generation: int = 0
    first_dirty_mono: float | None = None
    last_commit_mono: float | None = None

    @property
    def dirty(self) -> bool:
        return self.generation > self.last_backed_generation


# ---------------------------------------------------------------------------
# Mutation hooks (idempotent install)
# ---------------------------------------------------------------------------

_HAS_MUTATION_KEY = "rollcall_has_mutation"
_hooks_installed = False


def install_mutation_hooks() -> None:
    """Attach SQLAlchemy mutation tracking to SessionLocal. Idempotent.

    NOTE: all current writes go through ORM flush (Session.add/delete +
    commit). If raw ORM-enabled ``Session.execute()`` DML is ever introduced,
    add ``do_orm_execute`` mutation tracking here as well.
    """
    global _hooks_installed
    if _hooks_installed:
        return

    from sqlalchemy import event

    from app.database import SessionLocal

    def _flag_mutation(session, flush_context, instances):
        if session.new or session.dirty or session.deleted:
            session.info[_HAS_MUTATION_KEY] = True

    def _on_commit(session):
        if session.info.pop(_HAS_MUTATION_KEY, False):
            mark_dirty()

    def _clear_flag(session, *args):
        session.info.pop(_HAS_MUTATION_KEY, False)

    if not event.contains(SessionLocal, "before_flush", _flag_mutation):
        event.listen(SessionLocal, "before_flush", _flag_mutation)
    if not event.contains(SessionLocal, "after_commit", _on_commit):
        event.listen(SessionLocal, "after_commit", _on_commit)
    if not event.contains(SessionLocal, "after_rollback", _clear_flag):
        event.listen(SessionLocal, "after_rollback", _clear_flag)
    if not event.contains(SessionLocal, "after_soft_rollback", _clear_flag):
        event.listen(SessionLocal, "after_soft_rollback", _clear_flag)

    _hooks_installed = True


# ---------------------------------------------------------------------------
# Scheduler (asyncio orchestration)
# ---------------------------------------------------------------------------

class BackupScheduler:
    def __init__(self, data_dir: Path, settings: BackupSettings):
        self.data_dir = data_dir
        self.settings = settings
        self.state = SchedulerState()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._wake = asyncio.Event()
        self._latest_task: asyncio.Task | None = None
        self._daily_task: asyncio.Task | None = None
        self._running = False

    # -- called from request/worker threads (after_commit) --------------
    def mark_dirty(self) -> None:
        """Thread-safe, fast. Safe no-op if scheduler is inactive/closed."""
        loop = self._loop
        if not self._running or loop is None or loop.is_closed():
            return
        now = _monotonic()
        with _state_lock:
            self.state.generation += 1
            self.state.last_commit_mono = now
            if self.state.first_dirty_mono is None:
                self.state.first_dirty_mono = now
        try:
            loop.call_soon_threadsafe(self._wake.set)
        except RuntimeError:
            # loop closed between the check and the call -> ignore.
            pass

    # -- lifecycle ------------------------------------------------------
    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._running = True
        # Startup: one latest refresh + daily catch-up.
        await asyncio.to_thread(refresh_latest_backup, self.data_dir)
        await asyncio.to_thread(
            self._maybe_daily_catchup,
        )
        self._latest_task = asyncio.create_task(self._latest_loop())
        self._daily_task = asyncio.create_task(self._daily_loop())

    async def stop(self) -> None:
        self._running = False
        for task in (self._latest_task, self._daily_task):
            if task is not None:
                task.cancel()
        for task in (self._latest_task, self._daily_task):
            if task is not None:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception:
                    logger.exception("backup task ended with error")
        # Final best-effort latest refresh after loops are stopped.
        try:
            await asyncio.to_thread(refresh_latest_backup, self.data_dir)
        except Exception:
            logger.exception("final latest refresh failed")

    # -- internal -------------------------------------------------------
    def _reconcile_after_backup(self, captured: int) -> bool:
        """Update dirty bookkeeping after a successful latest backup.

        If no new commit arrived during the backup (generation unchanged),
        clear dirty. Otherwise keep dirty and restart the max-wait window.
        Returns whether the scheduler is still dirty afterwards.
        """
        with _state_lock:
            if self.state.generation == captured:
                self.state.last_backed_generation = captured
                self.state.first_dirty_mono = None
            else:
                self.state.first_dirty_mono = _monotonic()
            return self.state.dirty

    def _maybe_daily_catchup(self) -> None:
        if daily_due_now(self.data_dir, datetime.now(), self.settings.daily_time):
            create_daily_snapshot(
                self.data_dir, retention_days=self.settings.retention_days
            )

    async def _latest_loop(self) -> None:
        while self._running:
            await self._wake.wait()
            self._wake.clear()
            while self._running:
                with _state_lock:
                    wait = compute_latest_wait(
                        self.state,
                        now=_monotonic(),
                        debounce=self.settings.debounce_seconds,
                        max_wait=self.settings.max_wait_seconds,
                    )
                if wait is None:
                    break  # not dirty
                try:
                    await asyncio.wait_for(self._wake.wait(), timeout=wait)
                    self._wake.clear()
                    continue  # new commit arrived -> recompute
                except asyncio.TimeoutError:
                    pass
                with _state_lock:
                    captured = self.state.generation
                name = await asyncio.to_thread(refresh_latest_backup, self.data_dir)
                if name is None:
                    await asyncio.sleep(LATEST_RETRY_SECONDS)  # rate-limited retry
                    continue
                self._reconcile_after_backup(captured)

    async def _daily_loop(self) -> None:
        while self._running:
            due = await asyncio.to_thread(
                daily_due_now, self.data_dir, datetime.now(), self.settings.daily_time
            )
            if not due:
                delay = seconds_until_next_daily(datetime.now(), self.settings.daily_time)
                try:
                    await asyncio.sleep(delay)
                except asyncio.CancelledError:
                    raise
                continue

            name = await asyncio.to_thread(
                create_daily_snapshot,
                self.data_dir,
                retention_days=self.settings.retention_days,
            )
            # If a snapshot was due but creation failed, retry sooner.
            due = await asyncio.to_thread(
                daily_due_now, self.data_dir, datetime.now(), self.settings.daily_time
            )
            if name is None and due:
                await asyncio.sleep(DAILY_RETRY_SECONDS)
                continue
            delay = seconds_until_next_daily(datetime.now(), self.settings.daily_time)
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                raise


def _monotonic() -> float:
    import time as _time

    return _time.monotonic()


# ---------------------------------------------------------------------------
# Module-level active scheduler + start/stop used by the app lifespan
# ---------------------------------------------------------------------------

_active_scheduler: BackupScheduler | None = None


def mark_dirty() -> None:
    """Forward to the active scheduler; safe no-op if none is running."""
    with _state_lock:
        scheduler = _active_scheduler
    if scheduler is not None:
        scheduler.mark_dirty()


async def start(data_dir: Path, settings: BackupSettings | None = None) -> BackupScheduler:
    global _active_scheduler
    scheduler = BackupScheduler(data_dir, settings or load_settings())
    with _state_lock:
        _active_scheduler = scheduler
    await scheduler.start()
    return scheduler


async def stop(scheduler: BackupScheduler) -> None:
    global _active_scheduler
    try:
        await scheduler.stop()
    finally:
        with _state_lock:
            if _active_scheduler is scheduler:
                _active_scheduler = None
