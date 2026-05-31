import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import _is_packaged, get_allowed_origins, get_frontend_dist_dir
from app.database import init_db
from app.routers import exports, global_events, schedule_rules, sessions, statistics, students


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


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
    return {"ok": True}


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
