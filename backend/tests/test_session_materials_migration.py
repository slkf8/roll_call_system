"""Additive migration: existing sessions tables gain materials columns."""
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

import app.database as database


def _build_legacy_sessions_table(engine) -> None:
    """Create a pre-materials ``sessions`` table (no materials columns)."""
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER,
                    date_iso VARCHAR NOT NULL,
                    start VARCHAR NOT NULL,
                    duration_min INTEGER NOT NULL DEFAULT 60,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    reason VARCHAR,
                    note VARCHAR,
                    kind VARCHAR NOT NULL DEFAULT 'regular',
                    makeup_of_date_iso VARCHAR,
                    makeup_of_session_id INTEGER,
                    schedule_rule_id INTEGER,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        connection.execute(
            text(
                "INSERT INTO sessions (date_iso, start) VALUES ('2026-05-20', '16:00')"
            )
        )


def test_migration_adds_materials_columns_with_safe_defaults(tmp_path: Path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'legacy.db'}",
        connect_args={"check_same_thread": False},
    )
    _build_legacy_sessions_table(engine)

    columns_before = {c["name"] for c in inspect(engine).get_columns("sessions")}
    assert "materials_provided" not in columns_before
    assert "materials_reason_code" not in columns_before

    monkeypatch.setattr(database, "engine", engine)
    database.ensure_session_materials_columns()

    columns_after = {c["name"] for c in inspect(engine).get_columns("sessions")}
    assert "materials_provided" in columns_after
    assert "materials_reason_code" in columns_after

    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT materials_provided, materials_reason_code FROM sessions"
            )
        ).one()
    assert row[0] == 0
    assert row[1] is None


def test_migration_is_idempotent(tmp_path: Path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'legacy.db'}",
        connect_args={"check_same_thread": False},
    )
    _build_legacy_sessions_table(engine)

    monkeypatch.setattr(database, "engine", engine)
    database.ensure_session_materials_columns()
    # Second call must be a no-op (columns already present).
    database.ensure_session_materials_columns()

    columns = {c["name"] for c in inspect(engine).get_columns("sessions")}
    assert "materials_provided" in columns
    assert "materials_reason_code" in columns
