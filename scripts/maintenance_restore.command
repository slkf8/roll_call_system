#!/usr/bin/env bash
# 出席點名系統 — 資料回復工具 (macOS, 維修專用)
#
# 這是「只供檢修使用」的薄包裝器：它只顯示中文選單並呼叫 portable 內既有的
# roll_call_backend 二進位 CLI（list / validate / restore / history）。所有真正
# 的資料庫安全邏輯（lifecycle lock、emergency backup、原子替換、rollback、
# 完整性驗證、回復紀錄）都由二進位自己處理。
#
# 本包裝器「不會」自行：讀寫資料庫、複製/覆蓋 app.db、刪除檔案、執行任何
# 資料庫指令、終止任何程序，也不會接受任意外部路徑或變更安全旗標。
#
# 擺放位置（package 後）：
#   RollCall_Portable_macOS/maintenance/RollCall 資料回復工具.command
# 它以自身位置往上一層定位 portable root，不依賴 Terminal 當前工作目錄。

set -u

# 1. 以自身位置解析 portable root（Finder 雙擊時 cwd 不確定）。
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BIN="$ROOT/roll_call_backend/roll_call_backend"
DATA_DIR="$ROOT/roll_call_backend/data"

# 互動式才暫停（測試以管線輸入時 stdin 非 TTY，會自動略過暫停）。
pause() {
  if [ -t 0 ]; then
    printf "\n按 Enter 鍵繼續..."
    read -r _ || true
  fi
}

# 2. 確認二進位存在且可執行。
if [ ! -x "$BIN" ]; then
  echo "錯誤：找不到主程式或無法執行：" >&2
  echo "  $BIN" >&2
  echo "請確認本工具位於 RollCall_Portable_macOS/maintenance/ 內，且未移動 roll_call_backend/。" >&2
  pause
  exit 1
fi

# 每次都明確固定 ROLL_CALL_DATA_DIR 為目前 portable folder 的資料夾，
# 確保維修工具只處理這份 portable 的資料。不設定任何其他安全旗標。
call_bin() {
  ROLL_CALL_DATA_DIR="$DATA_DIR" "$BIN" "$@"
}

do_validate() {
  printf "請輸入要驗證的備份檔名（直接 Enter 取消）："
  local name
  read -r name || return 0
  if [ -z "$name" ]; then
    echo "已取消。"
    return 0
  fi
  call_bin validate "$name"
}

do_restore() {
  echo ""
  echo "目前可用備份："
  call_bin list
  echo ""
  printf "請輸入要回復的備份檔名（直接 Enter 取消）："
  local name
  read -r name || return 0
  if [ -z "$name" ]; then
    echo "已取消。"
    return 0
  fi
  echo ""
  echo "即將以備份 [$name] 覆蓋目前的 app.db。"
  echo "請務必先正常停止 RollCall 主程式，再進行回復。"
  echo "（回復前系統會自動建立 emergency backup。）"
  printf "若確定回復，請輸入大寫 RESTORE 後按 Enter（其他任何輸入皆取消）："
  local confirm
  read -r confirm || return 0
  if [ "$confirm" = "RESTORE" ]; then
    call_bin restore "$name"
  else
    echo "未輸入 RESTORE，已取消回復。"
  fi
}

# 3. 選單迴圈。EOF（輸入結束）即離開。
while true; do
  echo ""
  echo "================================================"
  echo " 出席點名系統 — 資料回復工具（維修專用）"
  echo "------------------------------------------------"
  echo " 1. 列出可用備份"
  echo " 2. 驗證指定備份"
  echo " 3. 回復指定備份"
  echo " 4. 查看回復紀錄"
  echo " 0. 離開"
  echo "================================================"
  printf "請輸入選項："

  choice=""
  read -r choice || break

  case "$choice" in
    1) call_bin list ;;
    2) do_validate ;;
    3) do_restore ;;
    4) call_bin history ;;
    0) echo "再見。"; exit 0 ;;
    "") : ;;  # 空輸入：重新顯示選單
    *) echo "無效選項：$choice" ;;
  esac

  pause
done
