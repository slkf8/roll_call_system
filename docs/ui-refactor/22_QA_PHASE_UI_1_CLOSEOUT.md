---
title: "roll_call_system Phase UI-1 現況盤點與 Baseline 收口"
project: "roll_call_system"
document_type: "UI refactor phase closeout"
phase: "PHASE UI-1"
language: "繁體中文"
updated_at: "2026-06-10"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
next_phase: "PHASE UI-2 ENVIRONMENT WORKFLOW AND DESIGN GOVERNANCE SETUP"
---

# roll_call_system Phase UI-1 現況盤點與 Baseline 收口

## 0. 文件用途

本文件作為 `roll_call_system` UI 重構工作：

```text
Phase UI-1
現有 UI 全面盤點、Baseline 建立與問題分類
```

的正式收口文件。

本文件整合：

```text
Repo Inventory
Page Map
Component Map
Interaction Inventory
UI Consistency Findings
Frontend Test Inventory
Isolated Lane Safety Verification
22 張 Screenshot Baseline
Interactive Synthetic Capture
已批准產品決策
未解決但可延後問題
Phase UI-2 入口條件
```

建議保存於：

```text
docs/ui-refactor/22_QA_PHASE_UI_1_CLOSEOUT.md
```

---

# 1. Phase UI-1 最終狀態

```text
PHASE_UI_1_STATUS:
COMPLETE

BASELINE:
RC11_COMPLETE

HEAD:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

SCREENSHOT_BASELINE:
22 CAPTURED

FORMAL_DATA_ACCESS:
forbidden

NEXT_PHASE:
PHASE_UI_2_ENVIRONMENT_WORKFLOW_AND_DESIGN_GOVERNANCE_SETUP
```

---

# 2. RC11 唯一基準

UI 重構以 RC11 為唯一基準。

```text
LOCAL_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

TRACKING_ORIGIN_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

REMOTE_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

AHEAD / BEHIND:
0 / 0
```

後續不得再使用 RC8 作為 UI 重構起點。

---

# 3. Phase UI-1 已完成工作

## 3.1 UI-1A：Read-only Repo Inventory

已完成：

```text
Git gate
listener inventory
frontend architecture inventory
Page Map
Component Map
Interaction Inventory
UI consistency scan
frontend test inventory
Screenshot Baseline proposal
```

## 3.2 UI-1B-0：Synthetic Baseline Lane Feasibility Inventory

已確認：

```text
frontend-only throwaway lane 可行
backend 可透過 env 完全隔離
frontend 可透過 VITE_API_BASE_URL 指向 dead API port
fresh browser profile 可避免 localStorage 污染
DataPage synthetic workbook 可另行生成
正式資料不需要讀取
```

## 3.3 UI-1B-1：Isolated Lane Safety Verification

已完成端到端安全驗證：

```text
git archive HEAD frontend
        ↓
/private/tmp throwaway lane
        ↓
symlink node_modules
        ↓
VITE_API_BASE_URL=http://127.0.0.1:8211
        ↓
Vite :5199 --strictPort
        ↓
fresh browser profile
        ↓
synthetic seed fallback
        ↓
precise PID cleanup
```

## 3.4 UI-1B-2B：Seed-fallback Read-only Browser Audit

已完成：

```text
17 張 screenshots
Light / Dark
Desktop
iPad Portrait
iPad Landscape
Narrow
read-only Sheet
DataPage fallback
sticky header
```

## 3.5 UI-1B-2C：Interactive Synthetic Local-only Capture

已完成：

```text
5 張 screenshots
Today conflict
Month holiday
Month batch-generate sheet
Month bulk-remove offline guard
Month conflict iPad Landscape
same-round cleanup
```

---

# 4. 實際 Frontend Architecture

| Aspect | Finding |
|---|---|
| Framework | React 19 + TypeScript + Vite 7 |
| Test stack | Vitest 4 + Testing Library |
| Excel | `xlsx` / `xlsx-populate` |
| Routing | 沒有 router；使用 `activeTab` state |
| Tab keys | `today`、`month`、`students`、`data` |
| App shell | `App.tsx` 集中管理全域 state、local persistence、backend sync |
| Shared UI | 主要集中於 `frontend/src/shared/appShared.tsx` |
| State model | `useState` / `useMemo`，props drilling |
| Persistence | `attendance_v1_data`、`rollcall-theme` |
| Theme | `ThemeContext` + 大量 `isDark` ternary |
| Styles | Tailwind v4 |
| Responsive | 缺乏全域 breakpoint strategy |
| Icons | hand-rolled inline SVG |
| Backend fallback | backend unavailable 時 fallback 至 built-in synthetic seed |

