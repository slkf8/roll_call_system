---
title: "roll_call_system Phase UI-1A 現有 UI 全面盤點與中控評估"
project: "roll_call_system"
document_type: "UI audit report"
phase: "PHASE UI-1A"
language: "繁體中文"
updated_at: "2026-06-10"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
source_report: "Claude Code Phase UI-1A Read-only Repo Inventory"
next_phase: "PHASE UI-1B-0 Synthetic Baseline Lane Feasibility Inventory"
---

# roll_call_system Phase UI-1A 現有 UI 全面盤點與中控評估

## 0. 文件用途

本文件整合：

1. Claude Code 執行的 `Phase UI-1A Read-only Repo Inventory`；
2. ChatGPT 中控對盤點結果的分析；
3. 對原 UI 重構計劃的修正；
4. 下一階段 `Phase UI-1B-0` 的建議方向。

本文件是 Phase UI-1 的第一份正式審計文件，建議保存於：

```text
docs/ui-refactor/10_AUDIT_CURRENT_UI_INVENTORY.md
```

---

# 1. Phase UI-1A 結論

```text
PHASE_UI_1A_STATUS:
PASS_READONLY_INVENTORY
```

Precondition：

```text
PASS_WITH_ACKNOWLEDGED_UNTRACKED_UI_REFACTOR_DOCS
```

已確認的既有 untracked 文件：

```text
docs/ui-refactor/
├── 00_MASTER_UI_REFACTOR_PLAN.md
└── 05_RULES_DOCUMENT_NAMING.md
```

這兩份文件是 UI 重構規劃中有意加入的文件，不是不明檔案。

本輪沒有額外 worktree 變化。

```text
ACKNOWLEDGED_PRE_EXISTING_UNTRACKED_DOCS:
- docs/ui-refactor/00_MASTER_UI_REFACTOR_PLAN.md
- docs/ui-refactor/05_RULES_DOCUMENT_NAMING.md

ADDITIONAL_WORKTREE_CHANGES:
none
```

---

# 2. Read-only Precondition Gate

| Check | Value |
|---|---|
| pwd | `<REPO_ROOT>` |
| branch | `main` |
| local HEAD | `cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9` |
| tracking origin/main | `cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9` |
| remote main | `cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9` |
| ahead / behind | `0 / 0` |
| worktree | clean except acknowledged `?? docs/ui-refactor/` |
| `git diff --check` | empty |
| `git diff --cached --check` | empty |
| `backend/data` exists | yes，僅使用 `test -d` 確認 |

## 2.1 Listener Inventory

本輪只觀察，未啟動或停止任何 process。

| Port | Listener | PID | Command |
|---|---:|---:|---|
| `:5173` | yes | `41123` | `node` — Vite dev server，`[::1]:5173` |
| `:8000` | yes | `5217` | `roll_call` — backend，`127.0.0.1:8000` |
| `:8211` | no | — | — |

後續 UI-1B 不得操作既有：

```text
:5173
:8000
```

如需 Browser Audit，必須使用隔離 ports。

---

# 3. Frontend Architecture Inventory

| Aspect | Finding |
|---|---|
| Stack | React 19 + TypeScript + Vite 7 |
| Test stack | Vitest 4 + Testing Library |
| Excel | `xlsx` / `xlsx-populate` |
| Entry | `frontend/src/main.tsx` → `<StrictMode><App/></StrictMode>`；匯入 `index.css` |
| App Shell | `frontend/src/App.tsx`，約 624 行；集中管理全域 state、local persistence、backend sync |
| Routing | 沒有 router；使用 `activeTab` 狀態切換 |
| Tab keys | `today`、`month`、`students`、`data` |
| Layout | 單一 shell：`min-h-screen` + `pb-28` content area + 固定 `BottomTabBar` |
| State | `App.tsx` 以 `useState` / `useMemo` 集中管理；沒有 Redux、Zustand 或 Context store |
| Persistence | `localStorage` key：`attendance_v1_data`；theme key：`rollcall-theme` |
| Backend sync | mount 時 fetch students → rules → sessions → globalEvents；各自有 backend availability flag；失敗時 fallback 至 local seed |
| Styles | Tailwind v4，透過 `@tailwindcss/vite`；`index.css` 只有 `@import "tailwindcss"` |
| Tailwind config | 沒有 `tailwind.config`；使用 Tailwind v4 CSS-based config |
| Dead boilerplate | `App.css` 仍保留 Vite 預設 logo spin 樣式 |
| Theme | `ThemeContext` + `isDark` 布林值；大量手動 ternary |
| Responsive | 沒有全域 breakpoint 策略；主要分散於 DataPage、MonthPage |
| Icons | 約 20 個手寫 inline SVG，集中於 `appShared.tsx` |
| Shared UI | 主要集中於 `frontend/src/shared/appShared.tsx`，約 1467 行 |
| Logic helpers | `regularSessions.ts`、`bulkRemove.ts`、`teacherServiceRange.ts`、`schoolYearStorage.ts`、`materials*` |
| API layer | `src/api/*`：sessions、students、scheduleRules、globalEvents、statistics、exports |

