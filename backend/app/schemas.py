from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


StudentStatus = Literal["active", "scheduled_deactivation", "inactive"]
DeactivateMode = Literal["immediate", "scheduled"]


def _trim_name(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("name must not be empty")
    return trimmed


def _validate_optional_date(value: str | None) -> str | None:
    if value in (None, ""):
        return value

    parts = value.split("-")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError("date must use YYYY-MM-DD")

    year, month, day = (int(part) for part in parts)
    if len(parts[0]) != 4 or len(parts[1]) != 2 or len(parts[2]) != 2:
        raise ValueError("date must use YYYY-MM-DD")
    if month < 1 or month > 12 or day < 1 or day > 31 or year < 1:
        raise ValueError("date must use YYYY-MM-DD")

    return value


class StudentBase(BaseModel):
    name: str
    birthday: str = ""
    school: str = ""
    status: StudentStatus = "active"
    deactivateMode: DeactivateMode | None = None
    deactivateOn: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _trim_name(value)

    @field_validator("birthday")
    @classmethod
    def validate_birthday(cls, value: str) -> str:
        return _validate_optional_date(value) or ""

    @field_validator("deactivateOn")
    @classmethod
    def validate_deactivate_on(cls, value: str | None) -> str | None:
        return _validate_optional_date(value)


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: str | None = None
    birthday: str | None = None
    school: str | None = None
    status: StudentStatus | None = None
    deactivateMode: DeactivateMode | None = None
    deactivateOn: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return _trim_name(value) if value is not None else value

    @field_validator("birthday")
    @classmethod
    def validate_birthday(cls, value: str | None) -> str | None:
        return _validate_optional_date(value)

    @field_validator("deactivateOn")
    @classmethod
    def validate_deactivate_on(cls, value: str | None) -> str | None:
        return _validate_optional_date(value)


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    createdAt: str = Field(description="ISO datetime")
    updatedAt: str = Field(description="ISO datetime")
