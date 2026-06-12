---
title: "roll_call_system Phase UI-1B-2B Seed-fallback 唯讀 Browser Audit"
project: "roll_call_system"
document_type: "UI baseline browser audit"
phase: "PHASE UI-1B-2B"
language: "繁體中文"
updated_at: "2026-06-10"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
source_report: "Codex Phase UI-1B-2B Seed-fallback Read-only Browser Audit"
next_phase: "PHASE UI-1B-2C Interactive Synthetic Local-only Capture"
---

# roll_call_system Phase UI-1B-2B Seed-fallback 唯讀 Browser Audit

## 0. 文件用途

本文件記錄 `Phase UI-1B-2B Seed-fallback Read-only Browser Audit` 的正式結果。

本輪由 Codex 在已驗證的 frontend-only throwaway capture lane 上執行：

```text
fresh browser profiles
        ↓
synthetic seed fallback
        ↓
readonly browser navigation
        ↓
17 張 baseline screenshots
        ↓
初步 responsive / theme / accessibility audit
        ↓
browser profile cleanup
        ↓
capture lane 保留運行
```

本輪沒有修改 repo、業務資料、正式資料或 live process。

建議保存於：

```text
docs/ui-refactor/20_QA_SEED_FALLBACK_READONLY_BROWSER_AUDIT.md
```

---

# 1. Phase 結論

```text
PHASE_UI_1B2B_STATUS:
PASS_SEED_FALLBACK_READONLY_BROWSER_AUDIT
```

中控判斷：

> 第一批唯讀 UI baseline 已成功建立。現有 UI 的主要結構、Light / Dark、代表性 responsive 狀態與不修改資料的簡單 Sheet 狀態已具備 screenshot evidence，可進入互動型 synthetic local-only capture。

---

# 2. Capture Lane Handoff

本輪沿用 Claude Code 建立的 capture lane：

```text
CAPTURE_LANE_PATH:
<TMP_UI1B_CAPTURE_LANE>

FRONTEND_URL:
http://127.0.0.1:5199

EVIDENCE_ARCHIVE_PATH:
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56

FRONTEND_PID:
49336

PARENT_NPM_PID:
49241

VITE_API_BASE_URL:
http://127.0.0.1:8211

MODE:
seed-fallback
```

---

# 3. Browser Context Gate

Codex 使用：

```text
headless Chrome 149
CDP over fd-pipes
```

沒有建立額外 TCP listener。

Playwright / Puppeteer 不可用。repo 內 preview harness 需要寫入：

```text
.claude/launch.json
```

因本輪禁止 repo write，所以沒有使用。

Codex 在 Evidence Archive 內建立：

```text
cdp_driver.py
cdp_capture.py
```

用途：

```text
browser navigation
viewport control
theme control
screenshot capture
metrics
```

中控判斷：

```text
ACCEPTED
```

理由：

```text
只寫入 evidence archive
不修改 repo
不接觸 formal data
不建立額外 listener
屬於本輪 browser audit 必要工具
```

---

# 4. Browser Profile Safety

本輪使用三個 fresh throwaway profiles：

```text
catalog
capture
metrics
```

每個 profile：

```text
新建時為空
沒有日常 browser profile
沒有既有 attendance_v1_data
完成後刪除
```

載入後 localStorage 只有：

```text
rollcall-theme
attendance_v1_data
```

其中 `attendance_v1_data` 只包含 synthetic seed。

已確認 synthetic students：

```text
陳小明
李小欣
王家朗
林雅婷
王大文
張小美
```

```text
REAL_DATA_VISIBLE:
no
```

---

# 5. Screenshot Manifest

本輪完成：

```text
17 / 17 screenshots
```

保存於：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
screenshots/seed-fallback-readonly/
```

manifest：

```text
screenshot_manifest_seed_fallback_readonly.txt
```

所有 screenshots：

```text
deviceScaleFactor:
2
```

## 5.1 Desktop Light / Dark

```text
01_TODAY_NORMAL_DESKTOP_LIGHT_01.png
02_TODAY_NORMAL_DESKTOP_DARK_01.png