---

# 4. 實際 Page Map

盤點後確認：目前前端只有四個真正的主要頁面。

| Page | Tab key | Entry File | Primary Components | Primary Interactions | Responsive | Dark Mode | Tests |
|---|---|---|---|---|---|---|---|
| TodayPage | `today` | `frontend/src/pages/TodayPage.tsx` | `HeaderBar`、`ThemeToggle`、`SessionCard`、`IOSSheet` ×6、`Menu`、`AbsenceSheetBody`、native date overlay | Attendance、缺席原因、教材、補課、加課、停課、假期、衝突、刪除確認、日期切換 | 幾乎沒有 breakpoint | 有，約 43 個 `isDark` refs | `TodayPage.sessionsBackend.test.tsx` |
| MonthPage | `month` | `frontend/src/pages/MonthPage.tsx` | `HeaderBar`、`ThemeToggle`、`SegmentedControl`、calendar grid、`IOSSheet` ×10、native date overlay、sticky header | 月份切換、calendar nav、批量生成、dry-run preview、guarded bulk-remove、二次確認、停課、假期、補課、加課、衝突 | 部分 breakpoint | 有，約 85 個 `isDark` refs | batchGenerate、bulkRemove、sessionsBackend |
| StudentsPage | `students` | `frontend/src/pages/StudentsPage.tsx` | `HeaderBar`、`SegmentedControl`、status badges、`IOSSheet` ×5、native date inputs | 搜尋、篩選、新增、編輯、學生狀態、固定課表 CRUD、常規課堂生成 | 極少 breakpoint | 有，約 20 個 `isDark` refs | `StudentsPage.test.tsx` |
| DataPage | `data` | `frontend/src/pages/DataPage.tsx` | `HeaderBar`、`ThemeToggle`、`SegmentedControl`、stats tables、sticky header、`IOSSheet` ×3、native date/month overlays | 月份選擇、月份統計、教師服務範圍、模板上傳、欄位 gate、row matching、preview / confirm、backend-primary export、browser fallback、學年 override | 最完整 | 有，約 45 個 `isDark` refs | `DataPage.test.tsx` |

## 4.1 原規劃中需要修正的頁面理解

| 原規劃名稱 | 真實結構 |
|---|---|
| Statistics | 不是獨立頁面；位於 DataPage 內 |
| Settings | 暫無獨立頁面 |
| Maintenance | 暫無前端頁面 |
| Student Detail | 不是獨立頁面；位於 StudentsPage 內的 Sheet / 展開內容 |

## 4.2 中控判斷

原總體規劃中對 Statistics、Settings、Maintenance、Student Detail 的描述屬於產品概念層，並非當前 repo 的真實 page map。

後續所有 UI Audit、Claude Design brief 與遷移文件必須以實際四頁結構為準。

---

# 5. Shared Component Map

主要 Shared Components 位於：

```text
frontend/src/shared/appShared.tsx
```

