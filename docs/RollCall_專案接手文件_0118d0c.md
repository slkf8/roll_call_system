# RollCall 專案接手文件

> 本文件提供給下一個 ChatGPT / Claude Code 對話快速接手，聚焦「目前狀態、架構、已完成範圍、待辦與工作流規則」，非逐步流水帳。

## 1. 文件基線

| 項目 | 值 |
|---|---|
| 文件對應 commit | `0118d0c139cdf3dee56d48c3e6b060d3cada7a9c` |
| 撰寫時間 | 2026-06-07 |
| workspace | `~/Documents/Vscode/roll_call_system` |
| 分支 | `main` |
| Git 狀態 | clean，`## main...origin/main`（無 ahead/behind） |

本文件僅描述截至上述 commit 的狀態；後續若有新 commit，請以實際 `git log` 為準。

## 2. 專案定位與技術架構

- **用途**：一對一教學場景的點名、排課、缺席原因、補課、加課、統計、備份與 Excel 匯出管理系統。
- **架構**：
  - Frontend：React + TypeScript + Vite + Tailwind CSS
  - Backend：Python + FastAPI
  - Database：SQLite（唯一 source of truth）
  - Excel：只作匯出，**不是** source of truth
- **核心原則**：
  - DB-first；高風險資料操作必須 fail closed。
  - frontend state 只是畫面鏡像；正式資料不得由 localStorage 或 React state 取代。

## 3. 當前 Git / RC 狀態

