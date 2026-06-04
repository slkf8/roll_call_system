"""Tests for the port-independent lifecycle lock and its lifespan wiring.

All locks live under tmp_path; the production backend/data dir is never used.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.services.app_lock import AppLock, AppLockError, LOCK_FILENAME, app_lock_enabled


# ---------------------------------------------------------------------------
# AppLock primitive
# ---------------------------------------------------------------------------

def test_acquire_succeeds_and_creates_lock_file(tmp_path: Path):
    lock = AppLock(tmp_path)
    assert lock.acquire() is True
    assert lock.locked is True
    assert (tmp_path / LOCK_FILENAME).is_file()
    lock.release()


def test_second_acquire_is_denied_while_held(tmp_path: Path):
    a = AppLock(tmp_path)
    b = AppLock(tmp_path)
    assert a.acquire() is True
    try:
        assert b.acquire() is False
        assert b.locked is False
    finally:
        a.release()


def test_reacquire_after_release(tmp_path: Path):
    a = AppLock(tmp_path)
    assert a.acquire() is True
    a.release()
    assert a.locked is False

    b = AppLock(tmp_path)
    assert b.acquire() is True  # free again
    b.release()


def test_repeated_release_is_safe(tmp_path: Path):
    lock = AppLock(tmp_path)
    lock.acquire()
    lock.release()
    lock.release()  # must not raise
    lock.release()
    assert lock.locked is False


def test_same_instance_double_acquire_is_idempotent(tmp_path: Path):
    lock = AppLock(tmp_path)
    assert lock.acquire() is True
    assert lock.acquire() is True  # already held -> still True
    lock.release()


def test_lock_file_is_in_given_data_dir(tmp_path: Path):
    data_dir = tmp_path / "data"
    lock = AppLock(data_dir)
    lock.acquire()
    try:
        assert lock.path == data_dir / LOCK_FILENAME
        assert lock.path.is_file()
    finally:
        lock.release()


def test_context_manager_acquires_and_releases(tmp_path: Path):
    with AppLock(tmp_path) as lock:
        assert lock.locked is True
        assert AppLock(tmp_path).acquire() is False  # contended
    # released on exit
    other = AppLock(tmp_path)
    assert other.acquire() is True
    other.release()


def test_context_manager_raises_when_contended(tmp_path: Path):
    holder = AppLock(tmp_path)
    holder.acquire()
    try:
        with pytest.raises(AppLockError):
            with AppLock(tmp_path):
                pass
    finally:
        holder.release()


def test_app_lock_enabled_default_and_toggle(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_ENABLE_APP_LOCK", raising=False)
    assert app_lock_enabled() is True
    monkeypatch.setenv("ROLL_CALL_ENABLE_APP_LOCK", "0")
    assert app_lock_enabled() is False
    monkeypatch.setenv("ROLL_CALL_ENABLE_APP_LOCK", "1")
    assert app_lock_enabled() is True


# ---------------------------------------------------------------------------
# lifespan wiring (acquire before init, release after final refresh)
# ---------------------------------------------------------------------------

def _stub_lifespan(monkeypatch, tmp_path: Path, *, enable_lock: bool):
    """Point main.lifespan at a tmp data dir with cheap stubs. Returns events."""
    import app.main as main

    monkeypatch.setenv("ROLL_CALL_ENABLE_APP_LOCK", "1" if enable_lock else "0")
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(main, "get_data_dir", lambda: data_dir)
    monkeypatch.setattr(main.backup_service, "backup_enabled", lambda: True)
    monkeypatch.setattr(main.backup_service, "primary_db_preflight_enabled", lambda: True)
    monkeypatch.setattr(main.backup_service, "preflight_primary_db", lambda d: None)
    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main.backup_service, "install_mutation_hooks", lambda: None)
    return main, data_dir


def test_lifespan_acquires_and_releases(monkeypatch, tmp_path: Path):
    main, data_dir = _stub_lifespan(monkeypatch, tmp_path, enable_lock=True)
    events = {"lock_held_during_stop": None}

    async def _fake_start(d):
        return object()

    async def _fake_stop(_s):
        # Final refresh runs here: the lifecycle lock must still be held.
        probe = AppLock(data_dir)
        events["lock_held_during_stop"] = probe.acquire() is False
        if probe.locked:
            probe.release()

    monkeypatch.setattr(main.backup_service, "start", _fake_start)
    monkeypatch.setattr(main.backup_service, "stop", _fake_stop)

    async def _run():
        async with main.lifespan(main.app):
            assert (data_dir / LOCK_FILENAME).is_file()
            # held during the live phase
            assert AppLock(data_dir).acquire() is False

    asyncio.run(_run())

    # Held during shutdown final refresh, released afterwards.
    assert events["lock_held_during_stop"] is True
    after = AppLock(data_dir)
    assert after.acquire() is True
    after.release()


def test_lifespan_fails_when_already_locked(monkeypatch, tmp_path: Path):
    main, data_dir = _stub_lifespan(monkeypatch, tmp_path, enable_lock=True)
    init_called = {"n": 0}
    monkeypatch.setattr(main, "init_db", lambda: init_called.__setitem__("n", init_called["n"] + 1))

    holder = AppLock(data_dir)
    assert holder.acquire() is True
    try:
        async def _run():
            async with main.lifespan(main.app):
                pass

        with pytest.raises(RuntimeError):
            asyncio.run(_run())
        assert init_called["n"] == 0  # never initialized DB
    finally:
        holder.release()


def test_lifespan_startup_failure_still_releases_lock(monkeypatch, tmp_path: Path):
    main, data_dir = _stub_lifespan(monkeypatch, tmp_path, enable_lock=True)

    def _boom():
        raise RuntimeError("init boom")

    monkeypatch.setattr(main, "init_db", _boom)

    async def _run():
        async with main.lifespan(main.app):
            pass

    with pytest.raises(RuntimeError):
        asyncio.run(_run())

    # Lock released despite the startup failure.
    after = AppLock(data_dir)
    assert after.acquire() is True
    after.release()


def test_lifespan_disabled_creates_no_lock_file(monkeypatch, tmp_path: Path):
    main, data_dir = _stub_lifespan(monkeypatch, tmp_path, enable_lock=False)

    async def _fake_start(d):
        return object()

    async def _fake_stop(_s):
        return None

    monkeypatch.setattr(main.backup_service, "start", _fake_start)
    monkeypatch.setattr(main.backup_service, "stop", _fake_stop)

    async def _run():
        async with main.lifespan(main.app):
            pass

    asyncio.run(_run())
    assert not (data_dir / LOCK_FILENAME).exists()
