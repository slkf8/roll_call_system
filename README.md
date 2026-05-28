# 出席點名系統 / Roll Call System

單機版出席點名與課程管理系統。
**React + TypeScript + Vite** 前端 + **FastAPI + SQLite** 後端，由同一個本地 port 同源服務。

打開瀏覽器即可使用：管理學生、固定課表、補課 / 加課、月度統計、匯出官方 Excel 月報。

---

## 一鍵啟動

### macOS

雙擊 `scripts/start.command`，或在終端機執行：

```bash
./scripts/start.sh
```

第一次啟動會建立 Python venv、安裝後端依賴、安裝前端 `node_modules`、建構前端 — 視網路速度約需 1–3 分鐘。
後續啟動只重新 build 前端（約 2 秒），其餘步驟跳過。

啟動完成後打開瀏覽器：

```text
http://127.0.0.1:8000
```

Ctrl+C 停止。

> **macOS 首次雙擊 `.command` 若提示無法執行**：在終端機跑一次
>
> ```bash
> chmod +x scripts/start.command scripts/start.sh
> ```
>
> 之後就能直接雙擊。

### Linux

```bash
./scripts/start.sh
```

### Windows

雙擊 `scripts\start.bat`，或在 cmd / PowerShell 執行：

```cmd
scripts\start.bat
```

> ⚠️ Windows 啟動腳本邏輯與 bash 版本相同，但目前**尚未在 Windows 實機驗證**。如遇問題請改走下方「手動啟動」流程，並回報所見錯誤。

### 換 port

當 8000 已被佔用：

```bash
ROLL_CALL_PORT=8001 ./scripts/start.sh
```

或 Windows：

```cmd
set ROLL_CALL_PORT=8001 && scripts\start.bat
```

---

## 手動啟動（開發者）

```bash
# 1. 建構前端
cd frontend
npm install
npm run build
cd ..

# 2. 啟動後端 production runner（同 port serve frontend + API）
cd backend
python -m venv .venv
source .venv/bin/activate           # macOS / Linux
# .venv\Scripts\activate            # Windows
.venv/bin/python -m pip install -r requirements.txt
python run.py
```

打開瀏覽器：http://127.0.0.1:8000

開發模式（前後端分離、Vite hot reload）：

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

---

## 資料儲存

| 模式 | SQLite 路徑 |
|---|---|
| Source mode（目前一鍵啟動） | `backend/data/app.db` |
| 未來 PyInstaller 打包版 | macOS：`~/Library/Application Support/RollCall/app.db`<br>Windows：`%LOCALAPPDATA%\RollCall\app.db`<br>Linux：`~/.local/share/RollCall/app.db` |
| 自訂位置 | 任何模式都可 `ROLL_CALL_DATA_DIR=/your/path` 覆蓋 |

詳細環境變數（`ROLL_CALL_PACKAGED` / `ROLL_CALL_ALLOWED_ORIGINS` / `ROLL_CALL_HOST` 等）見 [backend/README.md](backend/README.md)。

---

## 常見問題

**Q: port 8000 被占用怎麼辦？**

```bash
ROLL_CALL_PORT=8001 ./scripts/start.sh
```

啟動腳本會自動把 CORS allowed origins 對應到新 port。

**Q: 第一次啟動很慢？**

首次需要：
- 建立 Python venv 並安裝 9 個後端依賴
- 安裝 ~300+ 個前端 npm packages
- 建構前端 production bundle

之後啟動只重 build（~2 秒）+ 重啟 uvicorn。

**Q: macOS 雙擊 `.command` 跳出「無法執行」？**

```bash
chmod +x scripts/start.command scripts/start.sh
```

**Q: 想看 API 文件？**

啟動後打開：

```text
http://127.0.0.1:8000/docs
```

**Q: 想換資料庫位置？**

```bash
ROLL_CALL_DATA_DIR="$HOME/MyRollCallData" ./scripts/start.sh
```

**Q: 我是開發者，要怎麼跑 tests？**

```bash
# Backend
cd backend && python -m pytest tests

# Frontend
cd frontend && npm test

# Frontend production build
cd frontend && npm run build
```

---

## 目前打包狀態

這是**從原始碼一鍵啟動的版本**，**不是 PyInstaller binary**。
使用者需要本機已安裝：

- Python 3.12+
- Node.js 24+ / npm 11+

後續會做 PyInstaller 打包版（Phase 4-5B），讓使用者不需要裝 Python / Node 即可使用。

---

## 系統結構（簡述）

```
backend/   FastAPI + SQLAlchemy + SQLite
  app/
    config.py        # 環境變數與路徑解析
    main.py          # ASGI app + CORS + StaticFiles mount
    database.py      # SQLAlchemy engine
    routers/         # 6 個 API router
    excel_export.py  # openpyxl-based 模板填寫
  run.py             # Production entrypoint
  tests/             # 122 個 pytest

frontend/  React 19 + TypeScript + Vite + Tailwind 4
  src/
    pages/           # TodayPage / MonthPage / StudentsPage / DataPage
    api/             # 6 個 backend API client
    config.ts        # API_BASE_URL（fallback 127.0.0.1:8000）
    shared/          # 共享 types / seed / UI 元件
  __tests__/         # 177 個 vitest

scripts/   一鍵啟動腳本
  start.sh           # 主邏輯
  start.command     # macOS Finder 入口
  start.bat          # Windows 入口（未實機驗證）
```

更多開發者文件：

- [backend/README.md](backend/README.md) — backend 設置、環境變數、production runner
- [frontend/.env.example](frontend/.env.example) — frontend 環境變數範例
- [backend/.env.example](backend/.env.example) — backend 環境變數範例
