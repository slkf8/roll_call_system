"""Production entrypoint for the Roll Call backend.

With no arguments this runs uvicorn without --reload and pre-populates
production CORS origins so the same-port frontend (served from /) can talk to
the API at /api/... .

It also exposes a maintenance-only repair CLI (no app launch):

    roll_call_backend list                 # list available backups
    roll_call_backend validate <file>      # integrity-check a backup
    roll_call_backend restore  <file>      # safe atomic rollback of app.db
    roll_call_backend history              # show restore history

The CLI is a thin dispatch layer over app.services.restore_service; run it
from a Terminal with the app stopped. Use this for packaged builds
(PyInstaller) and any "real" launch. Dev workflow continues to use
``uvicorn app.main:app --reload`` which does not go through this module.
"""
from __future__ import annotations

import os
import sys

import uvicorn

from app.config import get_host, get_port


USAGE = """\
Usage:
  roll_call_backend                 Start the server (default).
  roll_call_backend list            List available backups.
  roll_call_backend validate <file> Validate a backup file (integrity + schema).
  roll_call_backend restore <file>  Restore app.db from a backup (app must be stopped).
  roll_call_backend history         Show restore history.

<file> must be a bare backup name inside data/backups/, e.g.:
  app_latest.db
  app_2026-06-04.db
  app_before_restore_2026-06-04_120000.db
"""


def _ensure_production_cors_origins(port: int) -> None:
    """Default ROLL_CALL_ALLOWED_ORIGINS to the bound port unless explicitly set.

    Same-port serving still triggers a CORS preflight when the page is loaded
    via ``localhost`` but the API call targets ``127.0.0.1`` (or vice versa)
    because browsers treat them as different origins. Pre-populating both
    avoids the surprise without forcing the user to manage env vars.

    Only ``setdefault`` semantics — if the user already set the env var
    (even to an empty string), we leave it alone.
    """
    if "ROLL_CALL_ALLOWED_ORIGINS" in os.environ:
        return
    os.environ["ROLL_CALL_ALLOWED_ORIGINS"] = (
        f"http://localhost:{port},http://127.0.0.1:{port}"
    )


def _run_server() -> int:
    host = get_host()
    port = get_port()
    _ensure_production_cors_origins(port)

    # Import the FastAPI app AFTER the CORS env is in place so that
    # CORSMiddleware picks up the production origins at module load.
    from app.main import app

    print(f"Roll Call backend listening on http://{host}:{port}")
    print("Open the URL above in your browser. Press Ctrl+C to stop.")
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")
    return 0


# ---------------------------------------------------------------------------
# Maintenance CLI handlers
# ---------------------------------------------------------------------------

def _cmd_list() -> int:
    from app.services import restore_service as rs

    backups = rs.list_backups()
    if not backups:
        print("No backups found.")
        return 0
    print(f"{'KIND':<10} {'FILENAME':<44} {'SIZE (bytes)':>14}")
    for entry in backups:
        print(f"{entry['kind']:<10} {entry['filename']:<44} {entry['size']:>14}")
    return 0


def _cmd_validate(filename: str) -> int:
    from app.services import restore_service as rs

    try:
        info = rs.validate_backup(filename)
    except rs.RestoreError as exc:
        print(f"INVALID: {exc}", file=sys.stderr)
        return 1
    print(f"OK: {filename} is a valid backup ({info['size']} bytes).")
    return 0


def _cmd_restore(filename: str) -> int:
    from app.services import restore_service as rs

    try:
        result = rs.restore_backup(filename)
    except rs.RestoreRollbackError as exc:
        if exc.rollback_result == "success":
            # Restore failed but app.db was cleanly returned to its prior state.
            print(f"RESTORE FAILED: {exc}", file=sys.stderr)
            print(
                "app.db was rolled back to its pre-restore state.",
                file=sys.stderr,
            )
            return 1
        # Rollback itself did not succeed -> loud, high-priority guidance.
        print("CRITICAL: restore FAILED and automatic rollback did NOT succeed.",
              file=sys.stderr)
        print("  app.db may be in an INCONSISTENT or UNCERTAIN state.",
              file=sys.stderr)
        if exc.emergency:
            print(f"  Pre-restore emergency backup: data/backups/{exc.emergency}",
                  file=sys.stderr)
        else:
            print("  No emergency backup is available.", file=sys.stderr)
        print("  DO NOT start the app.", file=sys.stderr)
        print("  Manual intervention is required to restore a known-good app.db.",
              file=sys.stderr)
        print(f"  Detail: {exc}", file=sys.stderr)
        return 1
    except rs.RestoreError as exc:
        print(f"RESTORE FAILED: {exc}", file=sys.stderr)
        return 1
    print(f"RESTORED app.db from {filename}.")
    if result.get("emergency"):
        print(f"  emergency backup saved: {result['emergency']}")
    if result.get("history_written") is False:
        print(
            "WARNING: restore succeeded, but the history log could not be "
            "written (restore is still complete)."
        )
    return 0


def _cmd_history() -> int:
    from app.services import restore_service as rs

    records = rs.read_history()
    if not records:
        print("No restore history.")
        return 0
    for record in records:
        line = (
            f"{record.get('timestamp', '?')}  "
            f"{record.get('result', '?'):<11} "
            f"source={record.get('source')}  "
            f"emergency={record.get('emergency')}"
        )
        if record.get("rollback_result"):
            line += f"  rollback={record['rollback_result']}"
        if record.get("error"):
            line += f"  error={record['error']}"
        print(line)
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)

    # No arguments -> normal server launch (unchanged behavior).
    if not argv:
        return _run_server()

    command, rest = argv[0], argv[1:]

    if command in ("-h", "--help", "help"):
        print(USAGE)
        return 0

    if command == "list":
        if rest:
            print(USAGE, file=sys.stderr)
            return 2
        return _cmd_list()

    if command == "validate":
        if len(rest) != 1:
            print(USAGE, file=sys.stderr)
            return 2
        return _cmd_validate(rest[0])

    if command == "restore":
        if len(rest) != 1:
            print(USAGE, file=sys.stderr)
            return 2
        return _cmd_restore(rest[0])

    if command == "history":
        if rest:
            print(USAGE, file=sys.stderr)
            return 2
        return _cmd_history()

    print(f"Unknown command: {command}\n", file=sys.stderr)
    print(USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
