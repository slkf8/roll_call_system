"""Tests for the maintenance restore service.

All databases live under tmp_path; the production backend/data is never read,
copied, hashed, or modified.
"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime
from pathlib import Path

import pytest

from app.services import backup_service as bs
from app.services import restore_service as rs
from app.services.app_lock import AppLock, LOCK_FILENAME


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_valid_db(path: Path, marker: str = "A", *, rows: int = 1) -> None:
    """Create a structurally valid app.db with the required core tables."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path))
    try:
        con.execute("CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)")
        con.execute("CREATE TABLE student_schedule_rules (id INTEGER PRIMARY KEY)")
        con.execute("CREATE TABLE sessions (id INTEGER PRIMARY KEY)")
        con.execute("CREATE TABLE global_events (id INTEGER PRIMARY KEY)")
        for _ in range(rows):
            con.execute("INSERT INTO students (name) VALUES (?)", (marker,))
        con.commit()
    finally:
        con.close()


def _markers(path: Path) -> list[str]:
    con = sqlite3.connect(str(path))
    try:
        return [r[0] for r in con.execute("SELECT name FROM students ORDER BY id")]
    finally:
        con.close()


def _setup(tmp_path: Path) -> tuple[Path, Path]:
    data = tmp_path / "data"
    backups = data / "backups"
    backups.mkdir(parents=True)
    return data, backups


# ---------------------------------------------------------------------------
# Filename safety
# ---------------------------------------------------------------------------

def test_legal_basename_resolves(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(backups / "app_latest.db")
    resolved = rs._resolve_backup_path(data, "app_latest.db")
    assert resolved == backups / "app_latest.db"


@pytest.mark.parametrize(
    "bad",
    [
        "../app.db",            # parent escape
        "../../etc/passwd",     # deep escape
        "sub/app_latest.db",    # subdirectory
        "back\\app.db",         # backslash separator
        "..",                   # dotdot
        ".",                    # dot
    ],
)
def test_rejects_separators_and_dotdot(tmp_path: Path, bad: str):
    data, _ = _setup(tmp_path)
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, bad)


def test_rejects_absolute_path(tmp_path: Path):
    data, _ = _setup(tmp_path)
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "/etc/hosts")
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, str(tmp_path / "data" / "backups" / "app_latest.db"))


def test_rejects_non_db_extension(tmp_path: Path):
    data, backups = _setup(tmp_path)
    (backups / "notes.txt").write_bytes(b"x")
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "notes.txt")


def test_rejects_tmp_file(tmp_path: Path):
    data, backups = _setup(tmp_path)
    (backups / "app_latest.db.tmp").write_bytes(b"x")
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "app_latest.db.tmp")


def test_rejects_unknown_db_name(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(backups / "random.db")
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "random.db")
    # app.db (the primary) is not a legal restore *source* name either
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "app.db")


def test_rejects_missing_but_well_formed_name(tmp_path: Path):
    data, _ = _setup(tmp_path)
    with pytest.raises(rs.RestoreError):
        rs._resolve_backup_path(data, "app_2099-01-01.db")


# ---------------------------------------------------------------------------
# list_backups
# ---------------------------------------------------------------------------

