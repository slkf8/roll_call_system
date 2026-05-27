# Roll Call Backend

FastAPI + SQLite backend skeleton for the roll call system.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

Health check:

```text
http://127.0.0.1:8000/health
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Optional environment variables

These let you override defaults without code changes (useful for packaged
builds and CI):

- `ROLL_CALL_DATA_DIR` — directory for the SQLite database. Defaults to
  `backend/data/app.db` when running from source.
- `ROLL_CALL_ALLOWED_ORIGINS` — comma-separated CORS origins. Defaults to
  the Vite dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`).
- `ROLL_CALL_HOST` / `HOST` — bind host (default `127.0.0.1`). Currently
  consumed by the config helper; the dev `uvicorn --reload` command still
  uses uvicorn defaults.
- `ROLL_CALL_PORT` / `PORT` — bind port (default `8000`). Invalid values
  raise on startup; silent fallbacks would mask deployment mistakes.

See `backend/.env.example` for a starter file.

## Test

Run from this `backend/` directory:

```bash
python -m pytest tests
```

## Database

SQLite database file:

```text
backend/data/app.db
```

The `backend/data/` directory is created automatically when the backend starts.
The database file is ignored by Git.

## Current Scope

Implemented:

- `GET /health`
- `GET /api/students`
- `POST /api/students`
- `PATCH /api/students/{id}`
- `GET /api/students/{student_id}/schedule-rules`
- `POST /api/students/{student_id}/schedule-rules`
- `PATCH /api/schedule-rules/{rule_id}`
- `DELETE /api/schedule-rules/{rule_id}`
- `GET /api/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&studentId=<id>`
- `POST /api/sessions`
- `PATCH /api/sessions/{session_id}`
- `DELETE /api/sessions/{session_id}` (detaches `makeupOfSessionId` on dependent sessions and returns `detachedMakeupCount`)
- `GET /api/global-events?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/global-events`
- `PATCH /api/global-events/{event_id}`
- `DELETE /api/global-events/{event_id}`
- `GET /api/statistics/monthly?month=YYYY-MM`
- `POST /api/exports/excel/fill-template`

Not implemented yet:

- Excel template parsing backend integration
- Excel column detection backend integration
- Excel row matching backend integration

Statistics scope:

- Monthly statistics mirrors the current frontend DataPage counting rules.
- Frontend DataPage statistics integration is complete; Excel template matching and export remain frontend-only.
- It does not include Excel template matching.
- It does not include Excel export.
- It does not apply global event effective-status overrides.
- It does not calculate schedule-rule expected lessons.

Excel export scope:

- `POST /api/exports/excel/fill-template` only performs final `.xlsx` cell writes.
- It does not parse templates for columns.
- It does not identify name / birthday / direct-service columns.
- It does not match student rows.
- It does not create previews.
- It does not calculate statistics.
- The first version only supports `.xlsx` files.
- Frontend DataPage export now prioritizes this endpoint and keeps the browser `xlsx-populate` export as fallback.
