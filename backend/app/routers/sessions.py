from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AttendanceSession, Student, StudentScheduleRule, utc_now
from app.schemas import (
    SessionCreate,
    SessionRead,
    SessionStudentSnapshot,
    SessionUpdate,
    _validate_required_date,
    normalize_materials,
)


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _dt_to_iso(value) -> str:
    return value.replace(microsecond=0).isoformat()


def to_session_read(record: AttendanceSession, db: Session) -> SessionRead:
    student_snapshot: SessionStudentSnapshot | None = None
    if record.student_id is not None:
        student = db.get(Student, record.student_id)
        if student is not None:
            student_snapshot = SessionStudentSnapshot(id=student.id, name=student.name)

    return SessionRead(
        id=record.id,
        studentId=record.student_id,
        student=student_snapshot,
        dateISO=record.date_iso,
        start=record.start,
        durationMin=record.duration_min,
        status=record.status,
        reason=record.reason,
        note=record.note,
        kind=record.kind,
        makeupOfDateISO=record.makeup_of_date_iso,
        makeupOfSessionId=record.makeup_of_session_id,
        scheduleRuleId=record.schedule_rule_id,
        materialsProvided=bool(record.materials_provided),
        materialsReasonCode=record.materials_reason_code,
        createdAt=_dt_to_iso(record.created_at),
        updatedAt=_dt_to_iso(record.updated_at),
    )


def _ensure_student(student_id: int | None, db: Session) -> None:
    if student_id is None:
        return
    if not db.get(Student, student_id):
        raise HTTPException(status_code=400, detail="Student not found")


def _ensure_makeup_source(session_id: int | None, db: Session) -> None:
    if session_id is None:
        return
    if not db.get(AttendanceSession, session_id):
        raise HTTPException(status_code=400, detail="Makeup source session not found")


def _ensure_schedule_rule(rule_id: int | None, db: Session) -> None:
    if rule_id is None:
        return
    if not db.get(StudentScheduleRule, rule_id):
        raise HTTPException(status_code=400, detail="Schedule rule not found")


def _validate_query_date(value: str | None, label: str) -> None:
    if value is None:
        return
    try:
        _validate_required_date(value)
    except ValueError:
        raise HTTPException(
            status_code=422, detail=f"{label} must use YYYY-MM-DD"
        )


@router.get("", response_model=list[SessionRead])
def list_sessions(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    studentId: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _validate_query_date(from_, "from")
    _validate_query_date(to, "to")

    query = db.query(AttendanceSession)
    if from_ is not None:
        query = query.filter(AttendanceSession.date_iso >= from_)
    if to is not None:
        query = query.filter(AttendanceSession.date_iso <= to)
    if studentId is not None:
        query = query.filter(AttendanceSession.student_id == studentId)

    records = query.order_by(
        AttendanceSession.date_iso.asc(),
        AttendanceSession.start.asc(),
        AttendanceSession.id.asc(),
    ).all()

    return [to_session_read(record, db) for record in records]


@router.post("", response_model=SessionRead, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    _ensure_student(payload.studentId, db)
    _ensure_makeup_source(payload.makeupOfSessionId, db)
    _ensure_schedule_rule(payload.scheduleRuleId, db)

    try:
        materials_provided, materials_reason_code = normalize_materials(
            payload.status, payload.materialsProvided, payload.materialsReasonCode
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    record = AttendanceSession(
        student_id=payload.studentId,
        date_iso=payload.dateISO,
        start=payload.start,
        duration_min=payload.durationMin,
        status=payload.status,
        reason=payload.reason,
        note=payload.note,
        kind=payload.kind,
        makeup_of_date_iso=payload.makeupOfDateISO,
        makeup_of_session_id=payload.makeupOfSessionId,
        schedule_rule_id=payload.scheduleRuleId,
        materials_provided=materials_provided,
        materials_reason_code=materials_reason_code,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return to_session_read(record, db)


@router.patch("/{session_id}", response_model=SessionRead)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
):
    record = db.get(AttendanceSession, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    updates = payload.model_dump(exclude_unset=True)

    if "studentId" in updates:
        _ensure_student(updates["studentId"], db)
    if "makeupOfSessionId" in updates:
        _ensure_makeup_source(updates["makeupOfSessionId"], db)
    if "scheduleRuleId" in updates:
        _ensure_schedule_rule(updates["scheduleRuleId"], db)

    required_fields = {"dateISO", "start", "durationMin", "status", "kind"}
    field_map = {
        "studentId": "student_id",
        "dateISO": "date_iso",
        "start": "start",
        "durationMin": "duration_min",
        "status": "status",
        "reason": "reason",
        "note": "note",
        "kind": "kind",
        "makeupOfDateISO": "makeup_of_date_iso",
        "makeupOfSessionId": "makeup_of_session_id",
        "scheduleRuleId": "schedule_rule_id",
    }

    for api_field, model_field in field_map.items():
        if api_field not in updates:
            continue
        value = updates[api_field]
        if value is None and api_field in required_fields:
            continue
        setattr(record, model_field, value)

    # Merge existing + payload, then normalize materials against the effective
    # status. record.status already reflects the merged status above.
    if "materialsProvided" in updates and updates["materialsProvided"] is not None:
        effective_provided = updates["materialsProvided"]
    else:
        effective_provided = bool(record.materials_provided)
    if "materialsReasonCode" in updates:
        effective_code = updates["materialsReasonCode"]
    else:
        effective_code = record.materials_reason_code

    try:
        materials_provided, materials_reason_code = normalize_materials(
            record.status, effective_provided, effective_code
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    record.materials_provided = materials_provided
    record.materials_reason_code = materials_reason_code

    if updates:
        record.updated_at = utc_now()

    db.commit()
    db.refresh(record)
    return to_session_read(record, db)


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    record = db.get(AttendanceSession, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    detached_query = db.query(AttendanceSession).filter(
        AttendanceSession.makeup_of_session_id == session_id
    )
    detached_count = detached_query.count()
    if detached_count:
        detached_query.update(
            {AttendanceSession.makeup_of_session_id: None},
            synchronize_session=False,
        )

    db.delete(record)
    db.commit()
    return {"ok": True, "detachedMakeupCount": detached_count}
