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


def create_student(client: TestClient, name: str = "陳小明") -> dict:
    response = client.post(
        "/api/students",
        json={"name": name, "birthday": "2012-03-08", "school": "培正中學"},
    )
    assert response.status_code == 201
    return response.json()


def create_schedule_rule(client: TestClient, student_id: int) -> dict:
    response = client.post(
        f"/api/students/{student_id}/schedule-rules",
        json={"weekday": 1, "start": "16:00", "durationMin": 60, "isActive": True},
    )
    assert response.status_code == 201
    return response.json()


def create_session(
    client: TestClient,
    *,
    student_id: int | None,
    date_iso: str = "2026-05-20",
    start: str = "16:00",
    duration_min: int = 60,
    status: str = "pending",
    kind: str = "regular",
    reason: str | None = None,
    note: str | None = None,
    makeup_of_date_iso: str | None = None,
    makeup_of_session_id: int | None = None,
    schedule_rule_id: int | None = None,
) -> dict:
    response = client.post(
        "/api/sessions",
        json={
            "studentId": student_id,
            "dateISO": date_iso,
            "start": start,
            "durationMin": duration_min,
            "status": status,
            "kind": kind,
            "reason": reason,
            "note": note,
            "makeupOfDateISO": makeup_of_date_iso,
            "makeupOfSessionId": makeup_of_session_id,
            "scheduleRuleId": schedule_rule_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_sessions_initially_empty(client: TestClient):
    response = client.get("/api/sessions")

    assert response.status_code == 200
    assert response.json() == []


def test_create_regular_session(client: TestClient):
    student = create_student(client)
    rule = create_schedule_rule(client, student["id"])

    body = create_session(
        client,
        student_id=student["id"],
        kind="regular",
        schedule_rule_id=rule["id"],
    )

    assert body["id"] == 1
    assert body["studentId"] == student["id"]
    assert body["student"] == {"id": student["id"], "name": student["name"]}
    assert body["dateISO"] == "2026-05-20"
    assert body["start"] == "16:00"
    assert body["durationMin"] == 60
    assert body["status"] == "pending"
    assert body["kind"] == "regular"
    assert body["reason"] is None
    assert body["note"] is None
    assert body["makeupOfDateISO"] is None
    assert body["makeupOfSessionId"] is None
    assert body["scheduleRuleId"] == rule["id"]
    assert body["createdAt"]
    assert body["updatedAt"]
    assert "student_id" not in body
    assert "duration_min" not in body
    assert "schedule_rule_id" not in body


def test_create_makeup_session(client: TestClient):
    student = create_student(client)
    source = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-12",
        start="10:00",
        kind="regular",
    )

    body = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-15",
        start="11:00",
        kind="makeup",
        makeup_of_date_iso="2026-05-12",
        makeup_of_session_id=source["id"],
    )

    assert body["kind"] == "makeup"
    assert body["makeupOfDateISO"] == "2026-05-12"
    assert body["makeupOfSessionId"] == source["id"]


def test_create_extra_session(client: TestClient):
    student = create_student(client)

    body = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-22",
        start="19:00",
        kind="extra",
    )

    assert body["kind"] == "extra"
    assert body["scheduleRuleId"] is None
    assert body["makeupOfSessionId"] is None


def test_list_filter_by_date_range(client: TestClient):
    student = create_student(client)
    create_session(client, student_id=student["id"], date_iso="2026-04-30", start="16:00")
    create_session(client, student_id=student["id"], date_iso="2026-05-10", start="16:00")
    create_session(client, student_id=student["id"], date_iso="2026-05-20", start="16:00")
    create_session(client, student_id=student["id"], date_iso="2026-06-01", start="16:00")

    response = client.get("/api/sessions", params={"from": "2026-05-01", "to": "2026-05-31"})

    assert response.status_code == 200
    dates = [item["dateISO"] for item in response.json()]
    assert dates == ["2026-05-10", "2026-05-20"]


def test_list_filter_by_student(client: TestClient):
    student_a = create_student(client, name="陳小明")
    student_b = create_student(client, name="李小欣")
    create_session(client, student_id=student_a["id"], date_iso="2026-05-20", start="16:00")
    create_session(client, student_id=student_b["id"], date_iso="2026-05-20", start="17:00")
    create_session(client, student_id=student_b["id"], date_iso="2026-05-21", start="18:00")

    response = client.get("/api/sessions", params={"studentId": student_b["id"]})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all(item["studentId"] == student_b["id"] for item in body)
    assert [item["dateISO"] for item in body] == ["2026-05-20", "2026-05-21"]


def test_list_orders_by_date_start_id(client: TestClient):
    student = create_student(client)
    create_session(client, student_id=student["id"], date_iso="2026-05-20", start="17:00")
    create_session(client, student_id=student["id"], date_iso="2026-05-20", start="16:00")
    create_session(client, student_id=student["id"], date_iso="2026-05-19", start="18:00")

    response = client.get("/api/sessions")

    assert response.status_code == 200
    assert [
        (item["dateISO"], item["start"]) for item in response.json()
    ] == [
        ("2026-05-19", "18:00"),
        ("2026-05-20", "16:00"),
        ("2026-05-20", "17:00"),
    ]