| Component | File | Shared / Page-local | Used By | Purpose | Potential Duplication |
|---|---|---|---|---|---|
| `Pill` | `appShared.tsx` | Shared | All pages | Status / label pill，5 tones | Status semantics 部分由其他頁重複實作 |
| `IconButton` | `appShared.tsx` | Shared | Today、Sheets | 44px action button，4 tones | — |
| `Toast` | `appShared.tsx` | Shared | App global | Top transient toast | — |
| `Menu` | `appShared.tsx` | Shared | Today | Action dropdown | 與 `IOSSheet` 的 more pattern 有部分重疊 |
| `IOSSheet` | `appShared.tsx` | Shared | All pages，約 24 usages | Bottom-sheet modal | 高度共用，屬合理核心元件 |
| `FieldRow` | `appShared.tsx` | Shared | Sheets | 表單列 | — |
| `DurationInput` | `appShared.tsx` | Shared | Today、Month、Students | 分鐘加減 Stepper | — |
| `SessionCard` | `appShared.tsx` | Shared | Today | 課堂卡片 | MonthPage 使用自有課堂 markup |
| `AbsenceSheetBody` | `appShared.tsx` | Shared | Today | 缺席原因 + 教材表單 | — |
| `SegmentedControl` | `appShared.tsx` | Shared | Month、Students、Data | iOS segmented toggle | — |
| `HeaderBar` | `appShared.tsx` | Shared | All pages | 頁面標題、icon、right slot | — |
| `ThemeToggle` | `appShared.tsx` | Shared | Today、Month、Data | Light / Dark 切換 | StudentsPage 缺少 |
| `HeaderBadge` | `appShared.tsx` | Shared | Headers | 小型 count badge | 與 muted `Pill` 有部分重疊 |
| `PlaceholderCard` | `appShared.tsx` | Shared | Placeholder | 泛用 empty / placeholder | Empty state primitive 不足 |
| `BottomTabBar` | `appShared.tsx` | Shared | App | Bottom nav | — |
| Inline SVG icons | `appShared.tsx` | Shared | All pages | icon library | — |
| `IconCheckCircle2` | `MonthPage.tsx` | Page-local | Month | 額外 icon | 可考慮收歸 shared |
| `cx()` | `StudentsPage.tsx` | Page-local | Students | classnames helper | 只有 Students 使用 |
| `getStatusBadgeClasses` | `StudentsPage.tsx` | Page-local | Students | 學生狀態 badge | 與 shared Pill 重疊 |
| `getSessionStatusBadgeClass` | `DataPage.tsx` | Page-local | Data | 課堂狀態 badge | 與 shared status logic 重疊 |
| `getSessionKindBadgeClass` | `DataPage.tsx` | Page-local | Data | 課堂類型 badge | 與 shared status logic 重疊 |
| Surface / text helpers | `appShared.tsx` | Shared | All pages | theme class helpers | 已有 token-ish 雛形，但仍未完整統一 |

---

# 6. Interaction Inventory

| Interaction | Status | Relevant Files | Notes |
|---|---|---|---|
| Tab navigation | EXISTS | `App.tsx`、`BottomTabBar` | 4 tabs |
| Page switch | EXISTS | `App.tsx` | Conditional render |
| Date switch | EXISTS | TodayPage | chevrons + overlay |
| Month switch | EXISTS | MonthPage、DataPage | |
| RC11 Native Date Overlay | EXISTS | Today、Month、Data | `opacity-0` input 覆蓋可見 UI；行為應凍結 |
| Attendance | EXISTS | TodayPage、SessionCard | present / absent |
| Absence reason | EXISTS | `AbsenceSheetBody` | |
| Materials service | EXISTS | `AbsenceSheetBody`、DataPage | reason-6 / school-year logic |
| Makeup lesson | EXISTS | Today、Month | |
| Extra lesson | EXISTS | Today、Month | |
| Closure | EXISTS | Today、Month | allDay / timeRange |
| Holiday | EXISTS | Today、Month | |
| Conflict warning | EXISTS | shared helpers、SessionCard | non-blocking pill |
| Toast | EXISTS | shared `Toast`、App | 6 秒 auto-dismiss |
| Undo | EXISTS | TodayPage | per-session reset；沒有 global undo stack |
| Student add | EXISTS | StudentsPage | |
| Student edit | EXISTS | StudentsPage | |
| Fixed schedule | EXISTS | StudentsPage、`regularSessions.ts` | |
| Session add / edit | EXISTS | Today、Month | |
| MonthPage batch generate | EXISTS | MonthPage、`regularSessions.ts` | |
| MonthPage dry-run preview | EXISTS | MonthPage | |
| MonthPage guarded bulk-remove | EXISTS | MonthPage、`bulkRemove.ts` | |
| MonthPage second confirm | EXISTS | MonthPage | |
| Statistics filter | EXISTS | DataPage、statistics API | |
| DataPage month select | EXISTS | DataPage | |
| DataPage teacher service range | EXISTS | DataPage、`teacherServiceRange.ts` | |
| DataPage sticky header | EXISTS | DataPage | |
| DataPage template upload | EXISTS | DataPage | |
| DataPage column gate | EXISTS | DataPage | |
| DataPage row matching | EXISTS | DataPage | name + birthday key |
| DataPage preview / confirm | EXISTS | DataPage | |
| DataPage backend-primary export | EXISTS | exports API | |
| DataPage browser fallback | EXISTS | DataPage | `xlsx-populate` path |
| Backup | NOT FOUND in frontend | — | backend / packaged scope |
| Restore | NOT FOUND in frontend | — | 字串主要為 confirmation copy |
| Maintenance ops | NOT FOUND in frontend | — | 暫不屬於前端 UI |
| Loading state | NEEDS FOLLOW-UP | — | 沒有完整 spinner / skeleton primitive |
| Empty state | NEEDS FOLLOW-UP | scattered | 多數為 ad-hoc text / toast |
| Error state | NEEDS FOLLOW-UP | scattered | 主要依賴 Toast |

