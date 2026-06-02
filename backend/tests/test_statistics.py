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


def create_student(
    client: TestClient,
    *,
    name: str,
    birthday: str = "2012-03-08",
    school: str = "測試學校",
    status: str = "active",
) -> dict:
    response = client.post(
        "/api/students",
        json={
            "name": name,
            "birthday": birthday,
            "school": school,
            "status": status,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def update_student(client: TestClient, student_id: int, **payload) -> dict:
    response = client.patch(f"/api/students/{student_id}", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def create_schedule_rule(client: TestClient, student_id: int) -> dict:
    response = client.post(
        f"/api/students/{student_id}/schedule-rules",
        json={"weekday": 1, "start": "16:00", "durationMin": 60, "isActive": True},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_session(
    client: TestClient,
    *,
    student_id: int | None,
    date_iso: str,
    start: str = "16:00",
    duration_min: int = 60,
    status: str = "pending",
    kind: str = "regular",
    reason: str | None = None,
    note: str | None = None,
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
            "makeupOfDateISO": None,
            "makeupOfSessionId": None,
            "scheduleRuleId": schedule_rule_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_global_event(
    client: TestClient,
    *,
    date_iso: str,
    mode: str = "allDay",
    label: str = "假期",
    start: str | None = None,
    end: str | None = None,
) -> dict:
    payload = {
        "dateISO": date_iso,
        "mode": mode,
        "label": label,
    }
    if start is not None:
        payload["start"] = start
    if end is not None:
        payload["end"] = end

    response = client.post("/api/global-events", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def get_monthly(client: TestClient, month: str = "2026-11") -> dict:
    response = client.get("/api/statistics/monthly", params={"month": month})
    assert response.status_code == 200, response.text
    return response.json()


def test_empty_database_returns_zero_summary_and_empty_students(client: TestClient):
    body = get_monthly(client, "2026-06")

    assert body["month"] == "2026-06"
    assert body["from"] == "2026-06-01"
    assert body["to"] == "2026-06-30"
    assert body["summary"] == {
        "teacherServiceTotal": 0,
        "monthlySessionCount": 0,
        "presentCount": 0,
        "absentCount": 0,
        "pendingCount": 0,
        "cancelledCount": 0,
        "scheduleRuleCount": 0,
        "globalEventCount": 0,
        "materialsCount": 0,
    }
    assert body["students"] == []
    assert body["warnings"] == []


def test_monthly_statistics_matches_current_datapage_counts(client: TestClient):
    student_a = create_student(client, name="陳小明", birthday="2012-03-08")
    student_b = create_student(client, name="李小欣", birthday="2011-11-21")
    student_c = create_student(client, name="王家朗", status="inactive")

    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-11-01",
        status="present",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-11-08",
        status="present",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-11-15",
        status="present",
        kind="makeup",
    )
    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-11-22",
        status="present",
        kind="extra",
    )
    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-11-29",
        status="absent",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_a["id"],
        date_iso="2026-10-25",
        status="present",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_b["id"],
        date_iso="2026-11-03",
        status="present",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_b["id"],
        date_iso="2026-11-10",
        status="pending",
        kind="regular",
    )
    create_session(
        client,
        student_id=student_c["id"],
        date_iso="2026-11-05",
        status="present",
        kind="regular",
    )
    create_session(
        client,
        student_id=None,
        date_iso="2026-11-06",
        status="present",
        kind="extra",
    )
    create_session(
        client,
        student_id=None,
        date_iso="2026-11-07",
        status="cancelled",
        kind="regular",
    )

    body = get_monthly(client)

    assert body["summary"]["monthlySessionCount"] == 10
    assert body["summary"]["presentCount"] == 7
    assert body["summary"]["absentCount"] == 1
    assert body["summary"]["pendingCount"] == 1
    assert body["summary"]["cancelledCount"] == 1
    assert body["summary"]["teacherServiceTotal"] == 6

    rows = {row["studentName"]: row for row in body["students"]}
    assert rows["陳小明"]["regularPresentCount"] == 2
    assert rows["陳小明"]["makeupPresentCount"] == 1
    assert rows["陳小明"]["extraPresentCount"] == 1
    assert rows["陳小明"]["totalPresentCount"] == 4
    assert rows["李小欣"]["regularPresentCount"] == 1
    assert rows["李小欣"]["totalPresentCount"] == 1
    assert rows["王家朗"]["status"] == "inactive"
    assert rows["王家朗"]["regularPresentCount"] == 1
    assert rows["王家朗"]["totalPresentCount"] == 1

    assert body["warnings"] == [
        {
            "code": "ORPHAN_PRESENT_SESSIONS_NOT_IN_TEACHER_TOTAL",
            "message": (
                "Some present sessions have no studentId and are counted in presentCount "
                "but not teacherServiceTotal."
            ),
            "count": 1,
        }
    ]


def test_students_are_sorted_by_status_then_id(client: TestClient):
    inactive = create_student(client, name="Inactive", status="inactive")
    active_late = create_student(client, name="Active Late", status="active")
    scheduled = create_student(client, name="Scheduled", status="scheduled_deactivation")
    active_early = create_student(client, name="Active Early", status="active")

    body = get_monthly(client)

    assert [row["studentId"] for row in body["students"]] == [
        active_late["id"],
        active_early["id"],
        scheduled["id"],
        inactive["id"],
    ]


def test_schedule_rule_and_global_event_counts_do_not_change_session_counts(
    client: TestClient,
):
    student = create_student(client, name="陳小明")
    rule = create_schedule_rule(client, student["id"])
    create_session(
        client,
        student_id=student["id"],
        date_iso="2026-11-02",
        status="present",
        kind="regular",
        schedule_rule_id=rule["id"],
    )
    create_global_event(client, date_iso="2026-11-02", mode="allDay", label="假期")
    create_global_event(
        client,
        date_iso="2026-11-03",
        mode="timeRange",
        label="停課",
        start="14:00",
        end="18:00",
    )
    create_global_event(client, date_iso="2026-12-01", mode="allDay", label="假期")

    body = get_monthly(client)

    assert body["summary"]["scheduleRuleCount"] == 1
    assert body["summary"]["globalEventCount"] == 2
    # Global events do not apply effective-status cancellation in DataPage v1.
    assert body["summary"]["presentCount"] == 1
    assert body["summary"]["cancelledCount"] == 0
    # Schedule rules are counted only; they do not generate expected lessons.
    assert body["summary"]["monthlySessionCount"] == 1


@pytest.mark.parametrize("month", ["2026-13", "2026/11", "2026-1", "2026-11-01"])
def test_invalid_month_returns_validation_error(client: TestClient, month: str):
    response = client.get("/api/statistics/monthly", params={"month": month})

    assert response.status_code in {400, 422}


def test_missing_month_returns_422(client: TestClient):
    response = client.get("/api/statistics/monthly")

    assert response.status_code == 422


def test_materials_counts_in_teacher_total_not_attendance(client: TestClient):
    student = create_student(client, name="陳小明")
    # One present regular session -> attendance + teacher total.
    create_session(
        client, student_id=student["id"], date_iso="2026-11-03", status="present"
    )
    # Absent with materials (reason 4) -> teacher total + materialsCount only.
    client.post(
        "/api/sessions",
        json={
            "studentId": student["id"],
            "dateISO": "2026-11-10",
            "start": "16:00",
            "status": "absent",
            "materialsProvided": True,
            "materialsReasonCode": 4,
        },
    )
    # Absent without materials -> neither.
    create_session(
        client, student_id=student["id"], date_iso="2026-11-17", status="absent"
    )

    body = get_monthly(client, "2026-11")

    assert body["summary"]["materialsCount"] == 1
    assert body["summary"]["teacherServiceTotal"] == 2  # 1 present + 1 materials

    row = next(r for r in body["students"] if r["studentName"] == "陳小明")
    assert row["regularPresentCount"] == 1
    assert row["totalPresentCount"] == 1  # attendance excludes materials
    assert row["materialsCount"] == 1
