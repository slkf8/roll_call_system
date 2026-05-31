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


def test_health(client: TestClient):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_list_students_initially_empty(client: TestClient):
    response = client.get("/api/students")

    assert response.status_code == 200
    assert response.json() == []


def test_create_student(client: TestClient):
    response = client.post(
        "/api/students",
        json={
            "name": " 陳小明 ",
            "birthday": "2012-03-08",
            "school": "培正中學",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["name"] == "陳小明"
    assert body["birthday"] == "2012-03-08"
    assert body["school"] == "培正中學"
    assert body["status"] == "active"
    assert body["deactivateMode"] is None
    assert body["deactivateOn"] is None
    assert body["createdAt"]
    assert body["updatedAt"]


def test_update_student(client: TestClient):
    created = client.post("/api/students", json={"name": "李小欣"}).json()

    response = client.patch(
        f"/api/students/{created['id']}",
        json={
            "school": "聖羅撒女子中學",
            "status": "scheduled_deactivation",
            "deactivateMode": "scheduled",
            "deactivateOn": "2026-05-01",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "李小欣"
    assert body["school"] == "聖羅撒女子中學"
    assert body["status"] == "scheduled_deactivation"
    assert body["deactivateMode"] == "scheduled"
    assert body["deactivateOn"] == "2026-05-01"


def test_update_missing_student_returns_404(client: TestClient):
    response = client.patch("/api/students/999", json={"name": "不存在"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Student not found"


def test_empty_name_is_rejected(client: TestClient):
    response = client.post("/api/students", json={"name": "   "})

    assert response.status_code == 422


# --- Lenient-contract locks (frontend plan B relies on these) -----------
# Only `name` is required; birthday and school are optional and default to "".
# These guard against accidental future tightening of the create schema.


def test_create_student_with_empty_school(client: TestClient):
    response = client.post(
        "/api/students",
        json={"name": "無學校", "birthday": "2000-01-01", "school": ""},
    )

    assert response.status_code == 201
    assert response.json()["school"] == ""


def test_create_student_without_school_field(client: TestClient):
    response = client.post(
        "/api/students",
        json={"name": "缺學校欄位", "birthday": "2000-01-01"},
    )

    assert response.status_code == 201
    assert response.json()["school"] == ""


def test_create_student_with_empty_birthday(client: TestClient):
    response = client.post(
        "/api/students",
        json={"name": "無生日", "birthday": "", "school": "某校"},
    )

    assert response.status_code == 201
    assert response.json()["birthday"] == ""


def test_update_student_can_clear_school(client: TestClient):
    created = client.post(
        "/api/students",
        json={"name": "有學校", "school": "原校"},
    ).json()

    response = client.patch(f"/api/students/{created['id']}", json={"school": ""})

    assert response.status_code == 200
    assert response.json()["school"] == ""
