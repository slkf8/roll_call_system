"""Tests for the event-driven backup service.

All SQLite databases are created under tmp_path; no production DB is touched.
"""
from __future__ import annotations

import asyncio
import sqlite3
from datetime import date, datetime, time, timedelta
from pathlib import Path

import pytest

from app.services import backup_service as bs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db(path: Path, value: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path))
    try:
        con.execute("CREATE TABLE IF NOT EXISTS t (v TEXT)")
        con.execute("INSERT INTO t (v) VALUES (?)", (value,))
        con.commit()
    finally:
        con.close()


def _read_values(path: Path) -> list[str]:
    con = sqlite3.connect(str(path))
    try:
        return [row[0] for row in con.execute("SELECT v FROM t ORDER BY rowid")]
    finally:
        con.close()


def _data_dir(tmp_path: Path) -> Path:
    d = tmp_path / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# refresh_latest_backup
# ---------------------------------------------------------------------------

def test_latest_backup_created_and_readable(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "hello")

    name = bs.refresh_latest_backup(data_dir)

    assert name == "app_latest.db"
    latest = data_dir / "backups" / "app_latest.db"
    assert latest.is_file()
    assert _read_values(latest) == ["hello"]


def test_latest_backup_overwrites_with_newer_content(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "a")
    bs.refresh_latest_backup(data_dir)

    _make_db(data_dir / "app.db", "b")  # second row added
    bs.refresh_latest_backup(data_dir)

    latest = data_dir / "backups" / "app_latest.db"
    assert _read_values(latest) == ["a", "b"]
    # single rolling file + no tmp residue
    files = sorted(p.name for p in (data_dir / "backups").iterdir())
    assert files == ["app_latest.db"]


def test_latest_backup_source_missing_returns_none(tmp_path: Path):
    data_dir = _data_dir(tmp_path)  # no app.db
    assert bs.refresh_latest_backup(data_dir) is None
    # must not create an empty source DB
    assert not (data_dir / "app.db").exists()


def test_latest_backup_with_spaces_in_path(tmp_path: Path):
    data_dir = tmp_path / "folder with spaces" / "data"
    data_dir.mkdir(parents=True)
    _make_db(data_dir / "app.db", "spaced")

    name = bs.refresh_latest_backup(data_dir)

    assert name == "app_latest.db"
    assert _read_values(data_dir / "backups" / "app_latest.db") == ["spaced"]


def test_latest_backup_failure_preserves_existing(tmp_path: Path, monkeypatch):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "good")
    bs.refresh_latest_backup(data_dir)  # establish a valid latest
    latest = data_dir / "backups" / "app_latest.db"
    assert _read_values(latest) == ["good"]

    def _boom(src, dst_tmp):
        raise RuntimeError("backup boom")

    monkeypatch.setattr(bs, "_online_backup", _boom)
    _make_db(data_dir / "app.db", "newer")  # source changes but backup will fail

    assert bs.refresh_latest_backup(data_dir) is None
    # existing valid latest untouched, no tmp residue
    assert _read_values(latest) == ["good"]
    assert not (data_dir / "backups" / "app_latest.db.tmp").exists()


def test_latest_backup_aborts_when_stale_tmp_unremovable(tmp_path: Path, monkeypatch):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "good")
    bs.refresh_latest_backup(data_dir)
    latest = data_dir / "backups" / "app_latest.db"

    tmp = data_dir / "backups" / "app_latest.db.tmp"
    tmp.write_bytes(b"stale")

    real_unlink = Path.unlink

    def _unlink(self, *args, **kwargs):
        if self.name == "app_latest.db.tmp":
            raise PermissionError("locked")
        return real_unlink(self, *args, **kwargs)

    called = {"backup": False}

    def _spy_backup(src, dst_tmp):
        called["backup"] = True

    monkeypatch.setattr(Path, "unlink", _unlink)
    monkeypatch.setattr(bs, "_online_backup", _spy_backup)
    _make_db(data_dir / "app.db", "newer")

    assert bs.refresh_latest_backup(data_dir) is None
    assert called["backup"] is False          # online backup never attempted
    assert _read_values(latest) == ["good"]   # existing valid latest untouched