---

# 5. 真實 Page Map

目前只有四個主要頁面。

| Page | Tab key | 主要用途 |
|---|---|---|
| TodayPage | `today` | 今日課堂、點名、缺席、補課、加課、停課、假期、衝突 |
| MonthPage | `month` | 月份排課、月份切換、批量生成、批量移除、衝突、假期 |
| StudentsPage | `students` | 學生列表、搜尋、篩選、新增、編輯、固定課表 |
| DataPage | `data` | 月份統計、教師服務範圍、模板上傳、欄位 gate、row matching、匯出 |

不是獨立頁面：

| 概念 | 真實位置 |
|---|---|
| Statistics | DataPage 內 |
| Student Detail | StudentsPage Sheet / 展開內容 |
| Settings | 尚無獨立頁面 |
| Maintenance | 尚無前端頁面 |

---

# 6. 核心 Shared Components

主要位於：

```text
frontend/src/shared/appShared.tsx
```

| Component | 用途 | 判斷 |
|---|---|---|
| `Pill` | Status / label pill | 保留，但需建立 semantic status model |
| `IconButton` | Action button | 保留，後續統一 touch target |
| `Toast` | 即時提示 | 保留，但不可作為唯一錯誤渠道 |
| `Menu` | Action dropdown | 保留，需重新檢查與 Sheet 邊界 |
| `IOSSheet` | Bottom-sheet modal | 保留，屬核心 interaction primitive |
| `FieldRow` | 表單列 | 保留 |
| `DurationInput` | 時長 stepper | 保留 |
| `SessionCard` | Today 課堂卡 | 保留概念，需與 Month session marker 協調 |
| `AbsenceSheetBody` | 缺席原因與教材 | 保留 |
| `SegmentedControl` | Segmented toggle | 保留 |
| `HeaderBar` | 頁面 header | 保留概念，需統一 global control |
| `ThemeToggle` | Theme 切換 | 保留，StudentsPage 缺少入口 |
| `HeaderBadge` | Header count badge | 需檢查是否與 Pill 重疊 |
| `PlaceholderCard` | Placeholder | 不足，需新增完整 Empty / Loading / Error primitives |
| `BottomTabBar` | Bottom navigation | 保留作窄螢幕候選；Desktop 是否改 Sidebar 待設計階段比較 |

---

# 7. 已確認 UI 問題

## 7.1 HIGH Priority

| ID | 問題 | 影響 |
|---|---|---|
| `UI-F01` | Dark Mode 依賴大量 `isDark` ternary | Theme drift 風險高 |
| `UI-F02` | Status badge logic 至少三套來源 | 相同語義跨頁不一致 |
| `UI-F03` | 大量 hard-coded hex | 缺乏 semantic tokens |
| `UI-F04` | 缺乏全域 responsive strategy | Desktop / iPad / Narrow 行為不一致 |
| `UIB2C-01` | Month Grid conflict 與 absent 使用近似紅點 | semantic ambiguity + accessibility 問題 |

## 7.2 MEDIUM Priority

| ID | 問題 | 影響 |
|---|---|---|
| `UI-F05` / `UIB2B-01` | StudentsPage 缺少 ThemeToggle | Global control placement 不一致 |
| `UI-F06` | Today 與 Month session rendering 分裂 | 相同 entity 有兩套視覺 |
| `UI-F08` | Primitive 邊界部分重疊 | 元件系統不清晰 |
| `UI-F09` | Empty / Loading / Error 未系統化 | Feedback 不一致 |
| `UIB2B-02` | Month nav 約 32×32px | touch target 偏小 |
| `UIB2B-04` | Desktop density 偏低 | 空白過多，掃讀效率不足 |
| `UIB2B-08` | OS theme 不自動生效 | 需產品決策 |
| `UIB2C-02` | Bulk-remove offline 只靠 Toast | Affordance 不足 |
| `UIB2C-05` | Batch generate 沒有 preview / confirm | Product interaction safety 不對稱 |

## 7.3 LOW Priority

