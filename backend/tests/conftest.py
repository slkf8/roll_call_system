"""Shared pytest fixtures / test-environment defaults.

The backup scheduler and the primary-DB-missing preflight are disabled for
the whole test session so importing the app / using TestClient(app) never
spins up background backup tasks or writes to backend/data. Individual backup
tests exercise the service functions directly against tmp_path instead.
"""
import os

import pytest


@pytest.fixture(autouse=True)
def _disable_backup_subsystem(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_ENABLE_BACKUP", "0")
    monkeypatch.setenv("ROLL_CALL_ENABLE_PRIMARY_DB_PREFLIGHT", "0")
    yield