def test_list_backups_classifies(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(backups / "app_latest.db")
    _make_valid_db(backups / "app_2026-06-01.db")
    _make_valid_db(backups / "app_before_restore_2026-06-01_120000.db")
    # noise that must be excluded
    (backups / "app_latest.db.tmp").write_bytes(b"x")
    (backups / "notes.txt").write_bytes(b"x")
    (data / "restore_history.jsonl").write_text("{}\n")

    listed = {b["filename"]: b["kind"] for b in rs.list_backups(data_dir=data)}

    assert listed == {
        "app_latest.db": "latest",
        "app_2026-06-01.db": "daily",
        "app_before_restore_2026-06-01_120000.db": "emergency",
    }


def test_list_backups_empty_when_no_dir(tmp_path: Path):
    data = tmp_path / "data"
    assert rs.list_backups(data_dir=data) == []


# ---------------------------------------------------------------------------
# validate_backup
# ---------------------------------------------------------------------------

def test_validate_accepts_good_db(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(backups / "app_latest.db", "ok")
    info = rs.validate_backup("app_latest.db", data_dir=data)
    assert info["ok"] is True
    assert info["size"] > 0


def test_validate_rejects_non_sqlite(tmp_path: Path):
    data, backups = _setup(tmp_path)
    (backups / "app_2026-06-01.db").write_bytes(b"this is not a database at all")
    with pytest.raises(rs.RestoreError):
        rs.validate_backup("app_2026-06-01.db", data_dir=data)


def test_validate_rejects_corrupt_db(tmp_path: Path):
    data, backups = _setup(tmp_path)
    target = backups / "app_2026-06-02.db"
    _make_valid_db(target, "x", rows=300)  # several pages
    # Corrupt page data after the header so integrity_check fails.
    with target.open("r+b") as handle:
        handle.seek(2048)
        handle.write(b"\xff" * 4096)
    with pytest.raises(rs.RestoreError):
        rs.validate_backup("app_2026-06-02.db", data_dir=data)


def test_validate_rejects_missing_required_tables(tmp_path: Path):
    data, backups = _setup(tmp_path)
    target = backups / "app_2026-06-03.db"
    con = sqlite3.connect(str(target))
    try:
        con.execute("CREATE TABLE students (id INTEGER PRIMARY KEY)")
        con.commit()  # valid sqlite but missing the other core tables
    finally:
        con.close()
    with pytest.raises(rs.RestoreError):
        rs.validate_backup("app_2026-06-03.db", data_dir=data)


# ---------------------------------------------------------------------------
# restore_backup — happy path
# ---------------------------------------------------------------------------

def test_restore_success_swaps_content_and_makes_emergency(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")

    result = rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    assert result["result"] == "success"
    # app.db now carries the backup's content
    assert _markers(data / "app.db") == ["B"]
    # emergency backup captured the previous content
    emergency = result["emergency"]
    assert emergency is not None
    assert (backups / emergency).is_file()
    assert _markers(backups / emergency) == ["A"]
    assert rs.EMERGENCY_RE.match(emergency)
    # no temp residue
    assert not (data / "app.db.restore.tmp").exists()


def test_restore_writes_success_history(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")

    rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    history = rs.read_history(data_dir=data)
    assert len(history) == 1
    assert history[-1]["result"] == "success"
    assert history[-1]["source"] == "app_latest.db"
    assert history[-1]["emergency"] is not None
    assert history[-1]["error"] is None


def test_emergency_name_unique_on_collision(tmp_path: Path):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    fixed = datetime(2026, 6, 4, 12, 0, 0)

    first = rs._create_emergency_backup(data, now=fixed)
    second = rs._create_emergency_backup(data, now=fixed)

    assert first != second
    assert (backups / first).is_file()
    assert (backups / second).is_file()
    assert rs.EMERGENCY_RE.match(first)
    assert rs.EMERGENCY_RE.match(second)


# ---------------------------------------------------------------------------
# restore_backup — running-app refusal
# ---------------------------------------------------------------------------

def test_restore_refused_when_health_running(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: True)

    with pytest.raises(rs.RestoreError):
        rs.restore_backup("app_latest.db", data_dir=data)  # check_running defaults True

    assert _markers(data / "app.db") == ["A"]  # untouched
    assert rs.read_history(data_dir=data) == []


def test_restore_refused_when_db_write_locked(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    # Health probe disabled so the real listener on the box can't decide this.
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)

    holder = sqlite3.connect(str(data / "app.db"))
    holder.execute("BEGIN EXCLUSIVE")
    try:
        assert rs._db_write_locked(data / "app.db") is True
        with pytest.raises(rs.RestoreError):
            rs.restore_backup("app_latest.db", data_dir=data)
    finally:
        holder.rollback()
        holder.close()

    assert _markers(data / "app.db") == ["A"]  # untouched


# ---------------------------------------------------------------------------
# restore_backup — post-validate failure -> rollback
# ---------------------------------------------------------------------------

def test_restore_rolls_back_on_post_validate_failure(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")

    def _boom(_primary):
        raise rs.RestoreError("forced post-validate failure")

    monkeypatch.setattr(rs, "_verify_restored_primary", _boom)

    with pytest.raises(rs.RestoreError):
        rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    # app.db restored to its original content, never left missing
    assert (data / "app.db").is_file()
    assert _markers(data / "app.db") == ["A"]
    # no temp residue
    assert not (data / "app.db.rollback.tmp").exists()
    assert not (data / "app.db.restore.tmp").exists()

    history = rs.read_history(data_dir=data)
    assert history[-1]["result"] == "rolled_back"
    assert history[-1]["rollback_result"] == "success"
    assert history[-1]["error"]


# ---------------------------------------------------------------------------
# Lifecycle lock as the primary gate
# ---------------------------------------------------------------------------

def test_restore_refused_when_lifecycle_lock_held(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    # Health probe disabled so the lock is what does the refusing here.
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)

    holder = AppLock(data)
    assert holder.acquire() is True
    try:
        with pytest.raises(rs.RestoreError):
            rs.restore_backup("app_latest.db", data_dir=data, check_running=False)
    finally:
        holder.release()

    # app.db untouched and NO emergency backup created (refused before that).
    assert _markers(data / "app.db") == ["A"]
    assert rs.list_backups(data_dir=data) == [
        {
            "filename": "app_latest.db",
            "kind": "latest",
            "size": (backups / "app_latest.db").stat().st_size,
            "mtime": (backups / "app_latest.db").stat().st_mtime,
        }
    ]
    assert rs.read_history(data_dir=data) == []


def test_restore_releases_lock_on_success(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)

    rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    # Lock free afterwards.
    after = AppLock(data)
    assert after.acquire() is True
    after.release()


def test_restore_releases_lock_on_rollback_failure(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    monkeypatch.setattr(
        rs, "_verify_restored_primary",
        lambda p: (_ for _ in ()).throw(rs.RestoreError("boom")),
    )

    with pytest.raises(rs.RestoreRollbackError):
        rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    after = AppLock(data)
    assert after.acquire() is True
    after.release()


def test_concurrent_restore_is_refused(tmp_path: Path, monkeypatch):
    """A second restore while the first holds the lock is refused."""
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)

    # Simulate "restore in progress" by holding the lifecycle lock, then drive
    # a real restore_backup which must fail to acquire it.
    first = AppLock(data)
    assert first.acquire() is True
    try:
        with pytest.raises(rs.RestoreError):
            rs.restore_backup("app_latest.db", data_dir=data, check_running=False)
    finally:
        first.release()


def test_rollback_failure_raises_rollback_error_with_details(tmp_path: Path, monkeypatch):
    data, backups = _setup(tmp_path)
    _make_valid_db(data / "app.db", "A")
    _make_valid_db(backups / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    monkeypatch.setattr(
        rs, "_verify_restored_primary",
        lambda p: (_ for _ in ()).throw(rs.RestoreError("post fail")),
    )
    # Force the rollback itself to fail.
    monkeypatch.setattr(rs, "_rollback", lambda d, e: "failed")

    with pytest.raises(rs.RestoreRollbackError) as excinfo:
        rs.restore_backup("app_latest.db", data_dir=data, check_running=False)

    assert excinfo.value.rollback_result == "failed"
    assert excinfo.value.emergency is not None
    history = rs.read_history(data_dir=data)
    assert history[-1]["result"] == "rolled_back"
    assert history[-1]["rollback_result"] == "failed"


# ---------------------------------------------------------------------------
# Interaction with the existing daily cleanup
# ---------------------------------------------------------------------------

def test_emergency_backup_not_pruned_by_daily_cleanup(tmp_path: Path):
    _, backups = _setup(tmp_path)
    emergency = backups / "app_before_restore_2020-01-01_000000.db"
    _make_valid_db(emergency, "E")
    # also an old daily snapshot that *should* be pruned
    old_daily = backups / "app_2020-01-01.db"
    _make_valid_db(old_daily, "D")

    removed = bs.cleanup_old_daily_snapshots(
        backups, today=date(2026, 6, 1), retention_days=30
    )

    assert old_daily.name in removed
    assert emergency.name not in removed
    assert emergency.is_file()
