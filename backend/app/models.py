from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String

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
