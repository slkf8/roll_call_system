from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, text

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String, nullable=False)
    birthday = Column(String, nullable=False, default="")
    school = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="active")
    deactivate_mode = Column(String, nullable=True)
    deactivate_on = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'scheduled_deactivation', 'inactive')",
            name="ck_students_status",
        ),
        CheckConstraint(
            "deactivate_mode IS NULL OR deactivate_mode IN ('immediate', 'scheduled')",
            name="ck_students_deactivate_mode",
        ),
        Index("idx_students_status", "status"),
        Index("idx_students_name_birthday", "name", "birthday"),
    )


class StudentScheduleRule(Base):
    __tablename__ = "student_schedule_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    weekday = Column(Integer, nullable=False)
    start = Column(String, nullable=False)
    duration_min = Column(Integer, nullable=False, default=60, server_default=text("60"))
    is_active = Column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at = Column(
        DateTime,
        nullable=False,
        default=utc_now,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_rules_weekday"),
        CheckConstraint("duration_min > 0", name="ck_rules_duration_min"),
        CheckConstraint("is_active IN (0, 1)", name="ck_rules_is_active"),
        Index("idx_rules_student", "student_id"),
        Index("idx_rules_student_active", "student_id", "is_active"),
        Index("idx_rules_student_weekday_start", "student_id", "weekday", "start"),
    )