def test_latest_backup_no_tmp_residue_on_success(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db")
    bs.refresh_latest_backup(data_dir)
    assert not (data_dir / "backups" / "app_latest.db.tmp").exists()


# ---------------------------------------------------------------------------
# generation reconciliation
# ---------------------------------------------------------------------------

def test_reconcile_clears_dirty_when_generation_unchanged(tmp_path: Path):
    sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
    sched.state.generation = 3
    captured = 3
    still_dirty = sched._reconcile_after_backup(captured)
    assert still_dirty is False
    assert sched.state.last_backed_generation == 3
    assert sched.state.first_dirty_mono is None


def test_reconcile_keeps_dirty_when_commit_during_backup(tmp_path: Path):
    sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
    sched.state.generation = 5
    captured = 4  # a commit landed during the backup
    still_dirty = sched._reconcile_after_backup(captured)
    assert still_dirty is True
    assert sched.state.last_backed_generation == 0  # not advanced
    assert sched.state.first_dirty_mono is not None  # max-wait restarted


# ---------------------------------------------------------------------------
# mark_dirty gating
# ---------------------------------------------------------------------------

def test_mark_dirty_noop_when_inactive(tmp_path: Path):
    sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
    # not started -> _running False, loop None
    sched.mark_dirty()
    assert sched.state.generation == 0
    assert sched.state.dirty is False


def test_module_mark_dirty_noop_without_active_scheduler():
    # ensure no active scheduler
    with bs._state_lock:
        bs._active_scheduler = None
    bs.mark_dirty()  # must not raise


# ---------------------------------------------------------------------------
# timing helpers
# ---------------------------------------------------------------------------

def test_compute_latest_wait_none_when_clean(tmp_path: Path):
    state = bs.SchedulerState()
    assert bs.compute_latest_wait(state, now=100.0, debounce=30, max_wait=300) is None


def test_compute_latest_wait_debounce(tmp_path: Path):
    state = bs.SchedulerState(generation=1, last_backed_generation=0,
                              first_dirty_mono=100.0, last_commit_mono=100.0)
    # now=110, debounce target = 130, maxwait target = 400 -> min -> 130 -> wait 20
    assert bs.compute_latest_wait(state, now=110.0, debounce=30, max_wait=300) == pytest.approx(20.0)


def test_compute_latest_wait_max_wait_caps(tmp_path: Path):
    # continuous commits: last_commit keeps moving, but max_wait caps it
    state = bs.SchedulerState(generation=9, last_backed_generation=0,
                              first_dirty_mono=100.0, last_commit_mono=395.0)
    # debounce target = 425, maxwait target = 400 -> min -> 400 -> now=399 -> wait 1
    assert bs.compute_latest_wait(state, now=399.0, debounce=30, max_wait=300) == pytest.approx(1.0)


def test_seconds_until_next_daily():
    now = datetime(2026, 6, 1, 1, 0, 0)
    assert bs.seconds_until_next_daily(now, time(3, 0)) == pytest.approx(2 * 3600)
    now2 = datetime(2026, 6, 1, 4, 0, 0)  # past today's 03:00 -> tomorrow
    assert bs.seconds_until_next_daily(now2, time(3, 0)) == pytest.approx(23 * 3600)


def test_daily_due_now(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    # before time -> not due
    assert bs.daily_due_now(data_dir, datetime(2026, 6, 1, 2, 0), time(3, 0)) is False
    # at/after time and missing -> due
    assert bs.daily_due_now(data_dir, datetime(2026, 6, 1, 3, 30), time(3, 0)) is True
    # exists -> not due
    (data_dir / "backups").mkdir(parents=True)
    (data_dir / "backups" / "app_2026-06-01.db").write_bytes(b"x")
    assert bs.daily_due_now(data_dir, datetime(2026, 6, 1, 3, 30), time(3, 0)) is False


# ---------------------------------------------------------------------------
# daily snapshot + cleanup
# ---------------------------------------------------------------------------

def test_create_daily_snapshot(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "d")
    today = date(2026, 6, 1)

    name = bs.create_daily_snapshot(data_dir, today=today)

    assert name == "app_2026-06-01.db"
    snap = data_dir / "backups" / "app_2026-06-01.db"
    assert _read_values(snap) == ["d"]


def test_create_daily_snapshot_is_immutable_same_day(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "first")
    today = date(2026, 6, 1)
    bs.create_daily_snapshot(data_dir, today=today)

    _make_db(data_dir / "app.db", "second")  # source changes
    name = bs.create_daily_snapshot(data_dir, today=today)

    assert name is None  # not overwritten
    snap = data_dir / "backups" / "app_2026-06-01.db"
    assert _read_values(snap) == ["first"]  # original content preserved


def test_create_daily_snapshot_existing_today_skips_cleanup(tmp_path: Path, monkeypatch):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "first")
    today = date(2026, 6, 1)
    bs.create_daily_snapshot(data_dir, today=today)

    old = data_dir / "backups" / "app_2020-01-01.db"
    old.write_bytes(b"old")
    calls = {"cleanup": 0}

    def _cleanup(*args, **kwargs):
        calls["cleanup"] += 1
        raise AssertionError("cleanup must not run when today's snapshot exists")

    monkeypatch.setattr(bs, "cleanup_old_daily_snapshots", _cleanup)

    name = bs.create_daily_snapshot(data_dir, today=today)

    assert name is None
    assert calls["cleanup"] == 0
    assert old.exists()


def test_create_daily_snapshot_failure_skips_cleanup(tmp_path: Path, monkeypatch):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db", "d")
    backups = data_dir / "backups"
    backups.mkdir(parents=True)
    old = backups / "app_2020-01-01.db"
    old.write_bytes(b"old")

    monkeypatch.setattr(bs, "_online_backup", lambda s, d: (_ for _ in ()).throw(RuntimeError("boom")))
    name = bs.create_daily_snapshot(data_dir, today=date(2026, 6, 1))

    assert name is None
    assert old.exists()  # cleanup did NOT run because creation failed


def test_create_daily_snapshot_source_missing(tmp_path: Path):
    data_dir = _data_dir(tmp_path)  # no app.db
    backups = data_dir / "backups"
    backups.mkdir(parents=True)
    old = backups / "app_2020-01-01.db"
    old.write_bytes(b"old")

    name = bs.create_daily_snapshot(data_dir, today=date(2026, 6, 1))

    assert name is None
    assert old.exists()                      # no cleanup
    assert not (data_dir / "app.db").exists()  # no empty source created


def test_cleanup_retention_and_whitelist(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    backups = data_dir / "backups"
    backups.mkdir(parents=True)
    today = date(2026, 6, 1)

    keep_today = backups / "app_2026-06-01.db"
    keep_edge = backups / f"app_{(today - timedelta(days=29)).isoformat()}.db"
    drop_old = backups / f"app_{(today - timedelta(days=40)).isoformat()}.db"
    drop_ancient = backups / "app_2020-01-01.db"
    for f in (keep_today, keep_edge, drop_old, drop_ancient):
        f.write_bytes(b"x")

    # non-matching files that must never be touched
    untouched = [
        backups / "app_latest.db",
        backups / "notes.txt",
        backups / "random.db",
        backups / "app_backup.db",
        backups / "app_2026-13-99.db",       # invalid date
        backups / "app_2026-06-01.db.tmp",   # tmp
    ]
    for f in untouched:
        f.write_bytes(b"x")

    removed = bs.cleanup_old_daily_snapshots(backups, today=today, retention_days=30)

    assert set(removed) == {drop_old.name, drop_ancient.name}
    assert keep_today.exists() and keep_edge.exists()
    assert not drop_old.exists() and not drop_ancient.exists()
    for f in untouched:
        assert f.exists(), f"{f.name} must be preserved"


# ---------------------------------------------------------------------------
# preflight
# ---------------------------------------------------------------------------

def test_preflight_ok_when_primary_exists(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    _make_db(data_dir / "app.db")
    bs.preflight_primary_db(data_dir)  # no raise


def test_preflight_ok_fresh_install(tmp_path: Path):
    data_dir = _data_dir(tmp_path)  # no app.db, no backups
    bs.preflight_primary_db(data_dir)  # no raise


def test_preflight_raises_when_latest_exists_but_primary_missing(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    backups = data_dir / "backups"
    backups.mkdir(parents=True)
    (backups / "app_latest.db").write_bytes(b"x")
    with pytest.raises(RuntimeError):
        bs.preflight_primary_db(data_dir)
    assert not (data_dir / "app.db").exists()  # no empty DB created


def test_preflight_raises_when_daily_exists_but_primary_missing(tmp_path: Path):
    data_dir = _data_dir(tmp_path)
    backups = data_dir / "backups"
    backups.mkdir(parents=True)
    (backups / "app_2026-06-01.db").write_bytes(b"x")
    with pytest.raises(RuntimeError):
        bs.preflight_primary_db(data_dir)


# ---------------------------------------------------------------------------
# config parsing / fallback
# ---------------------------------------------------------------------------

def test_load_settings_defaults_on_invalid(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_BACKUP_DEBOUNCE_SECONDS", "abc")
    monkeypatch.setenv("ROLL_CALL_BACKUP_MAX_WAIT_SECONDS", "-5")
    monkeypatch.setenv("ROLL_CALL_DAILY_BACKUP_TIME", "99:99")
    monkeypatch.setenv("ROLL_CALL_BACKUP_RETENTION_DAYS", "0")
    s = bs.load_settings()
    assert s.debounce_seconds == bs.DEFAULT_DEBOUNCE_SECONDS
    assert s.max_wait_seconds == bs.DEFAULT_MAX_WAIT_SECONDS
    assert s.daily_time == bs.DEFAULT_DAILY_TIME
    assert s.retention_days == bs.DEFAULT_RETENTION_DAYS


def test_load_settings_valid(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_BACKUP_DEBOUNCE_SECONDS", "10")
    monkeypatch.setenv("ROLL_CALL_BACKUP_MAX_WAIT_SECONDS", "120")
    monkeypatch.setenv("ROLL_CALL_DAILY_BACKUP_TIME", "23:45")
    monkeypatch.setenv("ROLL_CALL_BACKUP_RETENTION_DAYS", "7")
    s = bs.load_settings()
    assert s.debounce_seconds == 10
    assert s.max_wait_seconds == 120
    assert s.daily_time == time(23, 45)
    assert s.retention_days == 7


def test_enable_flags_fallback(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_ENABLE_BACKUP", raising=False)
    assert bs.backup_enabled() is True
    monkeypatch.setenv("ROLL_CALL_ENABLE_BACKUP", "0")
    assert bs.backup_enabled() is False
    monkeypatch.setenv("ROLL_CALL_ENABLE_BACKUP", "garbage")
    assert bs.backup_enabled() is True  # invalid -> default

    monkeypatch.delenv("ROLL_CALL_ENABLE_PRIMARY_DB_PREFLIGHT", raising=False)
    assert bs.primary_db_preflight_enabled() is True
    monkeypatch.setenv("ROLL_CALL_ENABLE_PRIMARY_DB_PREFLIGHT", "0")
    assert bs.primary_db_preflight_enabled() is False


def test_retry_constants():
    assert bs.LATEST_RETRY_SECONDS == 60
    assert bs.DAILY_RETRY_SECONDS == 300


# ---------------------------------------------------------------------------
# mutation hooks (idempotent install + commit/rollback behavior)
# ---------------------------------------------------------------------------

def _fresh_sessionmaker(tmp_path: Path):
    from sqlalchemy import Column, Integer, String, create_engine
    from sqlalchemy.orm import declarative_base, sessionmaker

    engine = create_engine(f"sqlite:///{tmp_path / 'hooktest.db'}")
    Base = declarative_base()

    class Row(Base):
        __tablename__ = "rows"
        id = Column(Integer, primary_key=True)
        v = Column(String)

    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine), Row


def test_hooks_idempotent_and_commit_marks_once(tmp_path: Path, monkeypatch):
    Session, Row = _fresh_sessionmaker(tmp_path)
    # Point install_mutation_hooks at our throwaway SessionLocal.
    monkeypatch.setattr("app.database.SessionLocal", Session, raising=False)
    monkeypatch.setattr(bs, "_hooks_installed", False)

    calls = {"n": 0}
    monkeypatch.setattr(bs, "mark_dirty", lambda: calls.__setitem__("n", calls["n"] + 1))

    bs.install_mutation_hooks()
    bs.install_mutation_hooks()  # second install must be idempotent

    s = Session()
    s.add(Row(v="a"))
    s.commit()
    s.close()

    # One commit -> marked exactly once (not twice despite the double install).
    assert calls["n"] == 1


def test_rollback_clears_flag_and_does_not_mark(tmp_path: Path, monkeypatch):
    Session, Row = _fresh_sessionmaker(tmp_path)
    monkeypatch.setattr("app.database.SessionLocal", Session, raising=False)
    monkeypatch.setattr(bs, "_hooks_installed", False)

    calls = {"n": 0}
    monkeypatch.setattr(bs, "mark_dirty", lambda: calls.__setitem__("n", calls["n"] + 1))
    bs.install_mutation_hooks()

    s = Session()
    s.add(Row(v="x"))
    s.flush()       # marks session.info has_mutation
    s.rollback()    # after_rollback clears the flag
    s.commit()      # nothing pending -> must NOT mark
    s.close()

    assert calls["n"] == 0


def test_readonly_query_does_not_mark(tmp_path: Path, monkeypatch):
    Session, Row = _fresh_sessionmaker(tmp_path)
    monkeypatch.setattr("app.database.SessionLocal", Session, raising=False)
    monkeypatch.setattr(bs, "_hooks_installed", False)

    calls = {"n": 0}
    monkeypatch.setattr(bs, "mark_dirty", lambda: calls.__setitem__("n", calls["n"] + 1))
    bs.install_mutation_hooks()

    s = Session()
    list(s.query(Row).all())  # read only
    s.commit()
    s.close()

    assert calls["n"] == 0


# ---------------------------------------------------------------------------
# retry rate limiting (async, driven via asyncio.run -- no pytest-asyncio dep)
# ---------------------------------------------------------------------------

def test_latest_loop_retry_is_rate_limited(tmp_path: Path, monkeypatch):
    captured: list[float] = []

    async def _run():
        sched = bs.BackupScheduler(
            _data_dir(tmp_path),
            bs.BackupSettings(debounce_seconds=0, max_wait_seconds=300),
        )
        sched._loop = asyncio.get_running_loop()
        sched._running = True
        sched.state.generation = 1  # dirty -> backup attempted immediately
        sched.state.first_dirty_mono = bs._monotonic()
        sched.state.last_commit_mono = bs._monotonic()
        sched._wake.set()

        monkeypatch.setattr(bs, "refresh_latest_backup", lambda d: None)  # always fail

        async def _fake_sleep(secs):
            captured.append(secs)
            sched._running = False
            raise asyncio.CancelledError

        monkeypatch.setattr(bs.asyncio, "sleep", _fake_sleep)
        with pytest.raises(asyncio.CancelledError):
            await sched._latest_loop()

    asyncio.run(_run())
    assert captured and captured[0] == bs.LATEST_RETRY_SECONDS


def test_daily_loop_retry_is_rate_limited(tmp_path: Path, monkeypatch):
    captured: list[float] = []

    async def _run():
        sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
        sched._running = True
        monkeypatch.setattr(bs, "create_daily_snapshot", lambda d, **k: None)
        monkeypatch.setattr(bs, "daily_due_now", lambda d, n, t: True)

        async def _fake_sleep(secs):
            captured.append(secs)
            sched._running = False
            raise asyncio.CancelledError

        monkeypatch.setattr(bs.asyncio, "sleep", _fake_sleep)
        with pytest.raises(asyncio.CancelledError):
            await sched._daily_loop()

    asyncio.run(_run())
    assert captured and captured[0] == bs.DAILY_RETRY_SECONDS


def test_daily_loop_before_daily_time_waits_without_creating(tmp_path: Path, monkeypatch):
    captured: list[float] = []
    calls = {"create": 0}

    async def _run():
        sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
        sched._running = True
        monkeypatch.setattr(bs, "daily_due_now", lambda d, n, t: False)
        monkeypatch.setattr(bs, "seconds_until_next_daily", lambda n, t: 123.0)

        def _create(*args, **kwargs):
            calls["create"] += 1
            return "app_2026-06-01.db"

        async def _fake_sleep(secs):
            captured.append(secs)
            sched._running = False
            raise asyncio.CancelledError

        monkeypatch.setattr(bs, "create_daily_snapshot", _create)
        monkeypatch.setattr(bs.asyncio, "sleep", _fake_sleep)
        with pytest.raises(asyncio.CancelledError):
            await sched._daily_loop()

    asyncio.run(_run())
    assert captured == [123.0]
    assert calls["create"] == 0


def test_daily_loop_creates_after_daily_time_arrives(tmp_path: Path, monkeypatch):
    captured: list[float] = []
    order: list[str] = []
    due_values = iter([False, True, False])

    async def _run():
        sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
        sched._running = True
        monkeypatch.setattr(bs, "daily_due_now", lambda d, n, t: next(due_values))
        monkeypatch.setattr(bs, "seconds_until_next_daily", lambda n, t: 10.0)

        def _create(*args, **kwargs):
            order.append("create")
            return "app_2026-06-01.db"

        async def _fake_sleep(secs):
            captured.append(secs)
            order.append("sleep")
            if len(captured) == 1:
                return
            sched._running = False
            raise asyncio.CancelledError

        monkeypatch.setattr(bs, "create_daily_snapshot", _create)
        monkeypatch.setattr(bs.asyncio, "sleep", _fake_sleep)
        with pytest.raises(asyncio.CancelledError):
            await sched._daily_loop()

    asyncio.run(_run())
    assert captured == [10.0, 10.0]
    assert order == ["sleep", "create", "sleep"]


def test_daily_loop_after_daily_time_missing_catches_up_immediately(tmp_path: Path, monkeypatch):
    captured: list[float] = []
    order: list[str] = []
    due_values = iter([True, False])

    async def _run():
        sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
        sched._running = True
        monkeypatch.setattr(bs, "daily_due_now", lambda d, n, t: next(due_values))
        monkeypatch.setattr(bs, "seconds_until_next_daily", lambda n, t: 86400.0)

        def _create(*args, **kwargs):
            order.append("create")
            return "app_2026-06-01.db"

        async def _fake_sleep(secs):
            captured.append(secs)
            order.append("sleep")
            sched._running = False
            raise asyncio.CancelledError

        monkeypatch.setattr(bs, "create_daily_snapshot", _create)
        monkeypatch.setattr(bs.asyncio, "sleep", _fake_sleep)
        with pytest.raises(asyncio.CancelledError):
            await sched._daily_loop()

    asyncio.run(_run())
    assert captured == [86400.0]
    assert order == ["create", "sleep"]


def test_scheduler_stop_is_best_effort_on_final_refresh_failure(tmp_path: Path, monkeypatch):
    """stop() must complete even if the final latest refresh raises."""
    async def _run():
        sched = bs.BackupScheduler(_data_dir(tmp_path), bs.BackupSettings())
        sched._loop = asyncio.get_running_loop()
        sched._running = True

        # No real loop tasks; make the final to_thread refresh raise.
        def _boom(d):
            raise RuntimeError("final refresh boom")

        monkeypatch.setattr(bs, "refresh_latest_backup", _boom)
        await sched.stop()  # must not raise

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# lifespan gating (preflight vs scheduler are independent)
# ---------------------------------------------------------------------------

def test_lifespan_backup_disabled_preflight_enabled_runs_preflight(monkeypatch, tmp_path):
    import app.main as main

    events: dict = {"preflight": None, "init": False, "start": 0, "stop": 0, "hooks": 0}
    fixed_dir = _data_dir(tmp_path)

    monkeypatch.setattr(main, "get_data_dir", lambda: fixed_dir)
    monkeypatch.setattr(main.backup_service, "backup_enabled", lambda: False)
    monkeypatch.setattr(main.backup_service, "primary_db_preflight_enabled", lambda: True)
    monkeypatch.setattr(main.backup_service, "preflight_primary_db",
                        lambda d: events.__setitem__("preflight", d))
    monkeypatch.setattr(main, "init_db", lambda: events.__setitem__("init", True))
    monkeypatch.setattr(main.backup_service, "install_mutation_hooks",
                        lambda: events.__setitem__("hooks", events["hooks"] + 1))

    async def _run():
        async with main.lifespan(main.app):
            pass

    asyncio.run(_run())

    assert events["preflight"] == fixed_dir   # preflight ran despite backup disabled
    assert events["init"] is True
    assert events["start"] == 0               # scheduler never started
    assert events["hooks"] == 0               # hooks not installed when backup disabled


def test_lifespan_backup_enabled_starts_and_stops_with_same_dir(monkeypatch, tmp_path):
    import app.main as main

    fixed_dir = _data_dir(tmp_path)
    seen: dict = {"start_dir": None, "stop_obj": None, "preflight": 0, "hooks": 0}
    sentinel = object()

    async def _fake_start(d):
        seen["start_dir"] = d
        return sentinel

    async def _fake_stop(s):
        seen["stop_obj"] = s

    monkeypatch.setattr(main, "get_data_dir", lambda: fixed_dir)
    monkeypatch.setattr(main.backup_service, "backup_enabled", lambda: True)
    monkeypatch.setattr(main.backup_service, "primary_db_preflight_enabled", lambda: True)
    monkeypatch.setattr(main.backup_service, "preflight_primary_db",
                        lambda d: seen.__setitem__("preflight", seen["preflight"] + 1))
    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main.backup_service, "install_mutation_hooks",
                        lambda: seen.__setitem__("hooks", seen["hooks"] + 1))
    monkeypatch.setattr(main.backup_service, "start", _fake_start)
    monkeypatch.setattr(main.backup_service, "stop", _fake_stop)

    async def _run():
        async with main.lifespan(main.app):
            pass

    asyncio.run(_run())

    assert seen["preflight"] == 1
    assert seen["hooks"] == 1
    assert seen["start_dir"] is fixed_dir       # start got the resolved dir
    assert seen["stop_obj"] is sentinel         # stop got the scheduler from start