---

# 7. UI Consistency Findings

| Finding ID | Evidence | Impact | Risk |
|---|---|---|---|
| UI-F01 | Dark Mode 依賴大量手動 `isDark` ternary | 每個 surface 重複決定顏色，容易漂移 | HIGH |
| UI-F02 | Status badge logic 至少有三套來源 | 相同語義可能在不同頁面呈現不同樣式 | HIGH |
| UI-F03 | 大量硬編碼 hex 色值 | 缺乏 color tokens，阻礙統一主題 | HIGH |
| UI-F04 | 缺乏共用 responsive 策略 | Desktop、iPad、Narrow 行為不一致 | HIGH |
| UI-F05 | StudentsPage 缺少 ThemeToggle | 全域控制入口不一致 | MEDIUM |
| UI-F06 | TodayPage 使用 shared `SessionCard`，MonthPage 自行 render session | 相同 entity 出現兩套視覺表達 | MEDIUM |
| UI-F07 | 只有 StudentsPage 使用 `cx()` | class assembly pattern 不一致 | LOW |
| UI-F08 | `HeaderBadge` 與 muted `Pill`、`Menu` 與 Sheet pattern 有部分重疊 | primitive 邊界不清晰 | MEDIUM |
| UI-F09 | Empty / Loading / Error 未系統化 | 使用者回饋不一致；Toast 可能承擔過多責任 | MEDIUM |
| UI-F10 | MonthPage 有 page-local icon | 小型重複 | LOW |
| UI-F11 | 部分狀態高度依賴 hue 區分 | Accessibility 需要進一步 audit | MEDIUM |
| UI-F12 | `App.css` 保留未使用 Vite boilerplate | 可清理，但不影響功能 | LOW |

---

# 8. Frontend Test Inventory

## 8.1 現有測試

使用：

```text
Vitest
Testing Library
jsdom
```

重要測試：

```text
StudentsPage.test.tsx
DataPage.test.tsx
TodayPage.sessionsBackend.test.tsx
MonthPage.batchGenerate.test.tsx
MonthPage.bulkRemove.test.tsx
MonthPage.sessionsBackend.test.tsx
App.empty.test.tsx
sessionsApi.test.ts
statisticsApi.test.ts
globalEventsApi.test.ts
scheduleRulesApi.test.ts
exportsApi.test.ts
bulkRemove.test.ts
regularSessions.test.ts
teacherServiceRange.test.ts
materials*.test.ts
schoolYearStorage.test.ts
config.test.ts
```

## 8.2 已覆蓋範圍

```text
Attendance flows
Batch generate
Bulk remove
Row matching
Export contract
Materials / reason-6
School-year logic
Backend fallback
```

## 8.3 缺口

