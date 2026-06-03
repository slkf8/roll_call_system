import math
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


StudentStatus = Literal["active", "scheduled_deactivation", "inactive"]
DeactivateMode = Literal["immediate", "scheduled"]
Weekday = Literal[0, 1, 2, 3, 4, 5, 6]
SessionStatus = Literal["pending", "present", "absent", "cancelled"]
SessionKind = Literal["regular", "makeup", "extra"]
MaterialsReasonCode = Literal[1, 2, 3, 4, 5, 6]
GlobalEventMode = Literal["allDay", "timeRange"]


def normalize_materials(
    status: str,
    materials_provided: bool,
    materials_reason_code: int | None,
) -> tuple[bool, int | None]:
    """Apply the materials invariants and return effective (provided, code).

    Rules (single source of truth, shared by POST and PATCH):
      - effective status != absent  -> provided False, code None
      - effective provided is False -> code None
      - effective provided is True  -> code must be in 1..6, else ValueError
    """
    if status != "absent":
        return False, None
    if not materials_provided:
        return False, None
    if materials_reason_code not in (1, 2, 3, 4, 5, 6):
        raise ValueError("materialsReasonCode must be 1-6 when materialsProvided is true")
    return True, materials_reason_code

HHMM_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
CELL_ADDRESS_PATTERN = re.compile(r"^[A-Za-z]{1,3}[1-9][0-9]*$")
# Materials reason string: "<day>-<code>" pairs joined by ";".
# day 1-31 (no leading zero), code 1-6, no spaces. e.g. "3-4;18-2".
MATERIALS_REASON_PATTERN = re.compile(
    r"^(?:[1-9]|[12]\d|3[01])-[1-6](?:;(?:[1-9]|[12]\d|3[01])-[1-6])*$"
)
MATERIALS_REASON_MAX_LEN = 1024


