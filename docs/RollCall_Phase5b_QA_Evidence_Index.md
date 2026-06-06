# RollCall Phase 5b QA Evidence Index

> 本文件**索引** Phase 5b isolated localhost UI 驗收的 evidence，不複製大型 JSON 或 binary；列出路徑、用途、驗收結論與保留要求。

## 1. Evidence 基線

| 項目 | 值 |
|---|---|
| 對應 commit | `0118d0c139cdf3dee56d48c3e6b060d3cada7a9c` |
| data dir fingerprint | `f89c01e40d51fe5c` |
| isolated backend（驗收期間） | `http://127.0.0.1:8011`（已停止） |
| isolated frontend（驗收期間） | `http://127.0.0.1:5173`（已停止） |
| evidence 根目錄 | `/private/tmp/RollCall_Phase5b_UI_Acceptance.WIa9V3/` |

驗收結束後 backend / frontend 皆已 graceful 停止、兩埠 free；evidence 全數保留。

## 2. Isolated localhost 環境

evidence 根目錄：`/private/tmp/RollCall_Phase5b_UI_Acceptance.WIa9V3/`

| 路徑 | 用途 |
|---|---|
| `data/app.db` | isolated SQLite DB（synthetic 資料；**非**正式資料） |
| `data/app.lock` | OS lifecycle lock（backend 停止後不再持有，檔案保留為 0 byte） |
| `evidence/environment.txt` | 啟動環境變數、URL、fingerprint 等 |
| `evidence/expected_fingerprint.txt` | 預期 data dir fingerprint（`f89c01e40d51fe5c`） |
| `evidence/backend.pid` / `evidence/backend.log` | 首次啟動 backend 的 PID / log |
| `evidence/frontend.pid` / `evidence/frontend.log` | frontend（Vite）PID / log |
| `evidence/health.json` | 首次 `/health` 回應 |
| `evidence/STOP_cors_gate.txt` | CORS gate 過程紀錄（run.py 限制與解法） |

## 3. Synthetic seed

| 路徑 | 用途 |
|---|---|
| `evidence/seed_manifest.json` | synthetic seed 清單（學生 / rules / sessions / 建議刪除與保留日期） |
| `evidence/seed_responses/` | 各筆建立 API 回應（students / rules / sessions、verify_sessions_june.json） |

seed 概要（月份 2026-06，全為 synthetic 假名）：

- 學生：測試學生甲（id 1）、測試學生乙（id 2），皆 active。
- 固定課表：rule 1（甲，週一 16:00）、rule 2（乙，週三 17:00）。
- 課次：
  - 2026-06-08：id 1 regular/absent（甲，跨範圍 makeup 來源）、id 2 regular/present（乙）、id 3 regular/cancelled（甲）。
  - 2026-06-15：id 4 makeup/pending（甲，`makeupOfSessionId=1`、`makeupOfDateISO=2026-06-08`）、id 5 extra/pending（乙）。

## 4. 批量移除後 API 一致性證據

| 路徑 | 用途 |
|---|---|
| `evidence/post_delete_sessions.json` | 刪除 2026-06-08/09/10 後的 June sessions |
| `evidence/post_delete_students.json` | 刪除後學生仍存在 |
| `evidence/post_delete_schedule_rules.json` | 刪除後固定課表規則仍存在 |
| `evidence/UI_B_readonly_consistency_report.txt` | Phase 5b-UI-B 唯讀一致性報告 |

刪除前 / 後對照：

| 日期 | 刪除前 | 刪除後 |
|---|---|---|
| 2026-06-08 | 3 節 manual regular（absent / present / cancelled） | 0 節 |
| 2026-06-09 | 0 節 | 0 節 |
| 2026-06-10 | 0 節 | 0 節 |
| 2026-06-15 | 2 節（makeup / extra） | 2 節（保留） |

跨範圍 makeup（id 4）刪除後：`makeupOfSessionId = null`（detach）、`makeupOfDateISO = 2026-06-08`（保留）。

## 5. Backend stop→restart 證據

| 路徑 | 用途 |
|---|---|
| `evidence/UI_C1_backend_stopped.txt` | 停止 backend、保留 frontend 的紀錄 |
| `evidence/backend_restarted.pid` / `evidence/backend_restart.log` | 重啟 backend 的 PID / log |
| `evidence/health_after_restart.json` | 重啟後 `/health`（fingerprint `f89c01e40d51fe5c`） |
| `evidence/sessions_after_restart.json` | 重啟後 sessions（持久性確認） |
| `evidence/students_after_restart.json` | 重啟後學生 |
| `evidence/schedule_rules_after_restart.json` | 重啟後固定課表規則 |
| `evidence/UI_C3_backend_restart_report.txt` | Phase 5b-UI-C3 重啟重驗報告 |
| `evidence/UI_R3_services_stopped_report.txt` | Phase 5b-R3 收尾（services 停止）報告 |

結論：isolated data 經 stop→restart 完整保存；fingerprint / CORS / sessions / students / rules / makeup detach 皆正確。

## 6. Browser UI screenshots

目錄：`/private/tmp/phase5b-ui-a-r3/`

- `01-continued-selection-8-9-10.png`
- `02-dryrun-preview-breakdown.png`
- `03-danger-confirmation-sheet.png`
- `04-after-confirm-remove-toast-month.png`
- `05-zero-class-preview-date-20.png`
- `06-event-mode-operation-bar.png`
- `07-drawer-batch-mode-event-mode.png`

## 7. Backend unavailable regression screenshots

目錄：`/private/tmp/phase5b-ui-c2-r3/`

- `A1-stale-menu-open.png`
- `A2-stale-remove-blocked-toast.png`
- `B1-reloaded-frontend-backend-offline.png`
- `B2-reloaded-menu-open.png`
- `B3-reloaded-remove-blocked-toast.png`

涵蓋 stale-state（A）與 offline-first reload（B）兩種情境的入口阻擋與 Toast。

## 8. Evidence 保留規則

- 不得自動清理 evidence（`/private/tmp/RollCall_Phase5b_UI_Acceptance.WIa9V3/` 及兩個 screenshots 目錄）。
- 不得將 isolated SQLite DB 複製回正式 `backend/data/`。
- 不得將 tmp evidence 納入 Git。
- 未取得使用者批准前不得刪除。

## 9. 最終驗收結論

- 自動化 + 人工 UI + backend-unavailable + stop/restart 驗收皆 **PASS**。
- 功能鏈已封存於 `origin/main @ 0118d0c139cdf3dee56d48c3e6b060d3cada7a9c`。
- RC8 baseline 維持：`portable-release-candidate-8` → `2f91adaa12e775b41a2ca6fc5d58dd746f2373ec`；artifact SHA-256 `64c775db3f6791af2f4bc20256105da4b24139ac0749bfe98b2fb8546fbb567d`（未變動，尚未建立 RC9）。
