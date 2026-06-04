"""Shared pytest fixtures / test-environment defaults.

The backup scheduler, the primary-DB-missing preflight, and the lifecycle
lock are disabled for the whole test session so importing the app / using
TestClient(app) never spins up background backup tasks, nor creates
``app.lock`` / writes to backend/data. Individual service tests exercise the
functions directly against tmp_path instead.

Note: ``restore_backup`` always tries to take the lifecycle lock regardless of
ROLL_CALL_ENABLE_APP_LOCK; restore tests run against a tmp data dir so that
lock lands under tmp, never in backend/data.

Data-directory isolation (critical): ``app.database`` binds its engine to
``get_database_url()`` at *import time*. Test modules import ``app.main`` at
collection time, so the engine path is fixed before any fixture runs. To keep
``init_db()`` / the lifecycle lock / any incidental DB access off the real
``backend/data`` tree, ``ROLL_CALL_DATA_DIR`` must point at a throwaway dir
*before* the first ``app.*`` import. conftest.py is imported before the test
modules in its directory, so we set it here at module import time (not in a
fixture, which would be too late). The suite does NOT trust any externally
supplied ROLL_CALL_DATA_DIR (unset / empty / any path): it unconditionally
creates a fresh ``rollcall-tests-*`` tmp dir and overwrites the env var.
"""
import os
import tempfile

import pytest

# MUST run at import time, before any `from app... import ...` in test modules.
# The test suite never trusts an externally supplied ROLL_CALL_DATA_DIR
# (unset / empty / any path): it unconditionally creates a fresh throwaway tmp
# dir and overwrites the env var, so app.database's import-time engine can only
# ever bind to a pytest tmp dir and never to the real backend/data tree.
_TEST_DATA_DIR = tempfile.mkdtemp(prefix="rollcall-tests-")
os.environ["ROLL_CALL_DATA_DIR"] = _TEST_DATA_DIR


@pytest.fixture(autouse=True)
def _disable_backup_subsystem(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_ENABLE_BACKUP", "0")
    monkeypatch.setenv("ROLL_CALL_ENABLE_PRIMARY_DB_PREFLIGHT", "0")
    monkeypatch.setenv("ROLL_CALL_ENABLE_APP_LOCK", "0")
    yield