```text
沒有 UI visual / snapshot tests
沒有 Dark Mode rendering tests
沒有 Responsive / breakpoint tests
沒有 automated iPad tests
沒有 accessibility tests
沒有 touch-target tests
StudentsPage 的 Dark Mode 覆蓋較薄弱
```

## 8.4 中控判斷

在開始 UI restyle 前，建立 screenshot baseline 是合理且必要的 safeguard。

但不應一次保存所有：

```text
頁面 × 狀態 × Viewport × Theme
```

組合。

---

# 9. 中控分析：真正的 UI 問題

## 9.1 問題不是功能失效

盤點證明：

```text
現有核心互動大多已存在
功能鏈條相對完整
MonthPage 與 DataPage 已有高風險流程保護
RC11 Native Date Overlay 已落地
```

因此，UI 重構不是重做功能，而是解決：

```text
缺乏統一 Design Token Layer
缺乏統一 Theme Strategy
缺乏統一 Responsive Strategy
Status Semantics 分裂
Feedback State 不完整
Component Boundary 不清晰
```

## 9.2 第一個工程重點

未來第一個工程重點應是：

```text
建立 Semantic Design Tokens
```

而不是逐頁自由換皮。

## 9.3 Dark Mode 技術方向

目前 Dark Mode 由大量：

```tsx
isDark ? "..." : "..."
```

控制。

初步建議：

```text
評估建立 CSS Variables 作為 Theme Token Layer
```

而不是直接一次性將全站改寫成 Tailwind `dark:`。

原因：

```text
現有 ThemeContext 可保留
CSS Variables 適合 Semantic Tokens
可逐步遷移
降低大規模字串替換風險
Light / Dark 對應關係集中
```

這只是初步技術建議，必須於 Phase UI-2 進一步討論後才批准。

## 9.4 Status Badge 技術方向

不得只做：

```text
把所有 Badge 合併成一個大型元件
```

應先區分：

```text
Attendance Status
Session Kind
Student Status
Warning Status
System Status
```

再建立統一 semantic model。

## 9.5 Responsive 技術方向

後續應統一建立四個主要視窗策略：

```text
DESKTOP
IPAD_LANDSCAPE
IPAD_PORTRAIT
NARROW
```

不再由各頁自由決定 responsive 行為。

## 9.6 Feedback State 技術方向

應建立：

```text
EmptyState
InlineError
LoadingState
Toast
```

其中：

> Toast 只作即時回饋，不應承擔唯一錯誤資訊來源。

---

# 10. 對原計劃的修正

## 10.1 頁面結構修正

後續遷移文件應以四頁為核心：

```text
TodayPage
MonthPage
StudentsPage
DataPage
```

而不是假設 Statistics、Settings、Maintenance、Student Detail 是獨立頁面。

## 10.2 遷移順序仍需保守

建議維持：

```text
Foundation
→ StudentsPage
→ TodayPage
→ MonthPage
→ DataPage
```

DataPage 最後處理。

原因：

```text
DataPage 涉及模板上傳
欄位 gate
row matching
preview / confirm
backend-primary export
browser fallback
sticky header
```

它不應成為新設計系統的試驗場。

## 10.3 截圖基線策略修正

不採用一次保存超過一百張截圖的方案。

採用：

```text
Layer 1
Phase UI-1B：
保存代表性基準畫面

Layer 2
逐頁遷移時：
補齊該頁 Edge Cases
```

---

# 11. Phase UI-1B Baseline Screenshot 建議

第一輪控制在約 26 張代表畫面。

## 11.1 Desktop Light / Dark

```text
TODAY_NORMAL
STUDENTS_LIST
MONTHPAGE_NORMAL
DATAPAGE_MONTHLY_STATS
```

共：

```text
4 × 2 = 8 張
```

## 11.2 Responsive 代表畫面

```text
TODAY_NORMAL_IPAD_PORTRAIT_LIGHT
STUDENTS_LIST_NARROW_LIGHT
MONTHPAGE_NORMAL_IPAD_LANDSCAPE_LIGHT
DATAPAGE_MONTHLY_STATS_IPAD_LANDSCAPE_LIGHT
```

共：

```text
4 張
```

## 11.3 核心互動畫面

