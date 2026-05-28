#!/usr/bin/env bash
# Build the PyInstaller --onedir binary for the Roll Call backend.
#
# Output:
#   backend/dist/roll_call_backend/roll_call_backend
#
# Always re-builds the frontend so the bundled dist/ matches the current source.
# PyInstaller is invoked via `python -m PyInstaller` to ensure the correct
# Python environment is used (matches the one that holds fastapi / openpyxl
# / sqlalchemy etc.).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

log() {
  echo ""
  echo "==> $*"
}

# 1. Confirm PyInstaller is importable in the active Python.
log "Checking PyInstaller..."
if ! python -m PyInstaller --version >/dev/null 2>&1; then
  echo "ERROR: PyInstaller not installed in the active Python." >&2
  echo "Install once with:" >&2
  echo "  python -m pip install pyinstaller" >&2
  exit 1
fi
echo "PyInstaller $(python -m PyInstaller --version)"

# 2. Confirm npm exists; rebuild the frontend so dist/ matches source.
log "Checking npm..."
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js 24+ from nodejs.org." >&2
  exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
  log "Installing frontend dependencies..."
  npm install --prefix frontend
fi

log "Building frontend..."
npm run build --prefix frontend

# 3. Run PyInstaller through the active Python's module entrypoint.
log "Building backend binary (PyInstaller --onedir)..."
cd backend
python -m PyInstaller pyinstaller.spec --clean --noconfirm
cd "$REPO_ROOT"

# 4. Report output location.
BINARY="backend/dist/roll_call_backend/roll_call_backend"
if [ -x "$BINARY" ]; then
  log "Binary ready:"
  echo "  $REPO_ROOT/$BINARY"
  echo ""
  echo "Run with:"
  echo "  $BINARY"
  echo ""
  echo "Or with a custom port:"
  echo "  ROLL_CALL_PORT=8001 $BINARY"
else
  echo "ERROR: expected binary missing at $BINARY" >&2
  exit 1
fi