03_STUDENTS_LIST_DESKTOP_LIGHT_01.png
04_STUDENTS_LIST_DESKTOP_DARK_01.png

05_MONTHPAGE_NORMAL_DESKTOP_LIGHT_01.png
06_MONTHPAGE_NORMAL_DESKTOP_DARK_01.png

07_DATAPAGE_MONTHLY_STATS_DESKTOP_LIGHT_01.png
08_DATAPAGE_MONTHLY_STATS_DESKTOP_DARK_01.png
```

## 5.2 Responsive

```text
09_TODAY_NORMAL_IPAD_PORTRAIT_LIGHT_01.png
10_STUDENTS_LIST_NARROW_LIGHT_01.png
11_MONTHPAGE_NORMAL_IPAD_LANDSCAPE_LIGHT_01.png
12_DATAPAGE_MONTHLY_STATS_IPAD_LANDSCAPE_LIGHT_01.png
```

## 5.3 Read-only Simple Interactions

```text
13_TODAY_ABSENCE_SHEET_DESKTOP_LIGHT_01.png
14_TODAY_MENU_DESKTOP_LIGHT_01.png
15_STUDENTS_DETAIL_SHEET_DESKTOP_LIGHT_01.png
16_STUDENTS_FIXED_SCHEDULE_SHEET_DESKTOP_LIGHT_01.png
17_DATAPAGE_STICKY_HEADER_DESKTOP_LIGHT_01.png
```

---

# 6. Seed-fallback 驗證

```text
:8211:
connection refused

backend:
not started

seed-fallback:
confirmed
```

TodayPage：

```text
today sessions:
4

time range:
14:00–17:00

makeup badge:
補課（原 2026-06-06）
```

MonthPage 與 DataPage：

```text
seed history month:
2026-05
```

DataPage：

```text
local fallback banner:
visible
```

---

# 7. UI Audit Findings

| ID | Page | Finding | Severity |
|---|---|---|---|
| `UIB2B-01` | Students | 缺少 `ThemeToggle`；Dark capture 需要先到 DataPage 切換 theme，再返回 Students | MEDIUM |
| `UIB2B-02` | Month | 上一月 / 下一月按鈕約 `32×32px`；小於其他頁常見 touch target，尺度不一致 | MEDIUM |
| `UIB2B-03` | All | 最小字級約 `10–11px`；bottom tab label 偏小 | LOW |
| `UIB2B-04` | Today / Students / Month | Desktop density 偏低；`max-w-4xl` 令 1440px viewport 左右出現約 270px 空白 | MEDIUM |
| `UIB2B-05` | Narrow | Bottom tab bar 疊在最後列表列上方；雖可透過 padding 滾動避開，但視覺噪音存在 | LOW |
| `UIB2B-06` | Students | Detail Sheet 接近全高；較依賴內部 scroll，需補做 iPad 高度驗證 | LOW |
| `UIB2B-07` | Data | local fallback banner 為較小橙色文字；作為唯一 local-mode 提示時較容易忽略 | LOW |
| `UIB2B-08` | All | Dark mode 只由 JS ternary 控制；OS `prefers-color-scheme` 不會自動生效 | MEDIUM |
| `UIB2B-09` | Observed status pills | 已觀察到的 status pill 均搭配文字 / icon，不是純 color-only | PASS WITH FOLLOW-UP |

---

# 8. Responsive Findings

## 8.1 Overflow

```text
NARROW 390:
no horizontal overflow

IPAD_PORTRAIT 820:
no horizontal overflow

IPAD_LANDSCAPE 1180:
no horizontal overflow
```

## 8.2 初步判斷

現有 UI 沒有明顯 responsive 崩潰，但缺乏統一策略。

問題不是：

```text
頁面完全不能使用
```

而是：

```text
Desktop density 偏低
touch target 尺度不一致
不同頁面 responsive 調整程度不同
Sheet 高度策略仍需驗證
```

---

# 9. Theme Findings

```text
Today:
ThemeToggle exists

Month:
ThemeToggle exists

Students:
ThemeToggle missing

