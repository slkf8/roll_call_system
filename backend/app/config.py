"""Backend runtime configuration.

All helpers read environment variables on each call so tests can monkeypatch
freely without import-order surprises. No caching.

Optional environment variables:
  ROLL_CALL_DATA_DIR         Directory for SQLite app.db.
                             Highest priority — overrides packaged/dev fallback.
  ROLL_CALL_PACKAGED         Force packaged mode (1/true/yes) or source mode
                             (0/false/no). When unset, falls back to
                             sys.frozen (set by PyInstaller).
  ROLL_CALL_FRONTEND_DIST    Directory containing built frontend assets.
                             Highest priority — overrides packaged/dev defaults.
  ROLL_CALL_ALLOWED_ORIGINS  Comma-separated CORS origins
                             (default: localhost:5173 + 127.0.0.1:5173).
  ROLL_CALL_HOST / HOST      Bind host (default: 127.0.0.1).
  ROLL_CALL_PORT / PORT      Bind port (default: 8000).

Data directory resolution (highest priority first):
  1. ROLL_CALL_DATA_DIR if set.
  2. Packaged mode -> Path(sys.executable).resolve().parent / "data".
     The data folder sits next to the binary so the whole folder is portable
     -- copy/move the bundle directory and the database goes with it.
  3. Dev source mode -> <repo>/backend/data.

Frontend dist resolution (highest priority first):
  1. ROLL_CALL_FRONTEND_DIST if set and the directory exists.
  2. Packaged mode -> sys._MEIPASS / "frontend_dist" when present.
  3. Dev source mode -> <repo>/frontend/dist when it exists.
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path


_DEV_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_DEFAULT_ALLOWED_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8000

_TRUTHY_ENV_VALUES = frozenset({"1", "true", "yes"})
_FALSY_ENV_VALUES = frozenset({"0", "false", "no"})


def _is_packaged() -> bool:
    """Detect whether the app is running as a packaged binary.

    Precedence:
      1. ROLL_CALL_PACKAGED env var. Accepts 1/true/yes (case-insensitive) for
         packaged mode and 0/false/no for source mode. Any other non-empty
         value raises ValueError to surface deployment misconfigurations.
      2. PyInstaller's ``sys.frozen`` attribute when the env var is unset.
    """
    raw = os.getenv("ROLL_CALL_PACKAGED")
    if raw is not None and raw != "":
        normalized = raw.strip().lower()
        if normalized in _TRUTHY_ENV_VALUES:
            return True
        if normalized in _FALSY_ENV_VALUES:
            return False
        raise ValueError(
            f"Invalid ROLL_CALL_PACKAGED value: {raw!r}. "
            "Use 1/true/yes or 0/false/no."
        )
    return getattr(sys, "frozen", False)


def get_data_dir() -> Path:
    """Return the data directory, creating it if needed.

    Resolution order:
      1. ROLL_CALL_DATA_DIR (always wins).
      2. Packaged mode: <executable's resolved parent>/data. The bundle is
         portable -- moving the folder takes the database along. ``.resolve()``
         follows symlinks so data tracks the real binary, not the link.
      3. <repo>/backend/data in dev source mode.
    """
    raw = os.getenv("ROLL_CALL_DATA_DIR")
    if raw:
        target = Path(raw).expanduser()
    elif _is_packaged():
        target = Path(sys.executable).resolve().parent / "data"
    else:
        target = _DEV_DATA_DIR

    target.mkdir(parents=True, exist_ok=True)
    return target


def get_database_url() -> str:
    """SQLite URL for the app database, anchored at the data directory."""
    return f"sqlite:///{get_data_dir() / 'app.db'}"


def data_dir_fingerprint(data_dir: Path | str | None = None) -> str:
    """Short, non-reversible identity of a resolved data directory.

    Shared by ``/health`` and the restore CLI's health probe so a responding
    backend can be matched to the *same* data directory without exposing the
    path. Returns a 16-char hex SHA-256 prefix of the resolved path. When
    ``data_dir`` is None the active data directory is used. Symlinks and
    ``..`` segments are normalized via ``resolve()`` so equivalent paths map to
    the same fingerprint.
    """
    target = get_data_dir() if data_dir is None else Path(data_dir).expanduser()
    return hashlib.sha256(str(target.resolve()).encode("utf-8")).hexdigest()[:16]


def get_frontend_dist_dir() -> Path | None:
    """Locate the built frontend assets directory if available.

    Resolution order (first existing directory wins):
      1. ROLL_CALL_FRONTEND_DIST env var.
      2. Packaged mode -> ``sys._MEIPASS / "frontend_dist"`` (PyInstaller).
      3. Dev source mode -> ``<repo>/frontend/dist``.

    Returns ``None`` if no resolved path exists. Callers decide how to
    react (dev: warn and skip mounting; packaged: fail fast).
    """
    raw = os.getenv("ROLL_CALL_FRONTEND_DIST")
    if raw:
        candidate = Path(raw).expanduser()
        return candidate if candidate.is_dir() else None

    if _is_packaged():
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidate = Path(meipass) / "frontend_dist"
            return candidate if candidate.is_dir() else None
        return None

    # Dev source mode -> <repo>/frontend/dist
    candidate = (
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    )
    return candidate if candidate.is_dir() else None


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