| 項目 | 值 |
|---|---|
| local main / origin/main tracking / remote main | `0118d0c139cdf3dee56d48c3e6b060d3cada7a9c`（三者一致） |
| Git worktree | clean |
| RC baseline | **RC8**（仍為現行 release baseline） |
| RC9 tag | **已建立並單獨 push**：lightweight tag `portable-release-candidate-9` → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543`（local = remote，object type commit） |
| 重新 package / binary | **RC9 package + binary smoke 已完成 PASS（2026-06-07）** |
| RC9 artifact | `release/RollCall_Portable_macOS_RC9.zip` |
| RC9 artifact SHA-256 | `4e965900d80c895f4f561c837b61d491f7362c1ea8c3c09d3d1d0271e4381691`（MD5 `a9dc9a00987559c53a827bf83afdf9b9`、size 21221405；詳見 [`RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md`](RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md)） |
| RC8 tag | `portable-release-candidate-8` → `2f91adaa12e775b41a2ca6fc5d58dd746f2373ec` |
| RC8 artifact | `release/RollCall_Portable_macOS_RC8.zip` |
| RC8 artifact SHA-256 | `64c775db3f6791af2f4bc20256105da4b24139ac0749bfe98b2fb8546fbb567d` |

本輪正式推送至 `origin/main` 的六個 commits（fast-forward `e1b11a1..0118d0c`）：

```
0118d0c fix(month): probe backend health before bulk session removal
f9d90e0 feat(month): add guarded bulk session removal workflow
e75d5d8 feat(sessions): add bulk-remove state sync helper
40785b6 feat(sessions-api): add guarded bulk-delete client
5c423b7 feat(month): move batch regular-session generation to calendar
d7005d0 refactor(sessions): extract regular session generation helpers
```

## 4. 已完成核心功能（既有基礎）

- 學生資料、固定課表規則、單一學生課次操作。
- 月份頁課次顯示、點名、缺席原因、補課 / 加課、停課 / 假期（global events）。
- 統計與 Excel 匯出。
- 自動備份排程、primary DB preflight、OS 級 lifecycle lock（`data/app.lock`）。
- macOS Portable（RC8）維修工具（list / validate / restore / history）人工驗收已完成。
- Excel 匯出 backend 已通過正式模板 endpoint 的程式驗證；DataPage 正式模板 UI 上傳、欄位辨識、row matching、preview / confirm、瀏覽器下載，以及 frontend xlsx-populate fallback 與 backend 匯出結果比較等人工驗收仍待完成（見 §10）。

## 5. 本輪 Phase 2-5c 已完成內容

- **Phase 2**：抽出固定課次生成 helper（`frontend/src/shared/regularSessions.ts`）。
- **Phase 3**：批量生成固定課次入口由 `StudentsPage` 搬移至 `MonthPage`「批量操作」Menu。
- **Phase 4a**：新增 guarded bulk-delete frontend API client（`bulkDeleteSessions`）。
- **Phase 4b**：新增 frontend bulkRemove state sync helper（`applyBulkRemovalToSessions`）。
- **Phase 4c**：`MonthPage` guarded 批量移除日期內課次 UX。
- **Phase 4c-H1 / H2 / H2.1**：race-condition 防護（同步鎖、context token、commit pending 退出阻擋、pending preview loading 保留）。
- **Phase 5a**：完整功能鏈自動化整合驗收。
- **Phase 5b**：isolated localhost UI 人工驗收（含 backend unavailable defect 發現與修正）。
- **Phase 5c**：push-readiness、單一 main push、post-push 封存。

詳見 [`RollCall_Phase2-5c_開發與驗收紀錄.md`](RollCall_Phase2-5c_開發與驗收紀錄.md)。

## 6. 批量生成固定課次目前行為

- 入口集中於 `MonthPage`「批量操作」→「批量生成固定課次」；`StudentsPage` 已**移除**該入口。
- 批量生成 Sheet 以 `viewDate`（目前檢視月份）作為錨點。
- 依固定課表規則（`weekday` 採 JS `getDay()` 慣例：週日=0、週一=1…）在當月對應星期生成 `scheduleRuleId`-backed regular sessions。

## 7. Guarded 批量移除目前行為

正式流程：選取日期 → dryRun=true 權威預覽 → 紅色二次確認 → dryRun=false backend transaction → backend 成功後才同步 frontend sessions 鏡像。

- remove mode 與 event mode 共用 `BatchMode` union。
- `selectedDates` 支援不連續點選、再次點擊取消、日期範圍合併（Set 聯集）；日期範圍僅限 `viewDate` 當月。
- Preview / Commit 走 `POST /api/sessions/bulk-delete`（`dryRun` true / false）。
- `removedCount === 0` 時不得出現「繼續」按鈕。
- 正式刪除使用 **preview dates snapshot**，不重新讀 `selectedDates`。
- 正式 API 成功後以 `applyBulkRemovalToSessions` 同步 frontend state；commit 失敗不得 mutate frontend sessions、不清 `selectedDates`、不離開 remove mode。
- 跨範圍 makeup：刪除來源日期後，backend 將存活的 makeup 之 `makeupOfSessionId` 設為 `null`（detach），`makeupOfDateISO` 保留歷史來源日期。

## 8. Backend unavailable 保護機制

- destructive 入口**不再**只信任 App mount-time 的 `isSessionsBackendAvailable` 快照（該快照僅在掛載時透過 `fetchSessions()` 探測一次，backend 後續離線不會更新）。
- 入口改為即時呼叫 `checkSessionsBackendHealth()`（`GET /health`）：
  - 成功才進 remove mode；
  - 失敗顯示 Toast「資料庫未連線，暫時無法批量移除課次」且不進 mode；
  - 新增獨立 entry probe ref lock 防止 probe pending 時重複送 request / 重複進 mode。
- `runBulkRemovePreview()` / `runBulkRemoveCommit()` 移除 stale prop early-return，改以**實際 API request** 作為權威；離線時 request reject → catch fail closed。

## 9. 已完成驗收摘要

- **自動化**：backend targeted 44 passed；backend full 303 passed, 1 skipped；frontend targeted 7 files / 185 passed；frontend full 17 files / 342 passed；`npm run build` PASS；`git diff --check` clean。
- **localhost UI**：批量操作 Menu 順序、StudentsPage 入口移除、批量生成 viewDate 錨點、日期選取/取消、範圍合併、dryRun breakdown、危險確認、正式刪除 Toast、零課次 Preview 無「繼續」、event mode / Drawer 批量模式回歸、makeup detach、makeupOfDateISO 保留。
- **backend unavailable**：stale-state 頁面阻擋、offline-first reload 阻擋（Toast + 不進 mode）。
- **stop→restart**：fingerprint `f89c01e40d51fe5c`、CORS、sessions、students、rules 持久且正確。

證據索引見 [`RollCall_Phase5b_QA_Evidence_Index.md`](RollCall_Phase5b_QA_Evidence_Index.md)。

## 10. 仍待處理項目

- ~~DataPage 正式模板 UI / fallback manual acceptance~~ → **已完成 PASS（2026-06-07）**。
  - backend-primary export：PASS
  - missing-column UI gate：PASS
  - browser local fallback：PASS
  - backend-primary vs fallback：0 business differences
  - fallback toast：PASS
  - durable archive：已建立並驗證
  - 詳見 [`RollCall_DataPage_OfficialTemplateExport_Acceptance_2026-06-07.md`](RollCall_DataPage_OfficialTemplateExport_Acceptance_2026-06-07.md)。
- ~~尚未執行新的 package / binary smoke / artifact SHA 封存~~ → **RC9 package / binary smoke / artifact SHA 已完成 PASS（2026-06-07）**。
  - RC9 artifact：`release/RollCall_Portable_macOS_RC9.zip`（SHA256 `4e965900d80c895f4f561c837b61d491f7362c1ea8c3c09d3d1d0271e4381691`）
  - 詳見 [`RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md`](RollCall_RC9_Release_BinarySmoke_Acceptance_2026-06-07.md)
  - `portable-release-candidate-9` lightweight tag **已建立並單獨 push** → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543`（local = remote，object type commit）。
  - **仍 pending**：第一個 RC9 docs commit `35ef02c123acafdd083dfe722befdf9e0054866b` 已於本機建立；本輪 tag post-push 文件狀態更新尚未 commit；RC9 docs commits **尚未 push 至 `origin/main`**。
