from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GlobalEvent, utc_now
from app.schemas import (
    GlobalEventCreate,
    GlobalEventRead,
    GlobalEventUpdate,
    _validate_required_date,
)


router = APIRouter(prefix="/api/global-events", tags=["global-events"])


def _dt_to_iso(value) -> str:
    return value.replace(microsecond=0).isoformat()


def to_global_event_read(record: GlobalEvent) -> GlobalEventRead:
    return GlobalEventRead(
        id=record.id,
        dateISO=record.date_iso,
        mode=record.mode,
        label=record.label,
        leaveReason=record.leave_reason,
        start=record.start,
        end=record.end,
        note=record.note,
        createdAt=_dt_to_iso(record.created_at),
        updatedAt=_dt_to_iso(record.updated_at),
    )


def _validate_query_date(value: str | None, label: str) -> None:
    if value is None:
        return
    try:
        _validate_required_date(value)
    except ValueError:
        raise HTTPException(
            status_code=422, detail=f"{label} must use YYYY-MM-DD"
        )


def _enforce_mode_constraints(
    mode: str, start: str | None, end: str | None
) -> tuple[str | None, str | None]:
    """Normalize start/end for mode.

    - mode = "allDay": coerce both to None regardless of input.
    - mode = "timeRange": both must be present, end must be strictly after start.
    """
    if mode == "allDay":
        return None, None

    if start is None or end is None:
        raise HTTPException(
            status_code=422,
            detail="timeRange mode requires both start and end",
        )
    if end <= start:
        raise HTTPException(
            status_code=422,
            detail="timeRange end must be later than start",
        )
    return start, end


@router.get("", response_model=list[GlobalEventRead])
def list_global_events(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _validate_query_date(from_, "from")
    _validate_query_date(to, "to")

    query = db.query(GlobalEvent)
    if from_ is not None:
        query = query.filter(GlobalEvent.date_iso >= from_)
    if to is not None:
        query = query.filter(GlobalEvent.date_iso <= to)

    records = query.order_by(
        GlobalEvent.date_iso.asc(),
        GlobalEvent.start.asc(),
        GlobalEvent.id.asc(),
    ).all()

    return [to_global_event_read(record) for record in records]


@router.post("", response_model=GlobalEventRead, status_code=201)
def create_global_event(payload: GlobalEventCreate, db: Session = Depends(get_db)):
    start, end = _enforce_mode_constraints(payload.mode, payload.start, payload.end)

    record = GlobalEvent(
        date_iso=payload.dateISO,
        mode=payload.mode,
        label=payload.label,
        leave_reason=payload.leaveReason,
        start=start,
        end=end,
        note=payload.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return to_global_event_read(record)


@router.patch("/{event_id}", response_model=GlobalEventRead)
def update_global_event(
    event_id: int,
    payload: GlobalEventUpdate,
    db: Session = Depends(get_db),
):
    record = db.get(GlobalEvent, event_id)
    if not record:
        raise HTTPException(status_code=404, detail="Global event not found")

    updates = payload.model_dump(exclude_unset=True)

    # Compute merged state for cross-field validation.
    merged_mode = updates["mode"] if "mode" in updates else record.mode
    merged_start = updates["start"] if "start" in updates else record.start
    merged_end = updates["end"] if "end" in updates else record.end

    final_start, final_end = _enforce_mode_constraints(
        merged_mode, merged_start, merged_end
    )

    field_map = {
        "dateISO": "date_iso",
        "mode": "mode",
        "label": "label",
        "leaveReason": "leave_reason",
        "note": "note",
    }
    required_fields = {"dateISO", "mode", "label"}

    for api_field, model_field in field_map.items():
        if api_field not in updates:
            continue
        value = updates[api_field]
        if value is None and api_field in required_fields:
            continue
        setattr(record, model_field, value)

    record.start = final_start
    record.end = final_end

    if updates:
        record.updated_at = utc_now()

    db.commit()
    db.refresh(record)
    return to_global_event_read(record)


@router.delete("/{event_id}")
def delete_global_event(event_id: int, db: Session = Depends(get_db)):
    record = db.get(GlobalEvent, event_id)
    if not record:
        raise HTTPException(status_code=404, detail="Global event not found")

    db.delete(record)
    db.commit()
    return {"ok": True}
