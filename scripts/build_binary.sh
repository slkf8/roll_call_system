#!/usr/bin/env bash
# Build the PyInstaller --onedir binary for the Roll Call backend.
#
# Output:
#   backend/dist/roll_call_backend/roll_call_backend
#
# Always re-builds the frontend so the bundled dist/ matches the current source.
#
# Build Python selection (highest priority first):
#   1. $PYTHON_BIN — explicit override (e.g. PYTHON_BIN=/opt/anaconda3/bin/python).
#      The selected Python MUST already have PyInstaller installed; the script
#      will fail loudly rather than silently fall back.
#   2. backend/.venv-build/bin/python — auto-created on first run with only the
#      packages in backend/requirements.txt + pyinstaller. This keeps the
#      bundle small and reproducible.
#
# To rebuild the clean venv from scratch (e.g. after requirements.txt changes):
#   rm -rf backend/.venv-build && ./scripts/build_binary.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CLEAN_VENV="$REPO_ROOT/backend/.venv-build"

log() {
  echo ""
  echo "==> $*"
}

# ---------- Select build Python ----------
if [ -n "${PYTHON_BIN:-}" ]; then
  PY="$PYTHON_BIN"
  log "Using PYTHON_BIN override: $PY"
  if ! "$PY" --version >/dev/null 2>&1; then
    echo "ERROR: PYTHON_BIN=$PY is not executable or not a valid Python." >&2
    exit 1
  fi
  if ! "$PY" -m PyInstaller --version >/dev/null 2>&1; then
    echo "ERROR: PyInstaller not installed in $PY." >&2
    echo "Install it there first, e.g.:" >&2
    echo "  $PY -m pip install pyinstaller" >&2
    exit 1
  fi
else
  if [ ! -d "$CLEAN_VENV" ]; then
    log "Bootstrapping clean build venv at $CLEAN_VENV..."
    if ! command -v python3 >/dev/null 2>&1; then
      echo "ERROR: python3 not found. Install Python 3.12+ from python.org or via Homebrew." >&2
      exit 1
    fi
    python3 -m venv "$CLEAN_VENV"
    "$CLEAN_VENV/bin/pip" install --quiet --upgrade pip
    "$CLEAN_VENV/bin/pip" install --quiet -r "$REPO_ROOT/backend/requirements.txt"
    "$CLEAN_VENV/bin/pip" install --quiet pyinstaller
  fi
  PY="$CLEAN_VENV/bin/python"
  log "Using clean build venv: $PY"
fi

"$PY" --version
"$PY" -m PyInstaller --version

# ---------- Frontend build ----------
log "Checking npm..."
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js 24+ from nodejs.org." >&2
  exit 1
fi

if [ ! -d "$REPO_ROOT/frontend/node_modules" ]; then
  log "Installing frontend dependencies..."
  npm install --prefix "$REPO_ROOT/frontend"
fi

log "Building frontend..."
npm run build --prefix "$REPO_ROOT/frontend"

# ---------- Backend binary ----------
log "Building backend binary (PyInstaller --onedir)..."
cd "$REPO_ROOT/backend"
"$PY" -m PyInstaller pyinstaller.spec --clean --noconfirm
cd "$REPO_ROOT"

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