Data:
ThemeToggle exists
```

Light / Dark 在四頁均可正常 render。

但：

```text
OS prefers-color-scheme:
not respected automatically
```

中控判斷：

> 後續 Design System 需要統一 theme control placement，並評估是否使用 CSS variables 建立 semantic theme layer。OS theme 是否自動跟隨屬於產品決策，不應在 UI 重構時默認加入。

---

# 10. Accessibility Preliminary Findings

已確認：

```text
status pills:
通常有文字或 icon
不是單純靠顏色辨認
```

需要補做：

```text
conflict
closure
holiday
interactive synthetic states
```

原因：

```text
唯讀 pass 不允許建立 conflict 或 closure
```

需進一步審核：

```text
MonthPage 32×32px nav controls
bottom tab 10–11px label
Students detail sheet 高度
```

---

# 11. Process Observation

Codex 報告：

```text
:8000
曾出現一次短暫 LISTEN
隨後自行消失
```

連續六次 probe 後：

```text
:8000
no listener
```

中控判斷：

```text
NOT CAUSED BY UI-1B LANE
NOT A BLOCKER FOR CURRENT CAPTURE
KEEP AS OBSERVATION
```

理由：

```text
capture frontend 明確指向 :8211
:8211 全程 listener-free
沒有 request 送往 :8000
沒有操作 live process
```

後續如：

```text
:8000 出現長時間 listener
或
browser request 指向 :8000
```

則必須停止並回報。

---

# 12. Browser Cleanup

完成本輪後：

```text
throwaway browser profiles:
deleted

Chrome process:
0 remaining

scratch files:
removed
```

Capture lane 保留：

```text
:5199
PID 49336
```

---

# 13. Changed Files Gate

```text
SCREENSHOTS_CAPTURED:
yes
17 / 17

SOURCE_MODIFIED:
no

DOCS_MODIFIED:
no

DEPENDENCY_MODIFIED:
no

BUSINESS_DATA_MODIFIED:
no

BACKEND_STARTED:
no

FORMAL_DATA_ACCESSED:
no

LIVE_PROCESS_TOUCHED:
no

CAPTURE_FRONTEND_STOPPED:
no

TEMP_BROWSER_PROFILE_REMOVED:
yes

COMMIT_CREATED:
no

PUSH_EXECUTED:
no

TAG_CREATED:
no

PACKAGE_EXECUTED:
no
```

---

# 14. 中控裁決

## 14.1 已完成範圍

第一輪唯讀 baseline 已足夠覆蓋：

```text
四頁正常狀態
Light / Dark
代表性 responsive
簡單 read-only Sheet
DataPage fallback
DataPage sticky header
```

## 14.2 不應重複捕捉

以下不需要再次拍攝：

```text
Today normal
Students list
Month normal
DataPage monthly stats fallback
read-only detail sheets
sticky header
```

## 14.3 下一輪只補互動型 synthetic 狀態

```text
Today conflict
Month holiday / closure
Month batch preview
Month bulk-remove second confirm
Month conflict
```

上述操作只允許寫入：

```text
fresh temporary browser profile localStorage
```

不得寫入 backend、repo 或正式資料。

---

# 15. 下一步

```text
NEXT_PHASE:
PHASE UI-1B-2C
Interactive Synthetic Local-only Capture
```

目標：

```text
沿用 capture frontend :5199
使用 fresh browser profile
只在 temporary localStorage 建立 synthetic 狀態
捕捉 5 個互動型畫面
刪除 browser profile
保留 capture lane
```

不包含：

```text
backend 啟動
Students empty backend state
DataPage backend-primary statistics
DataPage synthetic workbook upload
lane cleanup
```

以上留待獨立階段。

---

# 16. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_1B_2B_COMPLETE

BASELINE_SCREENSHOTS:
17_CAPTURED

NEXT_PHASE:
PHASE_UI_1B_2C_INTERACTIVE_SYNTHETIC_LOCAL_ONLY_CAPTURE

CAPTURE_LANE:
LEFT_RUNNING

SCREENSHOT_STORAGE_POLICY:
EVIDENCE_ARCHIVE_ONLY
```
