"""Tests for the run.py maintenance CLI dispatch.

No real server is started and the production data dir is never touched; tests
point ROLL_CALL_DATA_DIR at tmp_path.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

import run
from app.services import restore_service as rs


def _make_valid_db(path: Path, marker: str = "A") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path))
    try:
        con.execute("CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)")
        con.execute("CREATE TABLE student_schedule_rules (id INTEGER PRIMARY KEY)")
        con.execute("CREATE TABLE sessions (id INTEGER PRIMARY KEY)")
        con.execute("CREATE TABLE global_events (id INTEGER PRIMARY KEY)")
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


@pytest.fixture
def data_env(tmp_path: Path, monkeypatch):
    data = tmp_path / "data"
    (data / "backups").mkdir(parents=True)
    monkeypatch.setenv("ROLL_CALL_DATA_DIR", str(data))
    return data


# ---------------------------------------------------------------------------
# No-args -> server path (without actually starting uvicorn)
# ---------------------------------------------------------------------------

def test_no_args_runs_server(monkeypatch):
    called = {"ran": False}

    def _fake_server() -> int:
        called["ran"] = True
        return 0

    monkeypatch.setattr(run, "_run_server", _fake_server)
    assert run.main([]) == 0
    assert called["ran"] is True


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------

def test_cli_list(data_env, capsys):
    _make_valid_db(data_env / "backups" / "app_latest.db")
    rc = run.main(["list"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "app_latest.db" in out
    assert "latest" in out


def test_cli_list_empty(data_env, capsys):
    rc = run.main(["list"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "No backups" in out


# ---------------------------------------------------------------------------
# validate
# ---------------------------------------------------------------------------

def test_cli_validate_success(data_env, capsys):
    _make_valid_db(data_env / "backups" / "app_latest.db")
    rc = run.main(["validate", "app_latest.db"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "OK" in out


def test_cli_validate_failure(data_env, capsys):
    # well-formed name but file missing -> exit 1
    rc = run.main(["validate", "app_2099-01-01.db"])
    err = capsys.readouterr().err
    assert rc == 1
    assert "INVALID" in err


# ---------------------------------------------------------------------------
# restore
# ---------------------------------------------------------------------------

def test_cli_restore_success(data_env, capsys, monkeypatch):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    # Don't let the real health probe / box listener decide.
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)

    rc = run.main(["restore", "app_latest.db"])
    out = capsys.readouterr().out

    assert rc == 0
    assert "RESTORED" in out
    assert _markers(data_env / "app.db") == ["B"]


def test_cli_restore_failure(data_env, capsys, monkeypatch):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    # Simulate the service still running -> refusal -> exit 1.
    monkeypatch.setattr(rs, "_service_health_running", lambda d: True)

    rc = run.main(["restore", "app_latest.db"])
    err = capsys.readouterr().err

    assert rc == 1
    assert "RESTORE FAILED" in err
    assert _markers(data_env / "app.db") == ["A"]  # untouched


def test_cli_restore_rollback_clean_reports_failure_not_critical(
    data_env, capsys, monkeypatch
):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    # Post-replace verify fails; the real rollback succeeds.
    monkeypatch.setattr(
        rs, "_verify_restored_primary",
        lambda p: (_ for _ in ()).throw(rs.RestoreError("post fail")),
    )

    rc = run.main(["restore", "app_latest.db"])
    err = capsys.readouterr().err

    assert rc == 1
    assert "RESTORE FAILED" in err
    assert "CRITICAL" not in err
    assert "rolled back" in err.lower()
    assert _markers(data_env / "app.db") == ["A"]  # back to original


def test_cli_restore_rollback_failed_reports_critical(data_env, capsys, monkeypatch):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    monkeypatch.setattr(
        rs, "_verify_restored_primary",
        lambda p: (_ for _ in ()).throw(rs.RestoreError("post fail")),
    )
    monkeypatch.setattr(rs, "_rollback", lambda d, e: "failed")

    rc = run.main(["restore", "app_latest.db"])
    err = capsys.readouterr().err

    assert rc == 1
    assert "CRITICAL" in err
    assert "app_before_restore_" in err  # emergency filename surfaced
    assert "DO NOT start the app" in err


def test_cli_restore_history_write_failure_warns_but_succeeds(
    data_env, capsys, monkeypatch
):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    monkeypatch.setattr(rs, "_append_history", lambda d, e: False)

    rc = run.main(["restore", "app_latest.db"])
    out = capsys.readouterr().out

    assert rc == 0  # restore still succeeds
    assert "RESTORED" in out
    assert "WARNING" in out
    assert _markers(data_env / "app.db") == ["B"]


# ---------------------------------------------------------------------------
# history
# ---------------------------------------------------------------------------

def test_cli_history(data_env, capsys, monkeypatch):
    _make_valid_db(data_env / "app.db", "A")
    _make_valid_db(data_env / "backups" / "app_latest.db", "B")
    monkeypatch.setattr(rs, "_service_health_running", lambda d: False)
    run.main(["restore", "app_latest.db"])
    capsys.readouterr()  # drain restore output

    rc = run.main(["history"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "success" in out
    assert "app_latest.db" in out


def test_cli_history_empty(data_env, capsys):
    rc = run.main(["history"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "No restore history" in out


# ---------------------------------------------------------------------------
# argument errors / usage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "argv",
    [
        ["validate"],            # missing filename
        ["restore"],            # missing filename
        ["validate", "a", "b"],  # too many args
        ["list", "extra"],       # list takes no args
        ["history", "extra"],    # history takes no args
        ["bogus"],               # unknown command
    ],
)
def test_cli_arg_errors_exit_2(argv, capsys):
    rc = run.main(argv)
    assert rc == 2
    assert "Usage" in capsys.readouterr().err


def test_cli_help_exit_0(capsys):
    rc = run.main(["--help"])
    assert rc == 0
    assert "Usage" in capsys.readouterr().out
