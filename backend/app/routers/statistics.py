import calendar
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AttendanceSession, GlobalEvent, Student, StudentScheduleRule
from app.schemas import (
    MonthlyStatisticsRead,
    MonthlyStatisticsStudentRow,
    MonthlyStatisticsSummary,
    MonthlyStatisticsWarning,
)


router = APIRouter(prefix="/api/statistics", tags=["statistics"])

MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
ORPHAN_PRESENT_WARNING_CODE = "ORPHAN_PRESENT_SESSIONS_NOT_IN_TEACHER_TOTAL"
ORPHAN_PRESENT_WARNING_MESSAGE = (
    "Some present sessions have no studentId and are counted in presentCount "
    "but not teacherServiceTotal."
)


def get_month_range(month: str) -> tuple[str, str]:
    if not MONTH_PATTERN.match(month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM")

    year_text, month_text = month.split("-")
    year = int(year_text)
    month_number = int(month_text)
    if year < 1:
        raise HTTPException(status_code=422, detail="month must use YYYY-MM")
    last_day = calendar.monthrange(year, month_number)[1]
    return f"{month}-01", f"{month}-{last_day:02d}"


@router.get("/monthly", response_model=MonthlyStatisticsRead)
def get_monthly_statistics(
    month: str = Query(...),
    db: Session = Depends(get_db),
):
    from_date, to_date = get_month_range(month)

    monthly_sessions = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.date_iso >= from_date)
        .filter(AttendanceSession.date_iso <= to_date)
        .all()
    )

    status_counts = {
        "present": 0,
        "absent": 0,
        "pending": 0,
        "cancelled": 0,
    }
    for session in monthly_sessions:
        if session.status in status_counts:
            status_counts[session.status] += 1

    status_order = case(
        (Student.status == "active", 0),
        (Student.status == "scheduled_deactivation", 1),
        (Student.status == "inactive", 2),
        else_=3,
    )
    students = db.query(Student).order_by(status_order, Student.id.asc()).all()
    student_ids = {student.id for student in students}

    student_rows: list[MonthlyStatisticsStudentRow] = []
    teacher_service_total = 0

    for student in students:
        student_present_sessions = [
            session
            for session in monthly_sessions
            if session.student_id == student.id and session.status == "present"
        ]
        regular_count = sum(
            1 for session in student_present_sessions if session.kind == "regular"
        )
        makeup_count = sum(
            1 for session in student_present_sessions if session.kind == "makeup"
        )
        extra_count = sum(
            1 for session in student_present_sessions if session.kind == "extra"
        )
        total_count = regular_count + makeup_count + extra_count
        teacher_service_total += total_count

        student_rows.append(
            MonthlyStatisticsStudentRow(
                studentId=student.id,
                studentName=student.name,
                birthday=student.birthday or "",
                school=student.school or "",
                status=student.status,
                regularPresentCount=regular_count,
                makeupPresentCount=makeup_count,
                extraPresentCount=extra_count,
                totalPresentCount=total_count,
            )
        )

    schedule_rule_count = db.query(StudentScheduleRule).count()
    global_event_count = (
        db.query(GlobalEvent)
        .filter(GlobalEvent.date_iso >= from_date)
        .filter(GlobalEvent.date_iso <= to_date)
        .count()
    )

    orphan_present_count = sum(
        1
        for session in monthly_sessions
        if session.status == "present"
        and (session.student_id is None or session.student_id not in student_ids)
    )
    warnings = []
    if orphan_present_count > 0:
        warnings.append(
            MonthlyStatisticsWarning(
                code=ORPHAN_PRESENT_WARNING_CODE,
                message=ORPHAN_PRESENT_WARNING_MESSAGE,
                count=orphan_present_count,
            )
        )

    return MonthlyStatisticsRead(
        month=month,
        from_date=from_date,
        to=to_date,
        summary=MonthlyStatisticsSummary(
            teacherServiceTotal=teacher_service_total,
            monthlySessionCount=len(monthly_sessions),
            presentCount=status_counts["present"],
            absentCount=status_counts["absent"],
            pendingCount=status_counts["pending"],
            cancelledCount=status_counts["cancelled"],
            scheduleRuleCount=schedule_rule_count,
            globalEventCount=global_event_count,
        ),
        students=student_rows,
        warnings=warnings,
    )