| ID | 問題 |
|---|---|
| `UI-F07` | classnames helper pattern 不一致 |
| `UI-F10` | MonthPage page-local icon |
| `UI-F12` | `App.css` Vite boilerplate |
| `UIB2B-03` | 小字級 10–11px |
| `UIB2B-05` | Narrow bottom tab visual overlap |
| `UIB2B-06` | Students Detail Sheet 高度偏高 |
| `UIB2B-07` | DataPage fallback banner 偏弱 |
| `UIB2C-04` | Holiday cell 不清楚顯示 affected count |
| `UIB2C-06` | Today conflict pill cluster 擁擠 |

---

# 8. 已批准產品決策

## 8.1 DECISION-UI-001：Month Grid conflict marker 必須重新設計

```text
STATUS:
APPROVED
```

規則：

```text
衝突
≠
缺席
```

兩者必須使用不同：

```text
icon
shape
或
短文字
```

不得只靠顏色區分。

具體樣式：

```text
留待 Claude Design 階段比較
```

分類：

```text
UI DESIGN CONTRACT
INCLUDE_IN_UI_RESTYLE:
yes
```

## 8.2 DECISION-PF-001：MonthPage 批量生成新增 preview / confirm

```text
STATUS:
APPROVED
```

最低 Preview 內容：

```text
日期範圍
學生數
新增數
跳過數
衝突數
```

分類：

```text
SEPARATE PRODUCT FEATURE PHASE
```

不得混入：

```text
UI restyle
Design token migration
Theme migration
Responsive refactor
MonthPage visual cleanup
```

---

# 9. Screenshot Baseline

## 9.1 Evidence Archive

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
```

## 9.2 Screenshot 數量

```text
TOTAL:
22
```

## 9.3 Read-only Baseline：17 張

```text
01_TODAY_NORMAL_DESKTOP_LIGHT_01.png
02_TODAY_NORMAL_DESKTOP_DARK_01.png
03_STUDENTS_LIST_DESKTOP_LIGHT_01.png
04_STUDENTS_LIST_DESKTOP_DARK_01.png
05_MONTHPAGE_NORMAL_DESKTOP_LIGHT_01.png
06_MONTHPAGE_NORMAL_DESKTOP_DARK_01.png
07_DATAPAGE_MONTHLY_STATS_DESKTOP_LIGHT_01.png
08_DATAPAGE_MONTHLY_STATS_DESKTOP_DARK_01.png
09_TODAY_NORMAL_IPAD_PORTRAIT_LIGHT_01.png
10_STUDENTS_LIST_NARROW_LIGHT_01.png
11_MONTHPAGE_NORMAL_IPAD_LANDSCAPE_LIGHT_01.png
12_DATAPAGE_MONTHLY_STATS_IPAD_LANDSCAPE_LIGHT_01.png
13_TODAY_ABSENCE_SHEET_DESKTOP_LIGHT_01.png
14_TODAY_MENU_DESKTOP_LIGHT_01.png
15_STUDENTS_DETAIL_SHEET_DESKTOP_LIGHT_01.png
16_STUDENTS_FIXED_SCHEDULE_SHEET_DESKTOP_LIGHT_01.png
17_DATAPAGE_STICKY_HEADER_DESKTOP_LIGHT_01.png
```

## 9.4 Interactive Synthetic Baseline：5 張

```text
18_TODAY_CONFLICT_DESKTOP_LIGHT_01.png
19_MONTHPAGE_HOLIDAY_CLOSURE_DESKTOP_LIGHT_01.png
20_MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT_01.png
21_MONTHPAGE_BULK_REMOVE_BLOCKED_DESKTOP_LIGHT_01.png
22_MONTHPAGE_CONFLICT_IPAD_LANDSCAPE_LIGHT_01.png
```

注意：

```text
20_MONTHPAGE_BATCH_PREVIEW...
實際是現有批量生成 Sheet
不是真正 dry-run preview

21_MONTHPAGE_BULK_REMOVE_BLOCKED...
是 seed-fallback offline guard toast
不是 backend-primary second-confirm sheet
```

---

# 10. 暫不補拍狀態

以下畫面可延後至對應頁面遷移前補拍：

```text
Students empty state
MonthPage 真實 bulk-remove second-confirm
DataPage clean backend-primary stats
DataPage workbook preview / confirm
```

理由：

```text
Phase UI-1 的目標是理解現況
22 張 evidence 已足夠建立 Design Brief
額外 backend lane 增加成本與風險
缺失狀態可於對應頁面遷移前補驗
```

---

# 11. Isolated Lane 標準模式

已驗證可安全重用：

```text
frontend-only git archive
        ↓
/private/tmp throwaway lane
        ↓
symlink node_modules
        ↓
