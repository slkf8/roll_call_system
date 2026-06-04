"""Proves the test suite never touches the real backend/data tree.

These checks only inspect paths, filenames, and existence — they never open,
read, hash, or copy the production database.
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.database as db
from app.config import get_data_dir
from app.main import app


REPO_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_data_dir_env_points_at_tmp():
    raw = os.environ.get("ROLL_CALL_DATA_DIR")
    assert raw, "ROLL_CALL_DATA_DIR must be set for the test session"
    data_dir = Path(raw)
    assert data_dir.is_dir()
    assert data_dir.resolve() != REPO_DATA_DIR.resolve()


def test_get_data_dir_is_not_repo_data_dir():
    assert get_data_dir().resolve() == Path(os.environ["ROLL_CALL_DATA_DIR"]).resolve()
    assert get_data_dir().resolve() != REPO_DATA_DIR.resolve()


def test_import_time_engine_bound_to_tmp():
    # app.database fixes DATABASE_URL at import time; it must be the tmp dir.
    # Compare against the raw (unresolved) env value, since get_data_dir() does
    # not resolve symlinks (e.g. macOS /tmp -> /private/tmp) and DATABASE_URL
    # therefore keeps the unresolved path.
    tmp_raw = os.environ["ROLL_CALL_DATA_DIR"]
    assert tmp_raw in db.DATABASE_URL
    assert REPO_DATA_DIR.resolve().as_posix() not in db.DATABASE_URL


def test_lifespan_creates_app_db_in_tmp_not_repo():
    tmp = Path(os.environ["ROLL_CALL_DATA_DIR"]).resolve()
    # Entering the TestClient context runs the FastAPI lifespan -> init_db().
    with TestClient(app):
        pass
    # init_db created the tables in the tmp database.
    assert (tmp / "app.db").exists()
    # The real repo data dir got neither an app.lock (lock disabled in tests)
    # nor — checked by filename/existence only — any test-created artifacts.
    assert not (REPO_DATA_DIR / "app.lock").exists()


def test_repo_data_dir_has_no_lock_file():
    # Lifecycle lock is disabled for the suite, so app.lock must never appear
    # in the production data directory.
    assert not (REPO_DATA_DIR / "app.lock").exists()


# ---------------------------------------------------------------------------
# conftest must override an externally supplied (non-empty) ROLL_CALL_DATA_DIR.
# Driven via a child pytest process so conftest's module-level override runs
# against the sentinel env we inject.
# ---------------------------------------------------------------------------

_SENTINEL_ENV = "ROLLCALL_SUBPROC_OVERRIDE_CHECK"


def test_conftest_overrides_external_nonempty_sentinel():
    # A non-empty sentinel pointing at a harmless tmp dir (never backend/data).
    sentinel = tempfile.mkdtemp(prefix="rollcall-sentinel-")
    env = dict(os.environ)
    env["ROLL_CALL_DATA_DIR"] = sentinel
    env[_SENTINEL_ENV] = sentinel  # guard + carries the sentinel into the child

    proc = subprocess.run(
        [
            sys.executable, "-m", "pytest",
            "tests/test_data_isolation.py::test_subprocess_override_assert",
            "-q",
        ],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_subprocess_override_assert():
    """Runs only inside the override subprocess (guarded), else skipped."""
    sentinel = os.environ.get(_SENTINEL_ENV)
    if not sentinel:
        pytest.skip("only runs inside the override subprocess")
    # conftest overwrote the externally supplied sentinel with a fresh tmp dir.
    current = os.environ["ROLL_CALL_DATA_DIR"]
    assert "rollcall-tests-" in current
    assert current != sentinel
    # The import-time engine bound to the tmp dir, never the sentinel/backend.
    assert "rollcall-tests-" in db.DATABASE_URL
    assert sentinel not in db.DATABASE_URL
    assert REPO_DATA_DIR.resolve().as_posix() not in db.DATABASE_URL
