---
title: "roll_call_system Phase UI-2 治理與設計契約 Closeout"
project: "roll_call_system"
document_type: "Phase UI-2 closeout report"
phase: "PHASE UI-2G"
language: "繁體中文"
updated_at: "2026-06-11"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
next_phase: "PHASE UI-3 IMPLEMENTATION"
---

# roll_call_system Phase UI-2 治理與設計契約 Closeout

## 0. 文件用途

本文件總結 Phase UI-2（環境、文件、工具與工作流配置 + Claude Design 探索 + 批准版設計契約）的全部產出與合規狀態，作為進入 Phase UI-3 Implementation 前的正式 closeout 與 pre-commit checkpoint 審計。

---

## 1. Phase UI-2 範圍

```text
UI-2A ~ UI-2D:
治理文件（章程、互動凍結契約、矩陣、工具責任、衝突停止協議）

UI-2E:
Taste 規則適配 + project-level UI Skill 建立與驗收

UI-2F-1:
Claude Design 輸入 Brief + Design 草稿骨架

UI-2F-2:
repo 外 synthetic-only Claude Design handoff folder

UI-2F-3:
Claude Design 第一、二輪探索 + 邊界決策 + 視覺審查
+ StudentsPage Board 3 source audit（UI-2F-3C-1）

UI-2F-4:
StudentsPage Board 3 契約對齊 + 批准版設計契約 + 決策登記

UI-2G（本輪）:
Conflict Register 建檔 + Phase UI-2 Closeout
```

全程零 frontend / backend / dependency 修改、零 process 操作、零 commit / push / tag / package、Formal Data Zone 最多 `test -d`。

---

## 2. 已完成文件

Phase UI-2 期間建立或更新的 `docs/ui-refactor/` 文件（closeout 後共 24 份）：

```text
00_MASTER_UI_REFACTOR_PLAN.md
05_RULES_DOCUMENT_NAMING.md
10_AUDIT_CURRENT_UI_INVENTORY.md
19_QA_ISOLATED_LANE_SAFETY_VERIFICATION.md
20_QA_SEED_FALLBACK_READONLY_BROWSER_AUDIT.md
21_QA_INTERACTIVE_SYNTHETIC_LOCAL_ONLY_CAPTURE.md
22_QA_PHASE_UI_1_CLOSEOUT.md
23_CHARTER_UI_REFACTOR.md
24_CONTRACT_INTERACTION_FREEZE.md
25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
26_MATRIX_TOOL_RESPONSIBILITY.md
27_PROTOCOL_CONFLICT_STOP.md
28_RULES_TASTE_SKILL_ADAPTATION.md
29_SPEC_PROJECT_UI_SKILL.md
30_QA_PROJECT_UI_SKILL_VALIDATION.md
31_BRIEF_CLAUDE_DESIGN_HANDOFF.md
32_DRAFT_DESIGN.md（歷史草稿，已被 36 取代）
33_DECISION_CLAUDE_DESIGN_EXPLORATION_BOUNDARIES.md
34_QA_CLAUDE_DESIGN_SECOND_ROUND_VISUAL_REVIEW.md
35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md
36_SPEC_UI_DESIGN_APPROVED.md
39_QA_PHASE_UI_2_CLOSEOUT.md（本文件）
80_REGISTER_DECISIONS.md
81_REGISTER_CONFLICTS.md
```

---

## 3. Project-level Skill

```text
PROJECT SKILL:
.claude/skills/roll-call-ui-refactor/SKILL.md

PROJECT SKILL VALIDATION:
PASS
- Static safety
- Manual invocation
- Positive auto-invocation
- Backend-only negative scope test

驗收紀錄:
docs/ui-refactor/30_QA_PROJECT_UI_SKILL_VALIDATION.md
```

性質：治理型 Skill，不預先授權 Bash、寫入、dependency install、release action 或正式資料存取。

---

## 4. Claude Design 探索流程

```text
第一輪:
三個 design families（A Refined Card / B Sidebar Workspace / C Inset Grouped List）
→ 33_DECISION 固定第二輪邊界（Family B primary、A fallback、C stress-test）

第二輪:
focused comparison 對照板
→ 34_QA 視覺審查（APPROVED_FOR_HIFI_REFINEMENT）
固定：Sidebar / BottomTabBar、Today T1、Students C2、DataPage D1、
Month responsive hybrid marker、semantic token 架構

Board 3（StudentsPage hi-fi）:
發現 contract drift
→ CONFLICT-UI-001（81_REGISTER_CONFLICTS.md）
→ UI-2F-3C-1 strictly read-only source audit
→ 35 號文件對齊裁決

收斂:
UI-2F-4 建立批准版 36_SPEC_UI_DESIGN_APPROVED.md
+ DECISION-UI-002 ~ DECISION-UI-009 登記
```

全程 synthetic-only;handoff folder 位於 repo 外（`<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/UIRefactor_ClaudeDesign_Handoff_2026-06-11_35b677/`），screenshots 不入 repo。

---

## 5. Approved Design Contract

```text
APPROVED DESIGN CONTRACT:
docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md

SUPERSEDED DRAFT:
docs/ui-refactor/32_DRAFT_DESIGN.md
```

正式設計摘要：

