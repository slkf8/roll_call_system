#!/usr/bin/env bash
# Package the already-built PyInstaller bundle into a portable release folder.
#
# Output:
#   release/RollCall_Portable_macOS/
#     啟動 RollCall.command   (Finder double-click entry; UTF-8 Chinese name)
#     README.txt              (end-user instructions, generated below)
#     roll_call_backend/      (copied verbatim from backend/dist/roll_call_backend)
#       roll_call_backend
#       _internal/
#       data/                 (empty; first launch creates app.db)
#
# Prerequisite:
#   scripts/build_binary.sh must have produced
#     backend/dist/roll_call_backend/roll_call_backend
#   The script fails fast if the binary is missing -- it never invokes
#   PyInstaller itself.
#
# Usage:
#   ./scripts/package_release.sh           # build release folder
#   ./scripts/package_release.sh --zip     # also produce RollCall_Portable_macOS.zip
#
# What this script does NOT do:
#   - Build the binary (that's scripts/build_binary.sh).
#   - Sign / notarize.
#   - Cross-compile for Windows / Linux.
#   - Bundle a seed database; any app.db copied from the source bundle is
#     deleted so the release ships in a clean state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ---------- Flags ----------
MAKE_ZIP=false
for arg in "$@"; do
  case "$arg" in
    --zip)
      MAKE_ZIP=true
      ;;
    -h|--help)
      sed -n '1,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      echo "Usage: $0 [--zip]" >&2
      exit 2
      ;;
  esac
done

# ---------- Paths ----------
BUNDLE_SRC="$REPO_ROOT/backend/dist/roll_call_backend"
BINARY_SRC="$BUNDLE_SRC/roll_call_backend"
RELEASE_ROOT="$REPO_ROOT/release"
RELEASE_NAME="RollCall_Portable_macOS"
RELEASE_DIR="$RELEASE_ROOT/$RELEASE_NAME"

log() { echo ""; echo "==> $*"; }

# ---------- Preflight ----------
if [ ! -x "$BINARY_SRC" ]; then
  echo "ERROR: PyInstaller binary not found at:" >&2
  echo "  $BINARY_SRC" >&2
  echo "Run ./scripts/build_binary.sh first." >&2
  exit 1
fi

# ---------- (Re)create release folder ----------
log "Preparing release folder: $RELEASE_DIR"
mkdir -p "$RELEASE_ROOT"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# ---------- Copy bundle ----------
log "Copying PyInstaller bundle..."
cp -R "$BUNDLE_SRC" "$RELEASE_DIR/roll_call_backend"

# Strip any seeded DB. The source bundle may contain a development / acceptance
# DB from prior runs; the release ships clean so end users see an empty system
# on first launch. The data/ directory itself is kept so first launch only has
# to write app.db, not also mkdir.
DEST_DATA_DIR="$RELEASE_DIR/roll_call_backend/data"
mkdir -p "$DEST_DATA_DIR"
removed_any=false
for f in app.db app.db-journal app.db-wal app.db-shm; do
  if [ -e "$DEST_DATA_DIR/$f" ]; then
    rm -f "$DEST_DATA_DIR/$f"
    removed_any=true
  fi
done
if [ "$removed_any" = true ]; then
  echo "  (removed seeded DB artifacts; release is clean)"
fi

# ---------- Generate launcher (.command) ----------
log "Generating launcher..."
LAUNCHER="$RELEASE_DIR/啟動 RollCall.command"
# Use a quoted heredoc so $PORT / ${BASH_SOURCE[0]} etc. survive verbatim
# into the generated file rather than being expanded now.
cat > "$LAUNCHER" <<'LAUNCHER_EOF'
#!/usr/bin/env bash
# 出席點名系統 — Portable Launcher (macOS)
# Finder 雙擊本檔即可啟動，按 Ctrl+C 停止。
#
# Honors ROLL_CALL_PORT (default 8000). Pass it via Terminal:
#   ROLL_CALL_PORT=8001 ./啟動\ RollCall.command

set -u

# 1. 切回自身所在資料夾（Finder 雙擊時 cwd 不確定）。
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

PORT="${ROLL_CALL_PORT:-8000}"
URL="http://127.0.0.1:${PORT}/"

echo ""
echo "================================================"
echo " 出席點名系統 — Portable"
echo "------------------------------------------------"
echo " 網址：${URL}"
echo " 停止：按 Ctrl+C"
echo "================================================"
echo ""

# 2. 背景輪詢 /health；OK 後再 open browser，避免固定 sleep 造成 race。
#    最多輪詢 ~30 秒（60 次 * 0.5s），逾時放棄自動開啟、不影響前景程式。
(
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -fs "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
      open "${URL}" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
) &

