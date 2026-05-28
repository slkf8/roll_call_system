#!/usr/bin/env bash
# Bootstrap the source repo and launch the backend production runner.
#
# Usage:
#   ./scripts/start.sh                         # default port 8000
#   ROLL_CALL_PORT=8001 ./scripts/start.sh     # override port
#
# Behaviour:
#   1. Ensures backend/.venv exists and pins to backend/requirements.txt.
#   2. Ensures frontend/node_modules exists (only `npm install` when missing).
#   3. Rebuilds frontend/dist via `npm run build` on every launch.
#   4. Execs backend/run.py via the venv python.
#
# Press Ctrl+C to stop. The signal is delivered straight to uvicorn via exec.

set -euo pipefail

# Locate repo root from the script's own location so cwd doesn't matter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

log() {
  echo ""
  echo "==> $*"
}

# 1. Python
log "Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3.12+ from python.org or via Homebrew." >&2
  exit 1
fi
python3 --version

# 2. Backend venv
VENV_DIR="backend/.venv"
PY="$VENV_DIR/bin/python"
if [ ! -d "$VENV_DIR" ]; then
  log "Creating backend venv at $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
  "$PY" -m pip install --quiet --upgrade pip
fi

# 3. Backend dependencies (use the venv python's -m pip, never bare pip).
log "Installing backend dependencies..."
"$PY" -m pip install --quiet -r backend/requirements.txt

# 4. npm
log "Checking npm..."
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js 24+ from nodejs.org." >&2
  exit 1
fi
npm --version

# 5. Frontend dependencies (only when node_modules is missing).
if [ ! -d "frontend/node_modules" ]; then
  log "Installing frontend dependencies..."
  npm install --prefix frontend
else
  log "Frontend node_modules present; skipping npm install."
fi

# 6. Build frontend (always — fast, keeps dist in sync with the source tree).
log "Building frontend..."
npm run build --prefix frontend

# 7. Launch backend production runner.
PORT="${ROLL_CALL_PORT:-8000}"
log "Starting Roll Call backend on http://127.0.0.1:${PORT}"
echo "Open the URL above in your browser. Press Ctrl+C to stop."
echo ""

exec "$PY" backend/run.py