def test_patch_session_status_reason_note(client: TestClient):
    student = create_student(client)
    created = create_session(client, student_id=student["id"])

    response = client.patch(
        f"/api/sessions/{created['id']}",
        json={"status": "absent", "reason": "生病", "note": "家長已通知"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "absent"
    assert body["reason"] == "生病"
    assert body["note"] == "家長已通知"


def test_patch_session_date_start_duration(client: TestClient):
    student = create_student(client)
    created = create_session(client, student_id=student["id"])

    response = client.patch(
        f"/api/sessions/{created['id']}",
        json={"dateISO": "2026-05-25", "start": "18:30", "durationMin": 90},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["dateISO"] == "2026-05-25"
    assert body["start"] == "18:30"
    assert body["durationMin"] == 90


def test_patch_can_detach_makeup_link(client: TestClient):
    student = create_student(client)
    source = create_session(
        client, student_id=student["id"], date_iso="2026-05-10", start="10:00"
    )
    makeup = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-15",
        start="11:00",
        kind="makeup",
        makeup_of_date_iso="2026-05-10",
        makeup_of_session_id=source["id"],
    )

    response = client.patch(
        f"/api/sessions/{makeup['id']}",
        json={"makeupOfSessionId": None},
    )

    assert response.status_code == 200
    assert response.json()["makeupOfSessionId"] is None


def test_delete_session(client: TestClient):
    student = create_student(client)
    created = create_session(client, student_id=student["id"])

    response = client.delete(f"/api/sessions/{created['id']}")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "detachedMakeupCount": 0}
    list_response = client.get("/api/sessions")
    assert list_response.json() == []


def test_delete_session_detaches_makeup_links(client: TestClient):
    student = create_student(client)
    source = create_session(
        client, student_id=student["id"], date_iso="2026-05-10", start="10:00"
    )
    makeup_a = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-15",
        start="11:00",
        kind="makeup",
        makeup_of_date_iso="2026-05-10",
        makeup_of_session_id=source["id"],
    )
    makeup_b = create_session(
        client,
        student_id=student["id"],
        date_iso="2026-05-17",
        start="12:00",
        kind="makeup",
        makeup_of_date_iso="2026-05-10",
        makeup_of_session_id=source["id"],
    )

    response = client.delete(f"/api/sessions/{source['id']}")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "detachedMakeupCount": 2}

    remaining = client.get("/api/sessions").json()
    remaining_ids = {item["id"] for item in remaining}
    assert remaining_ids == {makeup_a["id"], makeup_b["id"]}
    for item in remaining:
        assert item["makeupOfSessionId"] is None


def test_create_invalid_student_id_returns_400(client: TestClient):
    response = client.post(
        "/api/sessions",
        json={"studentId": 999, "dateISO": "2026-05-20", "start": "16:00"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Student not found"


def test_create_invalid_makeup_source_returns_400(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-05-20",
            "start": "16:00",
            "kind": "makeup",
            "makeupOfDateISO": "2026-05-12",
            "makeupOfSessionId": 999,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Makeup source session not found"


def test_create_invalid_schedule_rule_returns_400(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-05-20",
            "start": "16:00",
            "scheduleRuleId": 999,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Schedule rule not found"


def test_create_invalid_status_returns_422(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-05-20",
            "start": "16:00",
            "status": "weird",
        },
    )

    assert response.status_code == 422


def test_create_invalid_kind_returns_422(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-05-20",
            "start": "16:00",
            "kind": "weird",
        },
    )

    assert response.status_code == 422


def test_create_invalid_date_iso_returns_422(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={"studentId": student["id"], "dateISO": "20-05-2026", "start": "16:00"},
    )

    assert response.status_code == 422


def test_create_invalid_start_returns_422(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={"studentId": student["id"], "dateISO": "2026-05-20", "start": "25:00"},
    )

    assert response.status_code == 422


def test_create_invalid_duration_returns_422(client: TestClient):
    student = create_student(client)

    response = client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-05-20",
            "start": "16:00",
            "durationMin": 0,
        },
    )

    assert response.status_code == 422


def test_patch_missing_session_returns_404(client: TestClient):
    response = client.patch("/api/sessions/999", json={"status": "present"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"


def test_delete_missing_session_returns_404(client: TestClient):
    response = client.delete("/api/sessions/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"


def test_orphan_session_with_null_student(client: TestClient):
    body = create_session(client, student_id=None, date_iso="2026-05-20", start="16:00")

    assert body["studentId"] is None
    assert body["student"] is None

    listed = client.get("/api/sessions").json()
    assert listed[0]["studentId"] is None
    assert listed[0]["student"] is None


def test_session_response_includes_student_snapshot(client: TestClient):
    student = create_student(client, name="王家朗")
    created = create_session(client, student_id=student["id"])

    listed = client.get("/api/sessions").json()
    assert listed[0]["student"] == {"id": student["id"], "name": "王家朗"}

    fetched = client.patch(
        f"/api/sessions/{created['id']}",
        json={"status": "present"},
    ).json()
    assert fetched["student"] == {"id": student["id"], "name": "王家朗"}


def test_list_invalid_from_returns_422(client: TestClient):
    response = client.get("/api/sessions", params={"from": "20-05-2026"})

    assert response.status_code == 422
