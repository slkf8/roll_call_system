from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from starlette.responses import Response

from app.excel_export import XLSX_MEDIA_TYPE, fill_excel_template
from app.schemas import ExcelFillTemplatePayload


router = APIRouter(prefix="/api/exports", tags=["exports"])


def _parse_payload(payload: str) -> ExcelFillTemplatePayload:
    try:
        parsed = ExcelFillTemplatePayload.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid export payload") from exc

    if not parsed.writes:
        raise HTTPException(status_code=400, detail="writes must not be empty")

    return parsed


@router.post("/excel/fill-template")
async def fill_template(
    file: UploadFile = File(...),
    payload: str = Form(...),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    parsed_payload = _parse_payload(payload)
    file_bytes = await file.read()
    output = fill_excel_template(file_bytes, parsed_payload)
    filename = f"filled-template-{parsed_payload.month}.xlsx"

    return Response(
        content=output,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
