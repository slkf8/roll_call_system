"""Port-independent OS-level lifecycle lock for the Roll Call backend.

A single advisory exclusive lock on ``data/app.lock`` is the primary gate that
prevents the maintenance ``restore`` from running while the backend is live,
regardless of which port the backend was started on. It also prevents two
backend instances from running against the same data directory.

Why an OS advisory file lock (vs the existing /health probe + SQLite
``BEGIN EXCLUSIVE`` defences):

* Port-independent: the health probe needs the right host/port; the lock does
  not. An idle backend may also hold no SQLite write lock. The file lock is
  held for the whole process lifetime regardless.
* Self-healing: advisory locks held via an open file descriptor are released
  by the OS automatically when the process exits (even on crash), so a dead
  process never leaves the lock falsely held.

Cross-platform, standard library only (no third-party dependency):
* POSIX / macOS: ``fcntl.flock(fd, LOCK_EX | LOCK_NB)``.
* Windows: ``msvcrt.locking(fd, LK_NBLCK, 1)`` over a 1-byte region at offset 0.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger("rollcall.applock")

try:  # POSIX / macOS
    import fcntl  # type: ignore
    _HAVE_FCNTL = True
except ImportError:  # pragma: no cover - exercised on Windows only
    _HAVE_FCNTL = False

try:  # Windows
    import msvcrt  # type: ignore
    _HAVE_MSVCRT = True
except ImportError:
    _HAVE_MSVCRT = False


LOCK_FILENAME = "app.lock"

_FALSY = frozenset({"0", "false", "no", ""})


class AppLockError(Exception):
    """Raised when the lifecycle lock cannot be acquired."""


def app_lock_enabled() -> bool:
    """Whether the *FastAPI lifespan* should acquire the lock. Default: enabled.

    ``ROLL_CALL_ENABLE_APP_LOCK=0`` is **TESTS ONLY**: it disables lifespan
    acquisition so TestClient-driven tests never create ``app.lock`` in the real
    data directory. It is NOT a maintenance/operations toggle.

    Scope guarantees:
      * Only :func:`app.main.lifespan` consults this flag.
      * :func:`app.services.restore_service.restore_backup` NEVER reads this
        flag and ALWAYS attempts to acquire the lifecycle lock.
      * The restore lifecycle-lock gate can therefore never be skipped — not by
        this env var, not by anything else.
    """
    raw = os.getenv("ROLL_CALL_ENABLE_APP_LOCK")
    if raw is None:
        return True
    return raw.strip().lower() not in _FALSY


class AppLock:
    """Non-blocking exclusive lock backed by ``<data_dir>/app.lock``.

    Holding the open file descriptor *is* holding the lock. ``release`` is safe
    to call repeatedly and is a no-op when the lock is not held.
    """

    def __init__(self, data_dir: Path | str):
        self.path = Path(data_dir) / LOCK_FILENAME
        self._fd: int | None = None

    @property
    def locked(self) -> bool:
        return self._fd is not None

    def acquire(self) -> bool:
        """Try to take the lock without blocking.

        Returns True if acquired (or already held by this instance), False if
        another open file description currently holds it.
        """
        if self._fd is not None:
            return True

        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(self.path), os.O_RDWR | os.O_CREAT, 0o644)
        try:
            if _HAVE_FCNTL:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except OSError:
                    os.close(fd)
                    return False
            elif _HAVE_MSVCRT:  # pragma: no cover - Windows-only path
                # Windows byte-range locking needs at least one byte and the
                # file pointer positioned at the byte being locked (offset 0).
                if os.fstat(fd).st_size == 0:
                    os.write(fd, b"\0")
                os.lseek(fd, 0, os.SEEK_SET)
                try:
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                except OSError:
                    os.close(fd)
                    return False
            else:  # pragma: no cover - no locking primitive available
                os.close(fd)
                raise RuntimeError("no file-locking primitive available")
        except Exception:
            try:
                os.close(fd)
            except OSError:
                pass
            raise

        self._fd = fd
        return True

    def release(self) -> None:
        """Release the lock if held. Safe to call multiple times."""
        fd = self._fd
        if fd is None:
            return
        self._fd = None
        try:
            if _HAVE_FCNTL:
                try:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                except OSError:
                    logger.exception("flock unlock failed for %s", self.path)
            elif _HAVE_MSVCRT:  # pragma: no cover - Windows-only path
                try:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                except OSError:
                    logger.exception("msvcrt unlock failed for %s", self.path)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass

    def __enter__(self) -> "AppLock":
        if not self.acquire():
            raise AppLockError(f"could not acquire application lock: {self.path}")
        return self

    def __exit__(self, *exc_info) -> None:
        self.release()