```text
TODAY_ABSENCE_SHEET_DESKTOP_LIGHT
TODAY_CONFLICT_DESKTOP_LIGHT
TODAY_MENU_DESKTOP_LIGHT

STUDENTS_DETAIL_SHEET_DESKTOP_LIGHT
STUDENTS_FIXED_SCHEDULE_SHEET_DESKTOP_LIGHT
STUDENTS_EMPTY_DESKTOP_LIGHT

MONTHPAGE_HOLIDAY_CLOSURE_DESKTOP_LIGHT
MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT
MONTHPAGE_BULK_REMOVE_CONFIRM_DESKTOP_LIGHT
MONTHPAGE_CONFLICT_IPAD_LANDSCAPE_LIGHT

DATAPAGE_STICKY_HEADER_DESKTOP_LIGHT
DATAPAGE_TEACHER_SERVICE_RANGE_DESKTOP_LIGHT
DATAPAGE_PREVIEW_CONFIRM_DESKTOP_LIGHT
DATAPAGE_ERROR_DESKTOP_LIGHT
```

共：

```text
14 張
```

## 11.4 總數

```text
26 張
```

---

# 12. Screenshot 保存策略

## 12.1 第一輪保存位置

第一輪 screenshot baseline 優先保存至：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
```

不立即放入：

```text
docs/ui-refactor/screenshots/
```

原因：

```text
截圖首先是 Evidence
數量可能增加
避免 repo 容量膨脹
後續只需在 repo 保留索引與代表畫面選擇結果
```

## 12.2 後續 repo 文件

後續可建立：

```text
docs/ui-refactor/17_ARCHIVE_SYNTHETIC_SEED_SCREENSHOT_INDEX.md
```

只記錄：

```text
Evidence Archive 路徑
Capture Matrix
代表性畫面
缺口
後續補拍需求
```

---

# 13. 下一步：Phase UI-1B-0

在建立 throwaway lane、synthetic seed 或 Browser Audit 前，先執行一輪唯讀可行性盤點。

```text
NEXT_PHASE:
PHASE UI-1B-0
Synthetic Baseline Lane Feasibility Inventory
```

目的：

```text
確認 throwaway lane 最安全建立方式
確認 backend data dir 隔離方式
確認 frontend API base URL 隔離方式
確認現有 synthetic seed 覆蓋範圍
確認哪些狀態需要 temporary fixture
確認 DataPage synthetic workbook 策略
確認 Codex Browser Audit 入口
確認隔離 ports
確認 UI-1B 需要哪些寫入
```

不得立即：

```text
建立 lane
啟動 server
建立 seed
操作 browser
建立 screenshot
修改 source
修改 docs
讀取 backend/data
commit
push
tag
package
```

---

# 14. UI-1B-0 應輸出的核心判斷

下一輪需要明確回答：

```text
REPO_WRITE_REQUIRED:
yes / no

THROWAWAY_LANE_WRITE_REQUIRED:
yes / no

EVIDENCE_ARCHIVE_WRITE_REQUIRED:
yes / no
```

以及：

```text
是否可以完全在 throwaway lane 中完成 baseline capture？
是否需要修改正式 repo？
是否需要 temporary fixture？
是否需要 sanitized synthetic workbook？
是否可以不碰 live :5173 / :8000？
```

---

# 15. Changed Files Gate

Phase UI-1A 結束時：

```text
git status --short --branch
→ ## main...origin/main
→ ?? docs/ui-refactor/
```

其中：

```text
docs/ui-refactor/00_MASTER_UI_REFACTOR_PLAN.md
docs/ui-refactor/05_RULES_DOCUMENT_NAMING.md
```

為已知文件。

最終確認：

```text
SOURCE_MODIFIED:
no

DOCS_MODIFIED:
no

DEPENDENCY_MODIFIED:
no

PROCESS_STARTED:
no

PROCESS_STOPPED:
no

FORMAL_DATA_ACCESSED:
no

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

# 16. Phase UI-1A 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_1A_COMPLETE

BASELINE:
RC11_COMPLETE

NEXT_PHASE:
PHASE_UI_1B_0_SYNTHETIC_BASELINE_LANE_FEASIBILITY_INVENTORY

NEXT_WRITE_ACTION:
none

FORMAL_DATA_ACCESS:
forbidden
```
