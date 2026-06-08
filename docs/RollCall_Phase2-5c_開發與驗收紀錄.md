# RollCall Phase 2-5c 開發與驗收紀錄

> 完整追溯本輪「批量生成入口搬移 + guarded 批量移除」功能鏈的演進、設計理由、缺陷、修正與驗收結果，供日後 audit；避免逐條複製對話與終端輸出。

## 1. 範圍與目標

將批量生成固定課次入口由 `StudentsPage` 搬移至 `MonthPage`，並新增一條 DB-first、fail-closed 的 guarded 批量移除日期內課次功能鏈，含完整 race-condition 防護與 backend unavailable 保護，最終整合驗收後一次性推送至 `origin/main`。

對應 commit 基線：`0118d0c139cdf3dee56d48c3e6b060d3cada7a9c`。

## 2. Phase 2：regularSessions helper 抽取

- commit：`d7005d0 refactor(sessions): extract regular session generation helpers`。
- 將固定課次生成邏輯抽出為 `frontend/src/shared/regularSessions.ts`（含 `regularSessions.test.ts`），供批量生成重用。
- weekday 比對採 JS `Date.getDay()`（週日=0、週一=1…）。

## 3. Phase 3：批量生成入口搬移

- commit：`5c423b7 feat(month): move batch regular-session generation to calendar`。
- `StudentsPage` 收斂為學生資料、固定課表規則與單一學生操作；移除批量生成入口（`StudentsPage.tsx` 大幅刪減、`StudentsPage.test.tsx` 對應調整）。
- 批量生成集中至 `MonthPage`「批量操作」Menu，Sheet 以 `viewDate` 當月為錨點。

## 4. Phase 4a：bulk-delete API client

- commit：`40785b6 feat(sessions-api): add guarded bulk-delete client`。
- 新增 `bulkDeleteSessions(dates, dryRun)`（`frontend/src/api/sessionsApi.ts`），對應 backend `POST /api/sessions/bulk-delete`。
- 嚴格 parser：驗證 `ok`、`dryRun` echo、`removedCount` / `detachedMakeupCount` 非負整數、breakdown 各欄非負整數；任何不符即 throw（fail closed 的基礎）。

## 5. Phase 4b：bulkRemove frontend state sync helper

- commit：`e75d5d8 feat(sessions): add bulk-remove state sync helper`。
- 新增 `applyBulkRemovalToSessions`（`frontend/src/shared/bulkRemove.ts` + 測試）：backend 成功刪除後，前端鏡像移除對應日期課次，並對跨範圍存活 makeup detach `makeupOfSessionId`、保留 `makeupOfDateISO`。

## 6. Phase 4c：MonthPage guarded 批量移除 UX

- commit：`f9d90e0 feat(month): add guarded bulk session removal workflow`。
- 核心語意：
  - remove mode 與 event mode 使用 `BatchMode` union。
  - `selectedDates` 支援不連續點選、再次點擊取消、日期範圍合併（Set 聯集）。
  - 日期範圍僅限 `viewDate` 當月（跨月 / from>to / 未完整填寫皆行內錯誤）。
  - Preview 使用 `POST /api/sessions/bulk-delete`，`dryRun=true`，顯示 breakdown。
  - `removedCount === 0` 時不得出現「繼續」。
  - 正式刪除使用 **preview dates snapshot**，不重新讀 `selectedDates`。
  - 正式 API 成功後使用 `applyBulkRemovalToSessions` 同步 frontend state。
  - commit 失敗不得 mutate frontend sessions、不清 `selectedDates`、不離開 remove mode（Toast「移除失敗，資料未變更」）。

## 7. Phase 4c-H1：同步防重鎖

- `bulkRemovePreviewLockRef`、`bulkRemoveCommitLockRef`：在 API 呼叫前 acquire、`finally` release，避免 React re-render（disabled 生效）前的快速重複送 request。
- 搭配 loading state 驅動按鈕 disabled 與「處理中…」、confirm onClick guard。

## 8. Phase 4c-H2：context token 與 commit pending 退出阻擋

