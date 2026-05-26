from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student, StudentScheduleRule, utc_now
from app.schemas import (
    StudentScheduleRuleCreate,
    StudentScheduleRuleRead,
    StudentScheduleRuleUpdate,
)


router = APIRouter(prefix="/api", tags=["schedule-rules"])


def _dt_to_iso(value) -> str:
    return value.replace(microsecond=0).isoformat()


def to_schedule_rule_read(rule: StudentScheduleRule) -> StudentScheduleRuleRead:
    return StudentScheduleRuleRead(
        id=rule.id,
        studentId=rule.student_id,
        weekday=rule.weekday,
        start=rule.start,
        durationMin=rule.duration_min,
        isActive=bool(rule.is_active),
        createdAt=_dt_to_iso(rule.created_at),
        updatedAt=_dt_to_iso(rule.updated_at),
    )


def get_existing_student(student_id: int, db: Session) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def get_existing_rule(rule_id: int, db: Session) -> StudentScheduleRule:
    rule = db.get(StudentScheduleRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Schedule rule not found")
    return rule


@router.get(
    "/students/{student_id}/schedule-rules",
    response_model=list[StudentScheduleRuleRead],
)
def list_schedule_rules(student_id: int, db: Session = Depends(get_db)):
    get_existing_student(student_id, db)
    rules = (
        db.query(StudentScheduleRule)
        .filter(StudentScheduleRule.student_id == student_id)
        .order_by(
            StudentScheduleRule.weekday.asc(),
            StudentScheduleRule.start.asc(),
            StudentScheduleRule.id.asc(),
        )
        .all()
    )
    return [to_schedule_rule_read(rule) for rule in rules]


@router.post(
    "/students/{student_id}/schedule-rules",
    response_model=StudentScheduleRuleRead,
    status_code=201,
)
def create_schedule_rule(
    student_id: int,
    payload: StudentScheduleRuleCreate,
    db: Session = Depends(get_db),
):
    get_existing_student(student_id, db)
    rule = StudentScheduleRule(
        student_id=student_id,
        weekday=payload.weekday,
        start=payload.start,
        duration_min=payload.durationMin,
        is_active=1 if payload.isActive else 0,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return to_schedule_rule_read(rule)


@router.patch("/schedule-rules/{rule_id}", response_model=StudentScheduleRuleRead)
def update_schedule_rule(
    rule_id: int,
    payload: StudentScheduleRuleUpdate,
    db: Session = Depends(get_db),
):
    rule = get_existing_rule(rule_id, db)
    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "weekday": "weekday",
        "start": "start",
        "durationMin": "duration_min",
    }

    for api_field, model_field in field_map.items():
        if api_field in updates:
            setattr(rule, model_field, updates[api_field])

    if "isActive" in updates:
        rule.is_active = 1 if updates["isActive"] else 0

    if updates:
        rule.updated_at = utc_now()

    db.commit()
    db.refresh(rule)
    return to_schedule_rule_read(rule)


@router.delete("/schedule-rules/{rule_id}")
def delete_schedule_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = get_existing_rule(rule_id, db)
    db.delete(rule)
    db.commit()
    return {"ok": True}
