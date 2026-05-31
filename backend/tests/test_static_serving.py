"""Integration tests for serving frontend/dist via FastAPI.

These exercise the module-level static mount in app.main. They skip when
``frontend/dist`` has not been built so they remain green in CI runs that
build only the backend, while still catching regressions when developers
do have a built dist locally.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
_DIST_AVAILABLE = _DIST.is_dir()


pytestmark = pytest.mark.skipif(
    not _DIST_AVAILABLE,
    reason="frontend/dist not built; run `npm run build` in frontend/ to enable",
)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_root_returns_built_index_html(client: TestClient):
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    # Entry HTML must never be cached so a stale index.html cannot point at a
    # hashed bundle that no longer exists after a redeploy.
    assert response.headers["cache-control"] == "no-store, max-age=0"
    # Built index.html always contains the React root mount point.
    assert 'id="root"' in response.text


def test_head_root_sets_no_store(client: TestClient):
    response = client.head("/")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_health_unaffected_by_static_mount(client: TestClient):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    # Health is JSON, untouched by the entry-HTML no-store policy.
    assert "no-store" not in response.headers.get("cache-control", "")


def test_assets_js_file_is_served(client: TestClient):
    assets_dir = _DIST / "assets"
    if not assets_dir.is_dir():
        pytest.skip("frontend/dist/assets not present")

    js_files = sorted(assets_dir.glob("*.js"))
    if not js_files:
        pytest.skip("no JS files in frontend/dist/assets")

    asset_name = js_files[0].name
    response = client.get(f"/assets/{asset_name}")

    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    assert "javascript" in content_type or "ecmascript" in content_type
    # Hashed assets keep normal StaticFiles caching; the no-store policy is
    # entry-HTML only and must not leak onto /assets/*.
    assert "no-store" not in response.headers.get("cache-control", "")