- `bulkRemoveContextVersionRef` + `invalidateBulkRemoveContext()`：async callback 在 request 起始時 snapshot version，若使用者其後退出 / 改選日期 / 重新進入 / 關閉 preview，則丟棄該 callback 的 UI 寫入（阻擋 stale resolve / reject 寫回新一輪 UI）。
- 失效點共 5 處：進入 remove mode、`exitBatchMode()`、remove mode 內 toggle 日期、`applyRemoveRange()` 驗證通過、`closeBulkRemovePreview()`。
- commit pending 時阻擋 header X、Confirm Sheet 左「取消」與 overlay close（commit 成功後 sessions 鏡像無條件同步；UI cleanup 與 Toast 依 context token 條件執行）。

## 9. Phase 4c-H2.1：保留 pending preview loading

- `exitBatchMode()` 在 preview lock=true（舊 preview request 仍 pending）時**不**提前清除 loading；loading 由原 async handler 的 `finally` 重設。
- 解決「preview pending → 退出 → 立即重新進入 remove mode → loading 被提前清為 false → 按鈕看似可按但 handler 因 H1 lock 靜默 return」的 UX race。

## 10. Phase 5a：自動化整合驗收

- 對未 push 的完整功能鏈做唯讀自動化整合驗收：repo gate、diff inventory（僅 frontend）、backend pytest、frontend targeted / full、build、whitespace。全數通過。

## 11. Phase 5b：isolated localhost UI 驗收

- 由 Claude Code 建立 isolated localhost 環境（獨立 tmp data dir、synthetic seed），交由 Codex / 人工瀏覽器驗收。
- 流程涵蓋批量生成入口、批量移除 dryRun preview、紅色二次確認、正式刪除、跨範圍 makeup detach、makeupOfDateISO 保留、零課次 preview 阻擋、event mode / Drawer 回歸。
- 期間踩到 `run.py` 的 CORS 結構限制（見 §18），以啟動時 `ROLL_CALL_ALLOWED_ORIGINS` 顯式加入 5173 origins 解決（未改 repo）。

## 12. 發現的 stale backend availability defect

- **缺陷**：`App.tsx` 的 `isSessionsBackendAvailable` 只在 mount 時透過 `fetchSessions()` 探測一次（effect deps `[]`）。backend online → offline 後 prop 仍為 stale `true`。
- **後果**：點「批量操作 → 批量移除日期內課次」時，入口僅看 stale boolean，**未顯示離線 Toast 並錯誤進入 remove mode**。
- **資料安全**：仍成立——preview / commit 真正的 HTTP request 離線時 reject，既有 catch 路徑 fail closed；屬入口 UX defect，非資料安全缺陷。

## 13. /health 即時 probe 修正

- commit：`0118d0c fix(month): probe backend health before bulk session removal`。
- 新增 `checkSessionsBackendHealth()`（`sessionsApi.ts`）：`GET ${API_BASE_URL}/health`；非 2xx → throw `Failed to check sessions backend health: <status>`；network reject 自然向上 throw；payload 須為 object 且 `ok === true`，否則 throw `Invalid sessions backend health response`；成功 resolve void。不驗 fingerprint、無 retry / polling / timeout 抽象、不改 backend。
- `MonthPage` 入口改為 `enterBulkRemoveMode()`：先收起 Menu → entry probe lock guard → `await checkSessionsBackendHealth()` → 成功 `invalidateBulkRemoveContext()` + 清 `selectedDates` + 進 remove mode；失敗 Toast「資料庫未連線，暫時無法批量移除課次」且不進 mode；`finally` release lock。
- 新增獨立 `bulkRemoveEntryProbeLockRef`（不重用 / 不改寫 H1 / H2 既有 locks）。
- `runBulkRemovePreview()` / `runBulkRemoveCommit()` 移除對 `isSessionsBackendAvailable` 的前置 early-return，改由實際 `bulkDeleteSessions(dates, true/false)` 作為權威、失敗 fail closed。如此 online→offline 與 offline→online 兩方向都不再被 stale prop 破壞。

## 14. Backend unavailable browser regression

