# DataPage Range Stats + Sticky Header Acceptance — 2026-06-08

## Final status

`PASS_DATAPAGE_RANGE_STATS_ISOLATED_BROWSER_ACCEPTANCE_WITH_TOOL_LIMITATION_READY_FOR_DOCS_GATE`

Tool limitation: `TOOL_LIMITATION_NATIVE_MONTH_INPUT`

## Scope

- DataPage 老師服務月份範圍統計。
- DataPage 主學生統計表 sticky header。
- Narrow viewport 與 dark mode browser acceptance。
- Permanent evidence archive 與 docs handoff。

本階段不包含 backend API、DB schema、Excel export、原因 6 手動調整、正式 academic-year model、永久保存月份範圍或 Windows 維修入口。

## Feature commit

`a149ab7dbc51ae54053353670255eb714ad108a9`

`feat(datapage): add teacher service range stats and sticky header`

## Functional behavior

- 「老師服務總次數」主卡保留目前 DataPage 月份的單月統計。
- 主卡變為可點擊 button，右側顯示 chevron。
- 點擊主卡開啟 `老師服務統計` IOSSheet。
- Sheet 預設使用 Sep-Aug 學年月份範圍。
- 使用者可暫時調整開始 / 結束月份。
- 範圍設定只保存在 component state；關閉後重新打開會回到目前月份推導的預設值。
- 不寫 localStorage、global setting 或 DB。

## Data-flow decision

- 跨月份統計使用 frontend 已載入的 sessions 聚合。
- 沒有新增 backend API。
- 沒有改動 backend、DB schema、Excel export 或 template。
- 教材服務 predicate 鏡像 backend 權威口徑：absent + materials provided + reasonCode 1..6。

## Validation rules

- 月份 token 必須為 `YYYY-MM`。
- `startMonth <= endMonth`。
- inclusive month count 最多 12 個月；剛好 12 個月允許。
- invalid range 顯示 inline error。
- invalid range 隱藏累積統計區塊，避免顯示誤導性 0。
- invalid range 下「完成」不關閉 Sheet；「取消」仍可關閉。

## Sticky-header responsive behavior

- 主學生統計表 header 使用 sticky top-0 z-10。
- 保持自然 page scroll。
- 不新增內層垂直 scrollbar。
- Narrow viewport 無整頁水平溢出。
- Dark mode 下 Sheet、月份欄位與 sticky header 均可讀。

## Tests and build

- Targeted frontend tests PASS: 3 files / 82 tests.
- Full frontend tests PASS: 18 files / 358 tests.
- Frontend build PASS.
- Vite chunk-size warning: non-blocking.

## Isolated runtime

- Isolated backend: `127.0.0.1:18031`，acceptance 後已釋放。
- Isolated frontend: `127.0.0.1:5174`，acceptance 後已釋放。
- Existing `:5173` dev server 未操作。
- Synthetic readback: 7 students, January 16 sessions, monthly stats 16 total / 10 present / 6 materials.

## Control Chrome acceptance matrix

Browser verified:

- 主卡片可點擊。
- Chevron 可見。
- 2026-01 單月統計：總數 16、正常出席 10、教材 6。
- Sheet 預設：2025-09 至 2026-08，累積總數 16。
- 空月份 inline error、統計區塊隱藏、完成阻擋。
- 取消後重新開啟恢復預設範圍。
- Desktop sticky header：position sticky、top 0、z-index 10、無內層垂直 scrollbar。
- Narrow viewport：375px class viewport 下無水平溢出，sticky header 保留。
- Dark mode：Sheet、月份欄位與 sticky header 可讀。

## TOOL_LIMITATION_NATIVE_MONTH_INPUT

Control Chrome 可操作 native month input 的 DOM value，但部分月份值變更未能可靠觸發 React state。這是工具自動化限制，不判定為產品失敗。

Browser 已完成可靠情境：

- 主卡與 Sheet default。
- 空月份 invalid。
- 完成阻擋。
- 取消與 reopen reset。
- Sticky desktop / narrow。
- Dark mode。

## RTL supplementary evidence

以下情境由已通過的 RTL tests 補充：

- January-only range。
- Exclude-January range。
- start > end。
- more than 12 months。

## Permanent archive path

`~/Documents/RollCall_AcceptanceArchives/DataPage_RangeStatsAcceptance_2026-06-08_l4vOJd/`

Archive includes:

- `acceptance_summary.md`
- `SHA256SUMS.txt`
- `archive_files.txt`
- 9 browser screenshots
- necessary runtime logs and PID evidence

Archive intentionally excludes:

- DB copy
- runtime lock residue
- throwaway lane path note

## Cleanup

- Isolated frontend stopped with Ctrl-C.
- Isolated backend stopped with Ctrl-C.
- `:5174` released.
- `:18031` released.
- Existing `:5173` dev server remained untouched.
- Worktree remained clean after acceptance.

## Out-of-scope

- 原因 6 手動調整。
- 正式 academic-year model。
- 永久保存月份範圍。
- Backend API changes。
- DB schema changes。
- Excel export changes。
- Windows 維修入口。

## Final acceptance status

`PASS_DATAPAGE_RANGE_STATS_ISOLATED_BROWSER_ACCEPTANCE_WITH_TOOL_LIMITATION_READY_FOR_DOCS_GATE`
