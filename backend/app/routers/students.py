from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student
from app.schemas import StudentCreate, StudentRead, StudentUpdate


router = APIRouter(prefix="/api/students", tags=["students"])


def _dt_to_iso(value) -> str:
    return value.replace(microsecond=0).isoformat()


def to_student_read(student: Student) -> StudentRead:
    return StudentRead(
        id=student.id,
        name=student.name,
        birthday=student.birthday or "",
        school=student.school or "",
        status=student.status,
        deactivateMode=student.deactivate_mode,
        deactivateOn=student.deactivate_on,
        createdAt=_dt_to_iso(student.created_at),
        updatedAt=_dt_to_iso(student.updated_at),
    )


@router.get("", response_model=list[StudentRead])
def list_students(db: Session = Depends(get_db)):
    status_order = case(
        (Student.status == "active", 0),
        (Student.status == "scheduled_deactivation", 1),
        (Student.status == "inactive", 2),
        else_=3,
    )
    students = db.query(Student).order_by(status_order, Student.id.asc()).all()
    return [to_student_read(student) for student in students]


@router.post("", response_model=StudentRead, status_code=201)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    student = Student(
        name=payload.name,
        birthday=payload.birthday,
        school=payload.school,
        status=payload.status,
        deactivate_mode=payload.deactivateMode,
        deactivate_on=payload.deactivateOn,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return to_student_read(student)


@router.patch("/{student_id}", response_model=StudentRead)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "name": "name",
        "birthday": "birthday",
        "school": "school",
        "status": "status",
        "deactivateMode": "deactivate_mode",
        "deactivateOn": "deactivate_on",
    }

    for api_field, model_field in field_map.items():
        if api_field in updates:
            if api_field in {"name", "birthday", "school", "status"} and updates[api_field] is None:
                continue
            setattr(student, model_field, updates[api_field])

    db.commit()
    db.refresh(student)
    return to_student_read(student)
