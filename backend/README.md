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

Not implemented yet:

- sessions
- student schedule rules
- global events
- statistics
- Excel export
- frontend API integration beyond students