```text
Shell:
Desktop ≥1024px Sidebar 220px
<1024px BottomTabBar
Icon Rail 不採用
Global ThemeToggle

TodayPage:
單欄 compact chronological list
雙欄 grid 不採用

StudentsPage:
保留 editable IOSSheet contract
88vh + internal scroll = approved visual proposal
Desktop Split View = DEFERRED / SEPARATE INTERACTION DECISION

DataPage:
1 主卡 + 4 compact stats
table row height 38px
不新增 density toggle
Sticky Header 保留

MonthPage:
responsive hybrid marker
compact = ⚠ n / 缺 n
wide = ⚠ n 衝突 / 缺 n 缺席
禁止 bare dot、✕、⊘、color-only

Bulk-remove:
health checking / offline disabled menu item
inline explanation
Toast secondary only

Tokens:
primitive → semantic → component
status.<state>.fg / status.<state>.bg
```

決策登記：`80_REGISTER_DECISIONS.md` 含 DECISION-UI-001 ~ DECISION-UI-009 + DECISION-PF-001。

---

## 6. StudentsPage Contract Reconciliation

```text
紀錄文件:
docs/ui-refactor/35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md

依據:
PHASE UI-2F-3C-1
PASS_STUDENTSPAGE_EXISTING_CONTRACT_SOURCE_AUDIT

結果:
未驗證欄位移除（電話 / 時薪 / 開始日期 / 備註）
label drift 還原（進行中→啟用中、已停→已停用、新增時段→新增固定課表、移除→刪除）
未批准操作移除（刪除學生）
未批准互動狀態移除（View State / dirty state / 未儲存提醒 / inline editing / sticky dirty bar）
editable IOSSheet contract 保留（全 viewport）
Desktop Split View 降級為 DEFERRED
```

---

## 7. Conflict Register

```text
CONFLICT REGISTER:
docs/ui-refactor/81_REGISTER_CONFLICTS.md

RESOLVED CONFLICT:
CONFLICT-UI-001
StudentsPage Board 3 Contract Drift

附帶:
27 號文件 §8 已知案例 A–E 先例索引已補錄
```

後續重大衝突必須追加至 81 號文件，不得覆蓋舊紀錄。

---

## 8. Formal Data Compliance

```text
backend/data/ = OPAQUE_PROTECTED_FORMAL_DATA_ZONE

Phase UI-2 全程:
FORMAL_DATA_ZONE_QUERY: 最多 only test -d
FORMAL_DATA_CONTENT_ACCESSED: no
真實學生資料出現於任何畫面 / 文件 / handoff: no
screenshots: synthetic-only，且不入 repo
```

---

## 9. Git Checkpoint Recommendation

目前全部 Phase UI-1 / UI-2 產出仍為 untracked：

```text
?? docs/ui-refactor/（24 份文件）
?? .claude/skills/（roll-call-ui-refactor/SKILL.md）
```

建議（須由使用者明確批准後才執行，本輪不執行）：

```text
建立單一 docs + skill checkpoint commit：
範圍：docs/ui-refactor/ 全部 24 份 + .claude/skills/roll-call-ui-refactor/SKILL.md
基準：main @ cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9
建議訊息方向：docs(ui-refactor): Phase UI-1/UI-2 governance, approved design contract and registers
commit 與 push 為兩個獨立批准
不含任何 frontend / backend / dependency 變更
```

---

## 10. Phase UI-3 Implementation Order

```text
Phase UI-3A:
Foundation tokens + shell primitives

Phase UI-3B:
Shell migration

Phase UI-3C:
TodayPage

Phase UI-3D:
StudentsPage baseline-safe restyle

Phase UI-3E:
MonthPage

Phase UI-3F:
DataPage

Phase UI-3G:
Integrated QA
```

---

## 11. Entry Conditions for Phase UI-3

```text
正式開始 UI-3 前：
- 先完成本輪 Closeout
- 建立 docs + project skill Git checkpoint
- 由使用者明確批准 commit
- 由使用者明確批准 push
- frontend implementation 必須另開 Phase
```

實作期間持續生效：

```text
36_SPEC_UI_DESIGN_APPROVED.md 為單一設計依據
24_CONTRACT_INTERACTION_FREEZE.md 凍結項不得改變
27_PROTOCOL_CONFLICT_STOP.md fail-closed 停止協議
DECISION-PF-001 / Split View DEFER 不得偷渡
Formal Data Zone 最多 test -d
```

---

## 12. 最終狀態

```text
PHASE_UI_2_STATUS:
COMPLETE

APPROVED DESIGN CONTRACT:
docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md

SUPERSEDED DRAFT:
docs/ui-refactor/32_DRAFT_DESIGN.md

PROJECT SKILL:
.claude/skills/roll-call-ui-refactor/SKILL.md
（VALIDATION: PASS）

DECISION REGISTER:
docs/ui-refactor/80_REGISTER_DECISIONS.md
（DECISION-UI-001 ~ 009 + DECISION-PF-001）

CONFLICT REGISTER:
docs/ui-refactor/81_REGISTER_CONFLICTS.md
（CONFLICT-UI-001 RESOLVED）

GIT STATE:
main @ cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9
docs 與 skill 均為 untracked，等待使用者批准 checkpoint commit

NEXT_PHASE:
PHASE UI-3 IMPLEMENTATION
（須由使用者啟動；先過 §11 Entry Conditions）
```
