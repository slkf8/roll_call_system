import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    _is_packaged,
    data_dir_fingerprint,
    get_allowed_origins,
    get_data_dir,
    get_frontend_dist_dir,
)
from app.database import init_db
from app.routers import exports, global_events, schedule_rules, sessions, statistics, students
from app.services import app_lock, backup_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Resolve the data dir once and reuse the same Path for start + stop.
    backup_data_dir = get_data_dir()
    backup_enabled = backup_service.backup_enabled()
    preflight_enabled = backup_service.primary_db_preflight_enabled()

    # Acquire the port-independent lifecycle lock BEFORE any DB initialization.
    # Held for the entire lifespan and released only after the shutdown final
    # refresh. A held lock means another instance is already running against
    # this data dir -> fail fast rather than corrupt shared state. (Disabled
    # only in tests via ROLL_CALL_ENABLE_APP_LOCK=0.)
    lock = None
    if app_lock.app_lock_enabled():
        lock = app_lock.AppLock(backup_data_dir)
        if not lock.acquire():
            raise RuntimeError(
                "Another Roll Call backend instance is already running "
                f"(lock held: {backup_data_dir / app_lock.LOCK_FILENAME}). "
                "Refusing to start a second instance against the same data "
                "directory."
            )

    try:
        # Guard against silently re-creating a lost primary DB (independent of
        # the backup scheduler). Runs before init_db; may raise to abort startup.
        if preflight_enabled:
            backup_service.preflight_primary_db(backup_data_dir)

        init_db()

        scheduler = None
        if backup_enabled:
            backup_service.install_mutation_hooks()
            scheduler = await backup_service.start(backup_data_dir)
        try:
            yield
        finally:
            # Shutdown final refresh happens here, while the lock is still held.
            if scheduler is not None:
                await backup_service.stop(scheduler)
    finally:
        # Release the lifecycle lock last, after the final refresh. Also runs
        # if startup failed mid-way (preflight/init_db/scheduler raise).
        if lock is not None:
            lock.release()


app = FastAPI(title="Roll Call Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "dataDirFingerprint": data_dir_fingerprint(get_data_dir()),
    }


app.include_router(students.router)
app.include_router(schedule_rules.router)
app.include_router(sessions.router)
app.include_router(global_events.router)
app.include_router(statistics.router)
app.include_router(exports.router)


# Mount built frontend last so it does not shadow /health, /docs, or any
# /api/... routers registered above. The current frontend has no client-side
# routing, so a catch-all SPA fallback is intentionally not configured — only
# / (-> index.html via html=True) and /assets/... are guaranteed to serve.
# If React Router is ever introduced, add a path catch-all that returns
# index.html for unmatched non-API paths.
_frontend_dist = get_frontend_dist_dir()
if _frontend_dist is not None:
    _index_html = _frontend_dist / "index.html"

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def _serve_index() -> HTMLResponse:
        # Entry HTML is never cached so the browser cannot reuse a stale
        # index.html that points at a hashed bundle which no longer exists
        # after a redeploy. Hashed /assets/* keep their normal StaticFiles
        # caching (ETag / Last-Modified) below.
        return HTMLResponse(
            content=_index_html.read_text(encoding="utf-8"),
            headers={"Cache-Control": "no-store, max-age=0"},
        )

    app.mount(
        "/",
        StaticFiles(directory=str(_frontend_dist), html=True),
        name="frontend",
    )
elif _is_packaged():
    raise RuntimeError(
        "Packaged build is missing the bundled frontend/dist. "
        "Rebuild the binary with the frontend assets included."
    )
else:
    warnings.warn(
        "frontend/dist not found; API endpoints work but the SPA will not be served. "
        "Run `npm run build` in frontend/ to enable.",
        RuntimeWarning,
        stacklevel=1,
    )
