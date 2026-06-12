---
title: "roll_call_system UI 重構章程"
project: "roll_call_system"
document_type: "UI refactor charter"
phase: "PHASE UI-2B"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構章程

## 0. 文件用途

本文件是 `roll_call_system` UI 重構的治理章程，用於固定：

```text
範圍
禁區
工具權限
正式資料規則
停止條件
階段 gate
已批准產品決策
```

所有後續 UI 重構工作（設計探索、規格、實作、QA、驗收）均受本章程約束。任何工具或輪次的輸出與本章程衝突時，必須停止並回報，不得自行裁決。

本章程是 `00_MASTER_UI_REFACTOR_PLAN.md` 的執行層配套文件：總綱定義「為什麼與整體路線」，本章程定義「什麼可以做、什麼不可以做、什麼時候必須停」。

---

## 1. 當前基準

```text
BASELINE:
RC11_COMPLETE

HEAD:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

GIT:
main = origin/main = remote main（ahead/behind 0/0）

PHASE_UI_1:
已完成（唯讀盤點、隔離 lane 驗證、唯讀 browser audit、互動 synthetic capture、closeout）

SCREENSHOT_BASELINE:
22 張已建立
（17 張 seed-fallback read-only + 5 張 interactive synthetic local-only）
```

Phase UI-1 產出文件：`10_AUDIT_CURRENT_UI_INVENTORY.md`、`19`–`22` QA 系列、`80_REGISTER_DECISIONS.md`。

---

## 2. UI 重構目標

本輪 UI 重構目標是重建 UI layer、design system、layout、theme、responsive 與 shared components。

不是重寫 backend、資料模型、Excel contract 或 release chain。

衡量標準以任務效率、防錯能力、資訊層級、跨頁一致性、桌面與 iPad 適配、Dark Mode 完整性與可維護性為準；視覺美感服務於以上標準，不得反向犧牲。

---

## 3. 允許重構範圍

```text
Design tokens
Theme layer
Typography
Spacing
Radius
Surface hierarchy
Button hierarchy
Status semantics
Page shell
Navigation
Sheet
Dialog
Toast
Empty state
Loading state
Error state
Responsive strategy
Dark mode strategy
Shared UI components
Page layout
Visual hierarchy
```

---

## 4. 凍結範圍

以下項目不得因 UI restyle 任意改動。如設計方案需要觸碰任一項，必須先停止並走衝突裁決流程：

```text
Backend API
SQLite schema
Formal data flow
Excel mapping
Excel template contract
Export endpoint
Backup logic
Runtime lock
Lifecycle lock
Attendance logic
Absence logic
Makeup logic
Extra lesson logic
Conflict detection
MonthPage guarded bulk remove
MonthPage bulk remove backend health gate
DataPage row matching
DataPage preview / confirm
DataPage backend-primary export
DataPage browser fallback
RC11 native date overlay behavior
Release scripts
Package flow
backend/data/
```

注：「MonthPage bulk remove backend health gate」指批量移除入口的 fresh GET /health 探測與 fail-closed 行為（Phase UI-1B-2C 已驗證其正確性），重構後必須保留同等防護。

---

## 5. 正式資料規則

```text
backend/data/ 是 OPAQUE_PROTECTED_FORMAL_DATA_ZONE。
常規操作只允許 test -d backend/data。
不得讀取、列出、stat、hash、copy、archive 或暴露正式資料。
所有 UI audit、screenshot、design prototype 必須使用 synthetic data。
```

synthetic data 的唯一合法來源是 frontend 內建 seed（`studentProfilesSeed` / `buildSeedSessions`）、隔離 lane 中由 UI 操作產生的 throwaway localStorage 資料，以及未來明確批准的 synthetic seed / synthetic workbook。

---

## 6. Screenshot / Evidence 規則

```text
baseline screenshots 保存於 Evidence Archive
不提交 screenshots 到 repo
repo 只保存文件、索引、決策與規格
```

目前 evidence archive：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
```

內含 22 張 baseline screenshots（命名依 `05_RULES_DOCUMENT_NAMING.md` §8）、各輪 gate / manifest / audit / cleanup 紀錄與 CDP driver 腳本。後續每輪 capture / QA 依 `UIRefactor_<PhaseOrPage>_<Purpose>_YYYY-MM-DD_<random>/` 格式另建 archive。

---

## 7. 已批准產品決策

```text
DECISION-UI-001:
Month Grid conflict marker 必須與 absent marker 明確區分，不得只靠顏色。

DECISION-PF-001:
MonthPage 批量生成新增 preview / confirm，但列為 Separate Product Feature Phase，不得混入 UI restyle。
Preview 至少顯示日期範圍、學生數、新增數、跳過數與衝突數。
```

來源依據：Phase UI-1B-2C 發現 UIB2C-01（month grid 衝突紅點為 color-only，且與 absent 紅點同形同色）與 UIB2C-05（批量生成無 dry-run preview，與移除流程不對稱）。完整決策紀錄見 `80_REGISTER_DECISIONS.md`。

---

## 8. 工具角色

採用能力角色定義，不綁死特定模型版本：

```text
ChatGPT:
中控、裁決、設計治理、提示詞、衝突停止

Claude / Claude Code:
repo inventory、文件建立、實作、測試、browser QA、screenshot、evidence

Codex:
可用時作額外對抗式 QA、diff review、scope creep 檢查；非強制

Claude Design:
主要視覺探索與 prototype

Stitch:
局部 layout 第二意見

Taste Skill:
anti-slop 與 design drift 規則來源，不是產品決策者

Open Design:
後期 sandbox / design experiment，不作 Phase UI-2 阻塞條件
```

所有工具輸出一律視為候選方案，最終裁決鏈：中控分析 → 產品合理性與風險判斷 → 使用者裁決 → 寫入決策紀錄。

---

## 9. 停止條件

出現以下任一情況，立即停止並回報，不得自行修正：

```text
設計建議改變 backend API
設計建議改變 DB schema
設計建議改變 Excel contract
設計建議改變 formal data flow
設計建議需要讀取 backend/data
設計建議接觸真實學生資料
UI restyle 混入未批准功能
工具輸出與已批准決策衝突
設計方案增加高頻操作步驟但沒有明確收益
桌面與 iPad 方案互斥
新 dependency 未經批准
Git worktree 出現非預期變更
需要 push / tag / package
```

停止後依 `00_MASTER_UI_REFACTOR_PLAN.md` §13.2 的衝突回報格式記錄至 `81`（衝突紀錄）並等待裁決。

---

## 10. Phase Gate

```text
Phase UI-2:
只配置治理文件、工具規則、DESIGN.draft.md 骨架，不改 UI。

Phase UI-3:
先 Claude Design 探索，再中控裁決，再批准 DESIGN.md，最後才進入 Foundation 實作。

Phase UI-4:
逐頁驗收、Browser QA、Diff QA、整合驗收與 release decision。
```

跨 gate 共通規則：UI 重構期間允許本機 commit 作為安全節點，但不得在小 phase 隨意 push；push / tag / package 只在 Phase UI-4 整合驗收通過後集中決策。

---

## 11. 下一步

```text
下一步是 Phase UI-2C：
建立 Interaction Contract Freeze 與 Retain / Redesign / Challenge Matrix。
```
