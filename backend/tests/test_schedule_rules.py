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


def create_student(client: TestClient) -> dict:
    response = client.post(
        "/api/students",
        json={
            "name": "陳小明",
            "birthday": "2012-03-08",
            "school": "培正中學",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_rule(
    client: TestClient,
    student_id: int,
    *,
    weekday: int = 1,
    start: str = "16:00",
    duration_min: int = 60,
    is_active: bool = True,
) -> dict:
    response = client.post(
        f"/api/students/{student_id}/schedule-rules",
        json={
            "weekday": weekday,
            "start": start,
            "durationMin": duration_min,
            "isActive": is_active,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_list_schedule_rules_initially_empty(client: TestClient):
    student = create_student(client)

    response = client.get(f"/api/students/{student['id']}/schedule-rules")

    assert response.status_code == 200
    assert response.json() == []


def test_create_schedule_rule(client: TestClient):
    student = create_student(client)

    response = client.post(
        f"/api/students/{student['id']}/schedule-rules",
        json={
            "weekday": 1,
            "start": "16:00",
            "durationMin": 45,
            "isActive": False,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["studentId"] == student["id"]
    assert body["weekday"] == 1
    assert body["start"] == "16:00"
    assert body["durationMin"] == 45
    assert body["isActive"] is False
    assert body["createdAt"]
    assert body["updatedAt"]
    assert "student_id" not in body
    assert "duration_min" not in body
    assert "is_active" not in body


def test_list_schedule_rules_sorted(client: TestClient):
    student = create_student(client)
    create_rule(client, student["id"], weekday=3, start="17:00")
    create_rule(client, student["id"], weekday=1, start="18:00")
    create_rule(client, student["id"], weekday=1, start="16:00")

    response = client.get(f"/api/students/{student['id']}/schedule-rules")

    assert response.status_code == 200
    assert [
        (rule["weekday"], rule["start"])
        for rule in response.json()
    ] == [
        (1, "16:00"),
        (1, "18:00"),
        (3, "17:00"),
    ]


def test_update_schedule_rule(client: TestClient):
    student = create_student(client)
    rule = create_rule(client, student["id"], weekday=1, start="16:00")

    response = client.patch(
        f"/api/schedule-rules/{rule['id']}",
        json={
            "weekday": 5,
            "start": "19:30",
            "durationMin": 90,
            "isActive": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == rule["id"]
    assert body["studentId"] == student["id"]
    assert body["weekday"] == 5
    assert body["start"] == "19:30"
    assert body["durationMin"] == 90
    assert body["isActive"] is False


def test_delete_schedule_rule(client: TestClient):
    student = create_student(client)
    rule = create_rule(client, student["id"])

    response = client.delete(f"/api/schedule-rules/{rule['id']}")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    list_response = client.get(f"/api/students/{student['id']}/schedule-rules")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_list_rules_for_missing_student_returns_404(client: TestClient):
    response = client.get("/api/students/999/schedule-rules")

    assert response.status_code == 404
    assert response.json()["detail"] == "Student not found"


def test_create_rule_for_missing_student_returns_404(client: TestClient):
    response = client.post(
        "/api/students/999/schedule-rules",
        json={"weekday": 1, "start": "16:00", "durationMin": 60, "isActive": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Student not found"


def test_update_missing_rule_returns_404(client: TestClient):
    response = client.patch("/api/schedule-rules/999", json={"start": "17:00"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Schedule rule not found"


def test_delete_missing_rule_returns_404(client: TestClient):
    response = client.delete("/api/schedule-rules/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Schedule rule not found"


def test_invalid_weekday_is_rejected(client: TestClient):
    student = create_student(client)

    response = client.post(
        f"/api/students/{student['id']}/schedule-rules",
        json={"weekday": 7, "start": "16:00", "durationMin": 60},
    )

    assert response.status_code == 422


def test_invalid_duration_min_is_rejected(client: TestClient):
    student = create_student(client)

    response = client.post(
        f"/api/students/{student['id']}/schedule-rules",
        json={"weekday": 1, "start": "16:00", "durationMin": 0},
    )

    assert response.status_code == 422


def test_invalid_start_is_rejected(client: TestClient):
    student = create_student(client)

    response = client.post(
        f"/api/students/{student['id']}/schedule-rules",
        json={"weekday": 1, "start": "25:00", "durationMin": 60},
    )

    assert response.status_code == 422