- 由 Codex 於離線 backend、線上 frontend 重驗：
  - A. stale-state（舊頁未 reload，backend 離線）→ 點入口 → Toast 正確 → 不進 remove mode。
  - B. offline-first（reload 後 backend 仍離線）→ 點入口 → Toast 正確 → 不進 remove mode。
- 實際 Toast：「資料庫未連線，暫時無法批量移除課次」。結果 PASS。

## 15. Backend stop→restart 持久性核對

- 以相同 isolated data dir 重啟 backend 後唯讀重驗：fingerprint `f89c01e40d51fe5c`、CORS（`http://127.0.0.1:5173`）、sessions（06-15 保留 2 筆；08/09/10=0）、students（甲/乙）、rules（1/2）皆持久且正確；跨範圍 makeup 的 `makeupOfSessionId=null`、`makeupOfDateISO=2026-06-08` 保留。

## 16. Push-readiness、單一 push 與 post-push 封存

- Phase 5c-R1 / D1：push-readiness 與 pre-push gate 全綠（remote main 未變、diff 限 12 frontend 檔、whitespace clean、ports free、RC8 baseline 未變、evidence 完整）。
- Phase 5c-D2：唯一遠端寫入 `git push origin main`，fast-forward `e1b11a1..0118d0c`（6 commits）；未推送 / 建立任何 tag、未 force。
- Phase 5c-D3：post-push 封存核對——local / tracking / remote 三者同步於 `0118d0c`，RC8 tag 與 artifact SHA 未變，evidence 保留。

## 17. 自動化測試總結

| 項目 | 結果 |
|---|---|
| backend targeted（`tests/test_sessions.py`） | 44 passed |
| backend full（`pytest -q`） | 303 passed, 1 skipped |
| frontend targeted（7 檔） | 7 files / 185 passed |
| frontend full（`npm test`） | 17 files / 342 passed |
| frontend build（`npm run build`） | PASS（僅既有 chunk-size warning） |
| whitespace（`git diff --check`） | clean |

> 註：`MonthPage.bulkRemove.test.tsx` 含 `/health` probe 入口 regression（health 成功進 mode、stale true + reject 阻擋、stale false + resolve 恢復、probe pending 連點僅 1 次）；`sessionsApi.test.ts` 含 `checkSessionsBackendHealth` 五案。

## 18. 已知限制與後續建議

