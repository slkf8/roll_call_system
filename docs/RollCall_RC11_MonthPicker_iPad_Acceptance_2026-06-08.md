# RollCall RC11 Month Picker iPad Acceptance（2026-06-08）

> 記錄 RC11「月份選擇互動修正」的功能、根因、驗收結果、工具限制與 Git 狀態，供日後 audit。本文件只描述截至 feature commit 的狀態；後續若有新 commit / tag / push，請以實際 `git log` 為準。

## 1. 基線

| 項目 | 值 |
|---|---|
| feature commit | `14146b022a1ae1e3ec8142e1ad5c684708790e1d` |
| commit 標題 | `fix(month-picker): use iPad-compatible native date overlays` |
| 撰寫時間 | 2026-06-08 |
| 分支 | `main` |
| permanent archive | `~/Documents/RollCall_AcceptanceArchives/RC11_MonthPicker_iPadAcceptance_2026-06-08_MM46np/` |

## 2. 功能

### MonthPage

- 中央月份改為 TodayPage-style transparent native `input[type=date]` overlay。
- tap 直接命中 native input（不再依賴 programmatic 觸發）。
- `showPicker()` 只作 desktop enhancement。
- 選擇日期後正規化為 `YYYY-MM-01`。
- 左右箭頭保留。

### DataPage

- 目標月份資訊區使用相同的 transparent native `input[type=date]` overlay。
- 選擇日期後正規化為月初。
- 日期範圍、統計、學生表與 Excel export 資料流保留。
- 上一個月 / 回到本月 / 下一個月保留。

## 3. 根因

舊 MonthPage 路徑依賴：

- `0 × 0` hidden input
- `pointer-events-none`
- 負 `z-index`
- programmatic picker-only 觸發

上述組合在 iPad 上不可靠，因此改為與 TodayPage 一致的 transparent native overlay 路徑。

## 4. 驗收

| 項目 | 結果 |
|---|---|
| MonthPage targeted | 3 files / 74 tests PASS |
| DataPage targeted | 1 file / 60 tests PASS |
| full frontend regression | 18 files / 365 tests PASS |
| frontend build | PASS |
| Control Chrome desktop overlay acceptance | PASS |

狀態標記：

- `PASS_RC11_IPAD_NATIVE_PICKER_MANUAL_ACCEPTANCE`
- `PASS_RC11_LAN_EXPOSURE_CLOSED_READONLY_VERIFIED`

iPad 人工驗收涵蓋：native picker 立即開啟、無中間 sheet、無需第二次 tap、MonthPage 重新整理、DataPage 月份 / 日期範圍 / 統計 / 學生表重新整理、版面人工核對。

## 5. 工具限制

- `TOOL_LIMITATION_NATIVE_DATE_PICKER_POPUP`
- `TOOL_LIMITATION_CONTROL_CHROME_DATE_INPUT_MUTATION`

兩者皆為自動化工具限制，不是產品缺陷。

## 6. Git 狀態

| 項目 | 值 |
|---|---|
| feature commit | `14146b022a1ae1e3ec8142e1ad5c684708790e1d` |
| 狀態 | RC11 source feature commits 已 push 至 `origin/main`（main HEAD `38846dc67591494d3a00ee9cfc45f7da0a181b51`） |
| release package | 已建立並通過 isolated packaged binary smoke（見 [`RollCall_RC11_Release_BinarySmoke_Acceptance_2026-06-09.md`](RollCall_RC11_Release_BinarySmoke_Acceptance_2026-06-09.md)） |
| RC11 release candidate tag | `portable-release-candidate-11` 已建立並單獨 push → source baseline `38846dc67591494d3a00ee9cfc45f7da0a181b51`（commit；lightweight；local = remote） |
| main docs push | pre-tag docs commit `d533329036c53bfa06f9b997a63f6cee80efaac5` 尚未 push 至 `origin/main` |

## 7. Out of scope

- backend API
- SQLite
- Excel export writer
- 正式模板
- 原因 6
- 老師服務月份範圍統計規則
- RC10 artifact
- RC10 tag
- Windows portable
- package
- release

## 8. Permanent archive

permanent archive：`~/Documents/RollCall_AcceptanceArchives/RC11_MonthPicker_iPadAcceptance_2026-06-08_MM46np/`

| 檔案 | 用途 |
|---|---|
| `RC11-01-monthpage-desktop-overlay.png` | MonthPage desktop overlay evidence |
| `RC11-02-datapage-desktop-overlay.png` | DataPage desktop overlay evidence |
| `RC11-03-dark-mode.png` | dark mode evidence |
| `RC11-iPad-manual-acceptance.txt` | iPad 人工驗收紀錄 |
| `acceptance_summary.md` | RC11 驗收摘要 |
| `archive_files.txt` / `SHA256SUMS.txt` | archive inventory 與 hash |

archive 內容已通過 forbidden-file existence scan 與 privacy scan；SHA256 verification PASS。archive 不含任何 SQLite DB、runtime lock、lane-path log 或 PID file。
