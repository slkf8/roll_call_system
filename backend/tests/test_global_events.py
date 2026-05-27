from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_event(
    client: TestClient,
    *,
    date_iso: str = "2026-06-01",
    mode: str = "allDay",
    label: str = "假期",
    leave_reason: str | None = None,
    start: str | None = None,
    end: str | None = None,
    note: str | None = None,
) -> dict:
    payload: dict = {
        "dateISO": date_iso,
        "mode": mode,
        "label": label,
    }
    if leave_reason is not None:
        payload["leaveReason"] = leave_reason
    if start is not None:
        payload["start"] = start
    if end is not None:
        payload["end"] = end
    if note is not None:
        payload["note"] = note

    response = client.post("/api/global-events", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_global_events_initially_empty(client: TestClient):
    response = client.get("/api/global-events")

    assert response.status_code == 200
    assert response.json() == []


def test_create_all_day_event(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "allDay",
            "label": "假期",
            "leaveReason": "夏季假期",
            "note": "全日休假",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["dateISO"] == "2026-06-01"
    assert body["mode"] == "allDay"
    assert body["label"] == "假期"
    assert body["leaveReason"] == "夏季假期"
    assert body["start"] is None
    assert body["end"] is None
    assert body["note"] == "全日休假"
    assert body["createdAt"]
    assert body["updatedAt"]
    assert "date_iso" not in body
    assert "leave_reason" not in body


def test_create_time_range_event(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-02",
            "mode": "timeRange",
            "label": "停課",
            "leaveReason": "颱風",
            "start": "14:00",
            "end": "18:00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["mode"] == "timeRange"
    assert body["start"] == "14:00"
    assert body["end"] == "18:00"
    assert body["leaveReason"] == "颱風"


def test_create_all_day_event_coerces_start_end_to_null(client: TestClient):
    """allDay mode ignores any provided start/end and stores null."""
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "allDay",
            "label": "假期",
            "start": "10:00",
            "end": "11:00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["start"] is None
    assert body["end"] is None


def test_list_orders_by_date_start_id(client: TestClient):
    create_event(client, date_iso="2026-06-05", mode="allDay", label="假期")
    create_event(
        client,
        date_iso="2026-06-01",
        mode="timeRange",
        label="停課",
        start="14:00",
        end="18:00",
    )
    create_event(client, date_iso="2026-06-01", mode="allDay", label="假期")

    response = client.get("/api/global-events")

    assert response.status_code == 200
    summaries = [(e["dateISO"], e["mode"], e["start"]) for e in response.json()]
    # NULLs first under SQLite default ascending order
    assert summaries == [
        ("2026-06-01", "allDay", None),
        ("2026-06-01", "timeRange", "14:00"),
        ("2026-06-05", "allDay", None),
    ]


def test_list_filter_by_date_range(client: TestClient):
    create_event(client, date_iso="2026-05-31")
    create_event(client, date_iso="2026-06-05")
    create_event(client, date_iso="2026-06-20")
    create_event(client, date_iso="2026-07-01")

    response = client.get(
        "/api/global-events", params={"from": "2026-06-01", "to": "2026-06-30"}
    )

    assert response.status_code == 200
    dates = [e["dateISO"] for e in response.json()]
    assert dates == ["2026-06-05", "2026-06-20"]


def test_patch_label_leave_reason_note(client: TestClient):
    event = create_event(client, label="假期", leave_reason="原始原因", note="原始備註")

    response = client.patch(
        f"/api/global-events/{event['id']}",
        json={"label": "停課", "leaveReason": "更新原因", "note": "更新備註"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "停課"
    assert body["leaveReason"] == "更新原因"
    assert body["note"] == "更新備註"


def test_patch_all_day_to_time_range_success(client: TestClient):
    event = create_event(client, mode="allDay", label="假期")

    response = client.patch(
        f"/api/global-events/{event['id']}",
        json={"mode": "timeRange", "start": "09:00", "end": "12:00"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "timeRange"
    assert body["start"] == "09:00"
    assert body["end"] == "12:00"


def test_patch_time_range_to_all_day_clears_start_end(client: TestClient):
    event = create_event(
        client,
        mode="timeRange",
        label="停課",
        start="14:00",
        end="18:00",
    )

    response = client.patch(
        f"/api/global-events/{event['id']}",
        json={"mode": "allDay"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "allDay"
    assert body["start"] is None
    assert body["end"] is None


def test_delete_event(client: TestClient):
    event = create_event(client)

    response = client.delete(f"/api/global-events/{event['id']}")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    list_response = client.get("/api/global-events")
    assert list_response.json() == []


def test_patch_missing_event_returns_404(client: TestClient):
    response = client.patch("/api/global-events/999", json={"label": "停課"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Global event not found"


def test_delete_missing_event_returns_404(client: TestClient):
    response = client.delete("/api/global-events/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Global event not found"


def test_create_invalid_date_iso_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={"dateISO": "20-05-2026", "mode": "allDay", "label": "假期"},
    )

    assert response.status_code == 422


def test_create_invalid_mode_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={"dateISO": "2026-06-01", "mode": "weird", "label": "假期"},
    )

    assert response.status_code == 422


def test_create_empty_label_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={"dateISO": "2026-06-01", "mode": "allDay", "label": "   "},
    )

    assert response.status_code == 422


def test_create_invalid_start_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "timeRange",
            "label": "停課",
            "start": "25:00",
            "end": "26:00",
        },
    )

    assert response.status_code == 422


def test_create_invalid_end_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "timeRange",
            "label": "停課",
            "start": "10:00",
            "end": "24:30",
        },
    )

    assert response.status_code == 422


def test_create_time_range_missing_start_or_end_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "timeRange",
            "label": "停課",
            "start": "10:00",
        },
    )

    assert response.status_code == 422


def test_create_time_range_end_le_start_returns_422(client: TestClient):
    response = client.post(
        "/api/global-events",
        json={
            "dateISO": "2026-06-01",
            "mode": "timeRange",
            "label": "停課",
            "start": "12:00",
            "end": "10:00",
        },
    )

    assert response.status_code == 422


def test_patch_into_invalid_time_range_returns_422(client: TestClient):
    """PATCH switching allDay → timeRange without providing start/end must fail."""
    event = create_event(client, mode="allDay", label="假期")

    response = client.patch(
        f"/api/global-events/{event['id']}",
        json={"mode": "timeRange"},
    )

    assert response.status_code == 422


def test_list_invalid_from_returns_422(client: TestClient):
    response = client.get("/api/global-events", params={"from": "20-05-2026"})

    assert response.status_code == 422