def _trim_name(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("name must not be empty")
    return trimmed


def _trim_label(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("label must not be empty")
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


def _validate_required_date(value: str) -> str:
    result = _validate_optional_date(value)
    if not result:
        raise ValueError("date must use YYYY-MM-DD")
    return result


def _validate_hhmm(value: str) -> str:
    if not HHMM_PATTERN.match(value):
        raise ValueError("start must use HH:MM")
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


class StudentScheduleRuleBase(BaseModel):
    weekday: Weekday
    start: str
    durationMin: int = Field(default=60, gt=0)
    isActive: bool = True

    @field_validator("start")
    @classmethod
    def validate_start(cls, value: str) -> str:
        return _validate_hhmm(value)


class StudentScheduleRuleCreate(StudentScheduleRuleBase):
    pass


class StudentScheduleRuleUpdate(BaseModel):
    weekday: Weekday | None = None
    start: str | None = None
    durationMin: int | None = Field(default=None, gt=0)
    isActive: bool | None = None

    @field_validator("start")
    @classmethod
    def validate_start(cls, value: str | None) -> str | None:
        return _validate_hhmm(value) if value is not None else value


class StudentScheduleRuleRead(StudentScheduleRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    studentId: int
    createdAt: str = Field(description="ISO datetime")
    updatedAt: str = Field(description="ISO datetime")


class SessionStudentSnapshot(BaseModel):
    id: int
    name: str


class SessionBase(BaseModel):
    studentId: int | None = None
    dateISO: str
    start: str
    durationMin: int = Field(default=60, gt=0)
    status: SessionStatus = "pending"
    reason: str | None = None
    note: str | None = None
    kind: SessionKind = "regular"
    makeupOfDateISO: str | None = None
    makeupOfSessionId: int | None = None
    scheduleRuleId: int | None = None
    materialsProvided: bool = False
    materialsReasonCode: MaterialsReasonCode | None = None

    @field_validator("dateISO")
    @classmethod
    def validate_date_iso(cls, value: str) -> str:
        return _validate_required_date(value)

    @field_validator("start")
    @classmethod
    def validate_start(cls, value: str) -> str:
        return _validate_hhmm(value)

    @field_validator("makeupOfDateISO")
    @classmethod
    def validate_makeup_of_date(cls, value: str | None) -> str | None:
        return _validate_optional_date(value)


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    studentId: int | None = None
    dateISO: str | None = None
    start: str | None = None
    durationMin: int | None = Field(default=None, gt=0)
    status: SessionStatus | None = None
    reason: str | None = None
    note: str | None = None
    kind: SessionKind | None = None
    makeupOfDateISO: str | None = None
    makeupOfSessionId: int | None = None
    scheduleRuleId: int | None = None
    materialsProvided: bool | None = None
    materialsReasonCode: MaterialsReasonCode | None = None

    @field_validator("dateISO")
    @classmethod
    def validate_date_iso(cls, value: str | None) -> str | None:
        return _validate_required_date(value) if value is not None else value

    @field_validator("start")
    @classmethod
    def validate_start(cls, value: str | None) -> str | None:
        return _validate_hhmm(value) if value is not None else value

    @field_validator("makeupOfDateISO")
    @classmethod
    def validate_makeup_of_date(cls, value: str | None) -> str | None:
        return _validate_optional_date(value)


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    studentId: int | None
    student: SessionStudentSnapshot | None
    dateISO: str
    start: str
    durationMin: int
    status: str
    reason: str | None
    note: str | None
    kind: str
    makeupOfDateISO: str | None
    makeupOfSessionId: int | None
    scheduleRuleId: int | None
    materialsProvided: bool
    materialsReasonCode: int | None
    createdAt: str = Field(description="ISO datetime")
    updatedAt: str = Field(description="ISO datetime")


class GlobalEventBase(BaseModel):
    dateISO: str
    mode: GlobalEventMode
    label: str
    leaveReason: str | None = None
    start: str | None = None
    end: str | None = None
    note: str | None = None

    @field_validator("dateISO")
    @classmethod
    def validate_date_iso(cls, value: str) -> str:
        return _validate_required_date(value)

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        return _trim_label(value)

    @field_validator("start", "end")
    @classmethod
    def validate_hhmm_optional(cls, value: str | None) -> str | None:
        return _validate_hhmm(value) if value is not None else value


class GlobalEventCreate(GlobalEventBase):
    pass


class GlobalEventUpdate(BaseModel):
    dateISO: str | None = None
    mode: GlobalEventMode | None = None
    label: str | None = None
    leaveReason: str | None = None
    start: str | None = None
    end: str | None = None
    note: str | None = None

    @field_validator("dateISO")
    @classmethod
    def validate_date_iso(cls, value: str | None) -> str | None:
        return _validate_required_date(value) if value is not None else value

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str | None) -> str | None:
        return _trim_label(value) if value is not None else value

    @field_validator("start", "end")
    @classmethod
    def validate_hhmm_optional(cls, value: str | None) -> str | None:
        return _validate_hhmm(value) if value is not None else value


class GlobalEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dateISO: str
    mode: str
    label: str
    leaveReason: str | None
    start: str | None
    end: str | None
    note: str | None
    createdAt: str = Field(description="ISO datetime")
    updatedAt: str = Field(description="ISO datetime")


class MonthlyStatisticsSummary(BaseModel):
    teacherServiceTotal: int
    monthlySessionCount: int
    presentCount: int
    absentCount: int
    pendingCount: int
    cancelledCount: int
    scheduleRuleCount: int
    globalEventCount: int
    materialsCount: int


class MonthlyStatisticsStudentRow(BaseModel):
    studentId: int
    studentName: str
    birthday: str
    school: str
    status: str
    regularPresentCount: int
    makeupPresentCount: int
    extraPresentCount: int
    totalPresentCount: int
    materialsCount: int


class MonthlyStatisticsWarning(BaseModel):
    code: str
    message: str
    count: int


class MonthlyStatisticsRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    month: str
    from_date: str = Field(alias="from")
    to: str
    summary: MonthlyStatisticsSummary
    students: list[MonthlyStatisticsStudentRow]
    warnings: list[MonthlyStatisticsWarning]


class ExcelFillWrite(BaseModel):
    cellAddress: str
    value: int | float | str
    studentId: int | None = None
    studentName: str | None = None
    birthday: str | None = None
    reason: str | None = None

    @field_validator("cellAddress")
    @classmethod
    def validate_cell_address(cls, value: str) -> str:
        cell_address = value.strip().upper()
        if not CELL_ADDRESS_PATTERN.match(cell_address):
            raise ValueError("cellAddress must be a single cell address")
        return cell_address

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, value):
        # Reject bool explicitly (bool is an int subclass in Python).
        if isinstance(value, bool):
            raise ValueError("value must be a number or a materials reason string")
        if isinstance(value, (int, float)):
            if not math.isfinite(float(value)):
                raise ValueError("value must be a finite number")
            return value
        # Strings are only allowed for the materials reason cell and must match
        # the strict "<day>-<code>" format (no arbitrary text / formulas).
        if isinstance(value, str):
            if len(value) > MATERIALS_REASON_MAX_LEN:
                raise ValueError("value string exceeds maximum length")
            if not MATERIALS_REASON_PATTERN.fullmatch(value):
                raise ValueError("value string must be a valid materials reason string")
            return value
        raise ValueError("value must be a number or a materials reason string")


class ExcelFillOptions(BaseModel):
    preserveTemplate: bool = True


class ExcelFillTemplatePayload(BaseModel):
    worksheetName: str
    month: str
    writes: list[ExcelFillWrite]
    options: ExcelFillOptions = Field(default_factory=ExcelFillOptions)

    @field_validator("worksheetName")
    @classmethod
    def validate_worksheet_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("worksheetName must not be empty")
        return trimmed

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: str) -> str:
        if not MONTH_PATTERN.match(value):
            raise ValueError("month must use YYYY-MM")
        return value
