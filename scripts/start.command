#!/usr/bin/env bash
# macOS Finder entry point for the source-repo one-click launcher.
# Double-clicking this file in Finder opens Terminal.app and runs the script.
# All real logic lives in start.sh; this is a thin delegator.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/start.sh"