- Windows 維修入口暫未處理（`maintenance_restore.bat`、`scripts/package_release.ps1` 整合、Windows portable package、Windows 實機 lock 驗收）。

## 11. 後續工作流規則

- 手動前端驗收**優先交由 Codex**（具 live browser）。
- 若 UI 驗收需要資料，先由 **Claude Code 建立 isolated synthetic seed**；Codex 不應自行透過瀏覽器逐筆建立測試資料。
- `input[type=date]` 在 Codex in-app browser 存在 native picker 自動化限制；必要時由使用者手動輸入。
- 小 Phase 可建立本機 commit 作為安全節點，但 **push 延後**至整個功能鏈整合驗收通過後一次執行。
- **push / tag / package / artifact 覆蓋前必須取得使用者明確批准。**
- 任何修改前先唯讀確認 repo 狀態，列出預計新增 / 修改 / 刪除檔案與停止點，並等待批准。

## 12. 下一個建議 Phase

1. ~~完成 DataPage 正式模板 UI / fallback 的人工驗收並補文件~~ → 已完成（PASS，docs 已封存並 push 至 `origin/main`）。
2. ~~評估是否建立 RC9（含新 package、binary smoke、artifact SHA 封存）~~ → RC9 package / binary smoke / artifact SHA **已完成 PASS**；lightweight tag `portable-release-candidate-9` → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543` **已建立並單獨 push**。後續工作：
   - 完成 RC9 tag post-push docs diff QA → 精準 stage → 建立第二個本機 docs-only commit
   - 集中 push `main` 上的 RC9 docs commits（需使用者明確批准）
3. 之後再評估 Windows 維修入口整合。
