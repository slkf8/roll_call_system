"""Backend runtime configuration.

All helpers read environment variables on each call so tests can monkeypatch
freely without import-order surprises. No caching.

Optional environment variables:
  ROLL_CALL_DATA_DIR         Directory for SQLite app.db (default: backend/data)
  ROLL_CALL_ALLOWED_ORIGINS  Comma-separated CORS origins
                             (default: localhost:5173 + 127.0.0.1:5173)
  ROLL_CALL_HOST / HOST      Bind host (default: 127.0.0.1)
  ROLL_CALL_PORT / PORT      Bind port (default: 8000)
"""
from __future__ import annotations

import os
from pathlib import Path


_DEV_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_DEFAULT_ALLOWED_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8000


def get_data_dir() -> Path:
    """Return the data directory, creating it if needed.

    Honors ROLL_CALL_DATA_DIR. Falls back to <repo>/backend/data in dev mode.
    """
    raw = os.getenv("ROLL_CALL_DATA_DIR")
    target = Path(raw).expanduser() if raw else _DEV_DATA_DIR
    target.mkdir(parents=True, exist_ok=True)
    return target


def get_database_url() -> str:
    """SQLite URL for the app database, anchored at the data directory."""
    return f"sqlite:///{get_data_dir() / 'app.db'}"


def get_allowed_origins() -> list[str]:
    """Return CORS allowed origins.

    Honors ROLL_CALL_ALLOWED_ORIGINS (comma-separated). Falls back to dev
    Vite origins if the env var is missing or evaluates to an empty list
    after trimming.
    """
    raw = os.getenv("ROLL_CALL_ALLOWED_ORIGINS")
    if raw is None:
        return list(_DEFAULT_ALLOWED_ORIGINS)
    parts = [p.strip() for p in raw.split(",")]
    origins = [p for p in parts if p]
    return origins or list(_DEFAULT_ALLOWED_ORIGINS)


def get_host() -> str:
    """Bind host. Precedence: ROLL_CALL_HOST > HOST > 127.0.0.1."""
    return os.getenv("ROLL_CALL_HOST") or os.getenv("HOST") or _DEFAULT_HOST


def get_port() -> int:
    """Bind port. Precedence: ROLL_CALL_PORT > PORT > 8000.

    Raises ValueError on a non-integer or out-of-range value (1-65535) to
    fail fast in production runners; silent fallback would mask deployment
    misconfigurations.
    """
    raw = os.getenv("ROLL_CALL_PORT") or os.getenv("PORT")
    if raw is None or raw == "":
        return _DEFAULT_PORT
    try:
        port = int(raw)
    except ValueError as exc:
        raise ValueError(f"Invalid port value: {raw!r}") from exc
    if not 1 <= port <= 65535:
        raise ValueError(f"Port out of valid range (1-65535): {port}")
    return port
