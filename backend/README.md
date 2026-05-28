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

### Dev (hot reload)

```bash
uvicorn app.main:app --reload
```

### Production (single port, serves built frontend)

```bash
# 1. Build the frontend first.
cd ../frontend && npm run build && cd ../backend

# 2. Launch the production runner.
python run.py
```

`run.py` disables uvicorn `--reload`, pre-populates same-port CORS origins
(`http://localhost:{port}` + `http://127.0.0.1:{port}`) when the user has
not set `ROLL_CALL_ALLOWED_ORIGINS`, and prints the bound URL on startup.

Health check:

```text
http://127.0.0.1:8000/health
```

API docs:

```text
http://127.0.0.1:8000/docs
```

Frontend (when `frontend/dist` is built and discoverable):

```text
http://127.0.0.1:8000/
```

## Optional environment variables

These let you override defaults without code changes (useful for packaged
builds and CI):

- `ROLL_CALL_DATA_DIR` — directory for the SQLite database. Highest
  priority; overrides both packaged and dev defaults.
- `ROLL_CALL_PACKAGED` — force packaged mode (`1` / `true` / `yes`) or
  source mode (`0` / `false` / `no`). When unset, the app falls back to
  `sys.frozen` (set automatically by PyInstaller). Invalid values raise.
- `ROLL_CALL_FRONTEND_DIST` — directory of built frontend assets.
  Highest priority; overrides packaged (`sys._MEIPASS/frontend_dist`) and
  dev (`<repo>/frontend/dist`) defaults. The mount is skipped (with a
  warning) when the path resolves to nothing in dev source mode, and
  raises in packaged mode.
- `ROLL_CALL_ALLOWED_ORIGINS` — comma-separated CORS origins. Defaults to
  the Vite dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`).
- `ROLL_CALL_HOST` / `HOST` — bind host (default `127.0.0.1`). Currently
  consumed by the config helper; the dev `uvicorn --reload` command still
  uses uvicorn defaults.
- `ROLL_CALL_PORT` / `PORT` — bind port (default `8000`). Invalid values
  raise on startup; silent fallbacks would mask deployment mistakes.

See `backend/.env.example` for a starter file.

## Data location

The SQLite database lives in a different directory depending on how the
backend is launched:

- **Dev source mode** (running `uvicorn app.main:app`): `backend/data/app.db`.
- **Packaged mode** (PyInstaller binary, or `ROLL_CALL_PACKAGED=1`):
  - macOS: `~/Library/Application Support/RollCall/app.db`
  - Windows: `%LOCALAPPDATA%\RollCall\app.db`
  - Linux: `~/.local/share/RollCall/app.db`
- Either mode can be overridden by `ROLL_CALL_DATA_DIR=/your/path`.

The app does **not** auto-migrate `backend/data/app.db` into the packaged
location. If you need to move dev data into a packaged install, copy the
file manually, e.g. on macOS:

```bash
mkdir -p "$HOME/Library/Application Support/RollCall"
cp backend/data/app.db "$HOME/Library/Application Support/RollCall/app.db"
```

## PyInstaller PoC build

Phase 4-5B-1 ships a `pyinstaller.spec` that bundles the backend + frontend
into a single `--onedir` distribution. This is a proof-of-concept — not yet
signed, notarized, or cross-platform.

### One-time setup

```bash
python -m pip install pyinstaller     # dev-only, not in requirements.txt
```

### Build

From the repo root:

```bash
./scripts/build_binary.sh
```

The script rebuilds the frontend, then runs
`python -m PyInstaller backend/pyinstaller.spec --clean --noconfirm`. Output
lands in:

```text
backend/dist/roll_call_backend/roll_call_backend
```

Both `backend/build/` and `backend/dist/` are gitignored.

### Run the binary

```bash
./backend/dist/roll_call_backend/roll_call_backend
# or with a custom port
ROLL_CALL_PORT=8001 ./backend/dist/roll_call_backend/roll_call_backend
```

Then open `http://127.0.0.1:8000/` in a browser.

### Notes

- The packaged binary always runs in **packaged mode** (`sys.frozen=True`),
  so the SQLite database is written to the user data dir (see *Data
  location* above) — never to `backend/data/`.
- macOS Gatekeeper will block the first launch ("cannot verify the
  developer"). Right-click → Open the first time to allow it. Code signing
  / notarization is a future phase.
- Browser fallback (`xlsx-populate`) is irrelevant in packaged mode because
  the bundled backend is always reachable from the bundled frontend.

## Verified Python interpreter

This backend is currently verified on **CPython 3.12.4** using the pinned
versions in `requirements.txt`. The repo's `backend/.venv` directory may be
out of sync with these requirements and is not used by the test suite.
Recreate or update it as needed:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
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