VITE_API_BASE_URL=http://127.0.0.1:8211
        ↓
Vite :5199 --strictPort
        ↓
fresh temporary browser profiles
        ↓
synthetic seed only
        ↓
Evidence Archive only
        ↓
same-round precise PID cleanup
```

後續規則：

```text
不要跨輪保留 background Vite process
```

原因：

```text
跨對話 background process 可能被 harness 外部回收
```

後續應：

```text
lane start
→ browser audit
→ cleanup
```

在同一輪完成。

---

# 12. 正式資料安全規則

正式資料區：

```text
backend/data/
=
OPAQUE_PROTECTED_FORMAL_DATA_ZONE
```

唯一允許：

```bash
test -d backend/data
```

禁止：

```text
ls
find
stat
hash
copy
git ls-files
count
archive inclusion
archive extraction
metadata query
```

---

# 13. 工具分工修正

後續不以固定模型名稱綁定驗收工作。

## 13.1 能力角色

| 能力角色 | 首選工具 | 備援 |
|---|---|---|
| Repo inventory、實作、測試、lane 建立 | Claude Code / Claude | Codex |
| Browser QA、截圖、responsive、dark mode、overflow | Claude | Codex |
| 對抗式 Diff Review、scope creep 檢查 | Codex | Claude |
| 視覺探索、prototype | Claude Design | Stitch |
| 局部 layout 第二意見 | Stitch | Claude Design |
| Anti-slop、design drift 規則 | Taste Skill | 專案專屬 Skill |

## 13.2 原則

```text
Codex Browser QA:
optional

Claude Browser QA:
allowed

驗收有效性取決於：
隔離
synthetic data
evidence
scope control
cleanup
```

而不是工具名稱。

---

# 14. Phase UI-1 收口判斷

## 14.1 已完成

```text
現況盤點
架構盤點
頁面盤點
元件盤點
互動盤點
Test Inventory
UI Consistency Findings
Responsive Findings
Theme Findings
Accessibility Preliminary Findings
Isolated Lane Safety Verification
22 張 baseline screenshots
兩項產品裁決
```

## 14.2 未完成但不阻塞 Phase UI-2

```text
Students empty state screenshot
MonthPage backend-primary bulk-remove second confirm screenshot
DataPage backend-primary stats screenshot
DataPage workbook preview / confirm screenshot
```

## 14.3 可進入 Phase UI-2

```text
YES
```

---

# 15. Phase UI-2 入口條件

Phase UI-2 目標：

```text
環境
文件
工具
工作流
設計治理
```

配置。

UI-2 應建立：

```text
UI Refactor Charter
Interaction Contract Freeze
Retain / Redesign / Challenge Matrix
Tool Responsibility Matrix
Conflict Stop Protocol
Taste Skill Adaptation
Project-specific UI Skill
Claude Design Input Rules
Stitch Usage Rules
DESIGN.draft.md skeleton
Phase UI-3 Entry Gate
```

UI-2 不應：

```text
修改正式 UI
替換頁面
修改 backend
修改 DB
修改 Excel contract
新增 Batch Generate Preview / Confirm
```

---

# 16. 建議下一份文件

Phase UI-2 開始時，建議建立：

```text
23_CHARTER_UI_REFACTOR.md
```

內容：

```text
scope
freeze
tool roles
stop conditions
phase gates
formal data rules
design approval path
```

---

# 17. Phase UI-1 文件索引

建議 repo 內至少保存：

```text
docs/ui-refactor/
├── 00_MASTER_UI_REFACTOR_PLAN.md
├── 05_RULES_DOCUMENT_NAMING.md
├── 10_AUDIT_CURRENT_UI_INVENTORY.md
├── 19_QA_ISOLATED_LANE_SAFETY_VERIFICATION.md
├── 20_QA_SEED_FALLBACK_READONLY_BROWSER_AUDIT.md
├── 21_QA_INTERACTIVE_SYNTHETIC_LOCAL_ONLY_CAPTURE.md
├── 22_QA_PHASE_UI_1_CLOSEOUT.md
└── 80_REGISTER_DECISIONS.md
```

---

# 18. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_1_COMPLETE

BASELINE:
RC11_COMPLETE

SCREENSHOT_BASELINE:
22

RESOLVED_PRODUCT_DECISIONS:
2

NEXT_PHASE:
PHASE_UI_2_ENVIRONMENT_WORKFLOW_AND_DESIGN_GOVERNANCE_SETUP

FORMAL_DATA_ACCESS:
forbidden
```
