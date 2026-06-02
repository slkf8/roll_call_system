from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_database_url


DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_session_materials_columns() -> None:
    """Additive migration for the materials feature on existing databases.

    ``create_all`` only creates missing tables; it never alters an existing
    one. Older ``sessions`` tables predate the materials columns, so add them
    in place when absent. Columns are additive only (no CHECK constraints) so
    new and upgraded databases behave identically — the materials invariants
    are enforced at the schema/router layer, not by the DB.
    """
    inspector = inspect(engine)
    if "sessions" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("sessions")}
    statements: list[str] = []
    if "materials_provided" not in existing:
        statements.append(
            "ALTER TABLE sessions "
            "ADD COLUMN materials_provided INTEGER NOT NULL DEFAULT 0"
        )
    if "materials_reason_code" not in existing:
        statements.append(
            "ALTER TABLE sessions ADD COLUMN materials_reason_code INTEGER"
        )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_session_materials_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