- **已完成**：Phase 2-5c 功能鏈、自動化 + 人工 + backend-unavailable + stop/restart 驗收、單一 push 與封存；**DataPage 正式模板 UI / fallback manual acceptance（2026-06-07 PASS）** — backend-primary export、missing-column UI gate、browser local fallback、fallback toast 全部 PASS，backend-primary vs fallback 語義 diff 0 business differences，durable archive 已建立並驗證（詳見 [`RollCall_DataPage_OfficialTemplateExport_Acceptance_2026-06-07.md`](RollCall_DataPage_OfficialTemplateExport_Acceptance_2026-06-07.md)）。
- **已完成（RC9，2026-06-07）**：RC9 clean binary build、portable package、artifact SHA 封存、packaged binary 隔離 smoke 全部 PASS。RC9 artifact `release/RollCall_Portable_macOS_RC9.zip`，SHA256 `4e965900d80c895f4f561c837b61d491f7362c1ea8c3c09d3d1d0271e4381691`（詳見 [`RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md`](RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md)）。
- **已完成（RC9 tag）**：lightweight tag `portable-release-candidate-9` 已建立並單獨 push → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543`（local = remote，object type commit）。
- **已完成（RC10 pre-tag，2026-06-08）**：RC10 clean binary build、portable package、DB / lock exclusion、host-shell packaged binary smoke 全部 PASS。source baseline `a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`；build binary SHA256 `2b93868b5685e29bbc590c5eeafe5e5b87c34eceb7d13ed3f4f3970a46fd8df2`；RC10 artifact `release/RollCall_Portable_macOS_RC10.zip`，SHA256 `e2c0fd84f6b3ddbb24c68dd932885e14894eefd400605d90fc3c015d008366c4`（MD5 `df79d74cd2a1bb2b25d621c2d3ae9288`、size 21222640）。
  - Smoke：macOS host Terminal foreground；health PASS；root HTML PASS；GET-only API smoke PASS（students 0、sessions 0、monthly endpoint PASS）；runtime DB / lock 只建立於 throwaway lane；packaged folder 無 DB / lock 污染；`:8210` 已釋放；既有 `:5173` dev server 未操作。
  - Formal-data policy：`OPAQUE_PROTECTED_FORMAL_DATA_ZONE`；formal-data contents inspected：`no`。
  - Cleanup variance：`TOOL_LIMITATION_TERMINAL_CTRL_C_KEYSTROKE`；`ACCEPTED_EXACT_SIGINT_TO_RECORDED_LISTENER_PID`。此為 cleanup tool limitation，不是產品缺陷。
  - Evidence archive：`~/Documents/RollCall_AcceptanceArchives/RC10_BuildPreflight_2026-06-08_l6H5Ty/`；詳見 [`RollCall_RC10_Release_BinarySmoke_Acceptance_2026-06-08.md`](RollCall_RC10_Release_BinarySmoke_Acceptance_2026-06-08.md)。
  - Tag：lightweight tag `portable-release-candidate-10` 已建立並單獨 push → `a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`（local = remote，object type commit）。
  - Docs：pre-tag docs commit `06d028af0b21427826eea259c103efa708a88540` 尚未 push 至 `origin/main`；post-tag docs update 尚未 commit。
- **已完成（DataPage range stats + sticky header，2026-06-08）**：feature commit `a149ab7dbc51ae54053353670255eb714ad108a9` 新增 DataPage 老師服務月份範圍統計與主學生統計表 sticky header。
  - 行為：主卡維持單月統計；點擊開啟老師服務統計 Sheet；預設 Sep-Aug；範圍暫時調整且最多 12 個月；不寫 localStorage / global setting / DB。
  - 統計口徑：frontend sessions 聚合；present regular / makeup / extra 計入正常出席；教材服務 reasonCode 鏡像 backend 1..6。
  - Sticky：主學生表格 header sticky top-0 z-10；保持自然 page scroll；窄畫面無整頁水平溢出。
  - 測試：targeted frontend tests PASS（3 files / 82 tests）、full frontend tests PASS（18 files / 358 tests）、frontend build PASS（僅 Vite chunk-size warning，non-blocking）。
  - Browser acceptance：Control Chrome isolated acceptance PASS with `TOOL_LIMITATION_NATIVE_MONTH_INPUT`；可可靠驗收主卡、Sheet 預設、空月份 validation、cancel / reopen reset、sticky desktop / narrow、dark mode；其餘 native month input 情境由 RTL 補充。
  - Runtime cleanup：isolated frontend `:5174` 與 backend `:18031` 已釋放；既有 `:5173` dev server 未操作。
  - Archive：`~/Documents/RollCall_AcceptanceArchives/DataPage_RangeStatsAcceptance_2026-06-08_l4vOJd/`；詳見 [`RollCall_DataPage_RangeStats_StickyHeader_Acceptance_2026-06-08.md`](RollCall_DataPage_RangeStats_StickyHeader_Acceptance_2026-06-08.md)。
- **待辦**：RC10 post-tag docs stage gate、docs-only local commit、integrated main pre-push gate、單次 `git push origin main`；Windows 維修入口暫緩。
- **已知限制**：
  - `backend/run.py` 的 `_ensure_production_cors_origins()` 會 `setdefault` `ROLL_CALL_ALLOWED_ORIGINS` 為「綁定埠」origins，跨埠 Vite dev（5173）會被 CORS 拒絕，除非顯式設 `ROLL_CALL_ALLOWED_ORIGINS`、改同源（`ROLL_CALL_FRONTEND_DIST`）或以 `uvicorn app.main:app --reload` 啟動。
  - `input[type=date]` 在 Codex in-app browser 有 native picker 自動化限制。
  - Control Chrome 對 native `input[type=month]` 的部分月份值自動化有限制；DataPage range stats 的產品行為由 browser 可驗收情境與 RTL 補充共同支持。
- **建議下一步**：post-tag docs diff QA → 精準 stage → docs-only local commit → integrated main pre-push gate → 單次 `git push origin main` → 再評估 Windows 維修入口。