# 3. 前景執行 binary；exec 讓 Ctrl+C 直達 uvicorn，Terminal 視窗保留。
exec "./roll_call_backend/roll_call_backend"
LAUNCHER_EOF
chmod +x "$LAUNCHER"

# ---------- Generate README.txt ----------
log "Generating README.txt..."
cat > "$RELEASE_DIR/README.txt" <<'README_EOF'
出席點名系統 — Portable (macOS)
================================

這是出席點名系統的可攜帶版本。
整個資料夾就是「程式 + 資料」，搬到哪裡都能用，
不會寫入 macOS 系統的任何使用者資料夾。

────────────────────────────────────────
一、如何啟動
────────────────────────────────────────
方法 A（推薦）：
  在 Finder 內，雙擊「啟動 RollCall.command」。
  Terminal 視窗會自動打開，程式開好之後會自動跳出瀏覽器。

方法 B（手動）：
  打開 Terminal，cd 到本資料夾，執行：
    ./roll_call_backend/roll_call_backend

────────────────────────────────────────
二、瀏覽器網址
────────────────────────────────────────
  http://127.0.0.1:8000

  若用 ROLL_CALL_PORT=8001 啟動，網址會改成
    http://127.0.0.1:8001
  （啟動視窗最上方會印出實際網址，照貼即可。）

────────────────────────────────────────
三、如何停止
────────────────────────────────────────
  在 Terminal 視窗按 Ctrl+C。

────────────────────────────────────────
四、資料位置
────────────────────────────────────────
  roll_call_backend/data/app.db

  這個檔案就是你所有的學生 / 排程 / 出席紀錄。
  首次啟動時會自動建立空白資料庫。

────────────────────────────────────────
五、如何備份
────────────────────────────────────────
  - 最簡單：複製整個 RollCall_Portable_macOS 資料夾。
  - 最小：至少備份 roll_call_backend/data/app.db。

────────────────────────────────────────
六、如何搬移 / 換電腦
────────────────────────────────────────
  整個 RollCall_Portable_macOS 資料夾搬到新位置即可，
  資料會跟著資料夾走，不需要任何匯入步驟。

────────────────────────────────────────
七、Port 8000 被佔用怎麼辦
────────────────────────────────────────
  打開 Terminal，cd 到本資料夾後執行：
    ROLL_CALL_PORT=8001 ./啟動\ RollCall.command
  或：
    ROLL_CALL_PORT=8001 ./roll_call_backend/roll_call_backend

────────────────────────────────────────
八、macOS 安全提示（重要）
────────────────────────────────────────
  首次雙擊「啟動 RollCall.command」或執行 binary 時，
  macOS 可能會跳出「無法驗證開發者」的警告。

  解法：
    在 Finder 對該檔案按住 Control → 點「打開」
    → 在彈出的視窗再點一次「打開」即可。

  之後就能正常雙擊。
  （本版本尚未進行 Apple Developer 簽章 / Notarization。）

────────────────────────────────────────
九、注意事項
────────────────────────────────────────
  - 請勿刪除 roll_call_backend/data/app.db（除非你要清空所有資料）。
  - 本程式不會寫入 ~/Library/...，也不是安裝版。
  - 如要清空全部資料：先備份，再刪掉 data/app.db，
    下次啟動會自動產生空白資料庫。

────────────────────────────────────────
十、疑難排解
────────────────────────────────────────
  - API 文件：http://127.0.0.1:8000/docs
  - 健康檢查：http://127.0.0.1:8000/health
  - 啟動失敗時，請把 Terminal 視窗中紅色錯誤訊息整段截圖回報。
README_EOF

# ---------- Summary ----------
log "Release folder ready:"
echo "  $RELEASE_DIR"
echo ""
echo "Contents:"
( cd "$RELEASE_DIR" && find . -maxdepth 2 ! -path . | sort )

# ---------- Optional zip ----------
if [ "$MAKE_ZIP" = true ]; then
  log "Creating zip archive..."
  if ! command -v zip >/dev/null 2>&1; then
    echo "ERROR: zip command not found." >&2
    exit 1
  fi
  cd "$RELEASE_ROOT"
  ZIP_NAME="${RELEASE_NAME}.zip"
  rm -f "$ZIP_NAME"
  zip -qry "$ZIP_NAME" "$RELEASE_NAME"
  echo "  $RELEASE_ROOT/$ZIP_NAME ($(du -h "$ZIP_NAME" | cut -f1))"
fi

echo ""
echo "Done."
