"""Production entrypoint for the Roll Call backend.

Runs uvicorn without --reload and pre-populates production CORS origins so
the same-port frontend (served from /) can talk to the API at /api/... .

Use this for packaged builds (PyInstaller) and any "real" launch. Dev
workflow continues to use ``uvicorn app.main:app --reload`` which does not
go through this module.
"""
from __future__ import annotations

import os

import uvicorn

from app.config import get_host, get_port


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


def main() -> None:
    host = get_host()
    port = get_port()
    _ensure_production_cors_origins(port)

    # Import the FastAPI app AFTER the CORS env is in place so that
    # CORSMiddleware picks up the production origins at module load.
    from app.main import app

    print(f"Roll Call backend listening on http://{host}:{port}")
    print("Open the URL above in your browser. Press Ctrl+C to stop.")
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
