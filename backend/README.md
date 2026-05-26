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

Not implemented yet:

- global events
- statistics
- Excel export
- frontend sessions integration
