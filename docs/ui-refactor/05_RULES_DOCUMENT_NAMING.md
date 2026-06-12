---
title: "roll_call_system UI 重構文件命名規範"
project: "roll_call_system"
document_type: "documentation naming convention"
phase: "UI REFACTOR GOVERNANCE"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構文件命名規範

## 0. 文件用途

本文件定義 `roll_call_system` UI 重構期間所有規劃、盤點、設計、實作、驗收、衝突紀錄、接手文件與封存索引的命名方式。

目標：

```text
方便排序
方便搜尋
方便交接
方便版本追蹤
避免重複命名
避免文件散落
避免不同工具建立互相衝突的文件
```

本規範適用於：

```text
ChatGPT
Claude Code
Claude Design
Codex
Stitch
Open Design
人工紀錄
```

---

# 1. 文件儲存位置

所有 UI 重構相關文件集中存放於：

```text
docs/ui-refactor/
```

不得將 UI 重構規劃文件散落於：

```text
repo 根目錄
frontend/
backend/
release/
scripts/
backend/data/
```

例外：

```text
DESIGN.md
```

如需要讓設計工具或 coding agent 從固定入口讀取，可在 repo 根目錄建立：

```text
DESIGN.md
```

但其內容必須與：

```text
docs/ui-refactor/35_DESIGN_APPROVED.md
```

一致。

---

# 2. 核心命名格式

採用：

```text
NN_CATEGORY_TOPIC_STATUS.md
```

其中：

| 欄位 | 說明 |
|---|---|
| `NN` | 兩位數排序編號 |
| `CATEGORY` | 文件類型 |
| `TOPIC` | 文件主題 |
| `STATUS` | 可選狀態，例如 `DRAFT`、`APPROVED`、`COMPLETE` |

範例：

```text
00_MASTER_UI_REFACTOR_PLAN.md
10_AUDIT_CURRENT_UI_INVENTORY.md
15_CONTRACT_INTERACTION_FREEZE.md
30_DESIGN_DRAFT.md
35_DESIGN_APPROVED.md
41_MIGRATION_STUDENTS_LIST.md
50_QA_SCREEN_ACCEPTANCE_MATRIX.md
60_DATAPAGE_SEPARATE_GATE.md
90_HANDOFF_UI_REFACTOR.md
```

---

# 3. 命名基本規則

## 3.1 檔名語言

檔名使用：

```text
全大寫英文
```

正文可以使用繁體中文。

原因：

```text
排序穩定
跨平台穩定
避免空格與中文字元造成 Shell、Git 或工具處理問題
便於 Claude Code、Codex 與其他工具引用
```

## 3.2 分隔符號

只使用：

```text
底線 _
```

禁止使用：

```text
空格
斜線 /
反斜線 \
冒號 :
括號 ()
中括號 []
井號 #
表情符號
```

## 3.3 日期

長期規劃文件的檔名：

```text
不放日期
```

日期寫入 YAML frontmatter：

```yaml
updated_at: "YYYY-MM-DD"
```

例外：

```text
Evidence Archive
一次性截圖封存
外部交接匯出
```

這些可以在資料夾名稱中加入日期。

## 3.4 狀態

如文件需要顯示生命週期，可加入：

```text
DRAFT
APPROVED
COMPLETE
SUPERSEDED
ARCHIVED
```

範例：

```text
30_DESIGN_DRAFT.md
35_DESIGN_APPROVED.md
73_RELEASE_DECISION_COMPLETE.md
```

不應在檔名中加入：

```text
FINAL_FINAL
NEW
LATEST
NEWEST
V2_FINAL
USE_THIS_ONE
```

---

# 4. 文件編號區段

| 編號範圍 | 用途 |
|---:|---|
| `00–09` | 總綱、基準、治理規則 |
| `10–19` | Phase UI-1 現況盤點 |
| `20–29` | Phase UI-2 環境、工具與工作流 |
| `30–39` | Design System、Claude Design、Stitch |
| `40–49` | 頁面遷移計劃 |
| `50–59` | Browser QA、驗收與 Diff QA |
| `60–69` | DataPage 獨立 Gate |
| `70–79` | 整合驗收、Push、Release |
| `80–89` | 決策、衝突、變更紀錄 |
| `90–99` | 接手文件、封存索引 |

原則：

```text
先保留編號區段
再依 Phase 建立文件
不要一次建立所有空白文件
```

---

# 5. CATEGORY 建議詞彙

為避免不同工具自由創造新分類，優先使用以下固定詞彙。

| CATEGORY | 用途 |
|---|---|
| `MASTER` | 總體規劃 |
| `BASELINE` | 基準版本與凍結狀態 |
| `CHARTER` | 治理規則與範圍 |
| `TOOL` | 工具權限與分工 |
| `PROTOCOL` | 固定執行或停止協議 |
| `AUDIT` | 現況盤點 |
| `MAP` | 頁面、元件、流程地圖 |
| `MATRIX` | 狀態、驗收、分類矩陣 |
| `REGISTER` | 持續更新的紀錄簿 |
| `CONTRACT` | 不得任意改變的互動或資料契約 |
| `SPEC` | 規格 |
| `RULES` | 規則 |
| `DESIGN` | 設計系統與視覺規格 |
| `BRIEF` | 提供給設計工具的輸入 |
| `MIGRATION` | 頁面或元件遷移計劃 |
| `QA` | 驗收規則與結果 |
| `GATE` | 高風險操作入口 |
| `DECISION` | 決策 |
| `CHANGELOG` | 變更紀錄 |
| `HANDOFF` | 接手文件 |
| `ARCHIVE` | 封存索引 |

---

# 6. 建議文件清單

## 6.1 00–09：總綱與治理

```text
00_MASTER_UI_REFACTOR_PLAN.md
01_BASELINE_RC11_FREEZE.md
02_CHARTER_UI_REFACTOR.md
03_TOOL_RESPONSIBILITY_MATRIX.md
04_PROTOCOL_CONFLICT_STOP.md
05_RULES_DOCUMENT_NAMING.md
```

## 6.2 10–19：Phase UI-1 現況盤點

```text
10_AUDIT_CURRENT_UI_INVENTORY.md
11_MAP_PAGE.md
12_MAP_COMPONENT.md
13_MATRIX_STATE.md
14_REGISTER_CURRENT_UI_PROBLEMS.md
15_CONTRACT_INTERACTION_FREEZE.md
16_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
17_ARCHIVE_SYNTHETIC_SEED_SCREENSHOT_INDEX.md
18_QA_PHASE_UI_1_ACCEPTANCE.md
```

## 6.3 20–29：Phase UI-2 環境與工作流

```text
20_SPEC_ENVIRONMENT_AND_WORKFLOW_SETUP.md
21_SPEC_SYNTHETIC_SEED_LANE.md
22_RULES_SCREENSHOT_ARCHIVE.md
23_RULES_CLAUDE_CODE_EXECUTION.md
24_RULES_CODEX_BROWSER_QA.md
25_RULES_TASTE_SKILL_ADAPTATION.md
26_SPEC_ROLL_CALL_UI_SKILL.md
27_RULES_CLAUDE_DESIGN_INPUT.md
28_RULES_STITCH_USAGE.md
29_DECISION_OPEN_DESIGN_EVALUATION.md
```

## 6.4 30–39：設計系統

```text
30_DESIGN_DRAFT.md
31_BRIEF_CLAUDE_DESIGN.md
32_REGISTER_DESIGN_VARIANT_REVIEW.md
33_REGISTER_STITCH_PRESSURE_TEST.md
34_REGISTER_DESIGN_DECISIONS.md
35_DESIGN_APPROVED.md
```

## 6.5 40–49：逐頁遷移

```text
40_MIGRATION_FOUNDATION.md
41_MIGRATION_STUDENTS_LIST.md
42_MIGRATION_STUDENT_DETAIL.md
43_MIGRATION_TODAY_DASHBOARD.md
44_MIGRATION_ATTENDANCE_SHEETS.md
45_MIGRATION_SESSION_ADD_EDIT.md
46_MIGRATION_MONTHPAGE.md
47_MIGRATION_STATISTICS.md
48_MIGRATION_DATAPAGE.md
49_MIGRATION_SETTINGS_MAINTENANCE.md
```

## 6.6 50–59：QA 與驗收

```text
50_MATRIX_SCREEN_ACCEPTANCE.md
51_REGISTER_BROWSER_QA.md
52_REGISTER_DIFF_QA.md
53_REGISTER_REGRESSION_TEST.md
54_QA_ACCESSIBILITY.md
55_QA_RESPONSIVE_DARK_MODE.md
```

## 6.7 60–69：DataPage 獨立 Gate

```text
60_GATE_DATAPAGE_SEPARATE.md
61_CONTRACT_DATAPAGE_EXPORT_FREEZE.md
62_REGISTER_DATAPAGE_ACCEPTANCE.md
```

## 6.8 70–79：整合與 Release

```text
70_QA_INTEGRATED_ACCEPTANCE_PLAN.md
71_GATE_PRE_PUSH.md
72_DECISION_PUSH_AND_RELEASE.md
73_QA_NEW_RC_ACCEPTANCE.md
```

## 6.9 80–89：紀錄

```text
80_REGISTER_DECISIONS.md
81_REGISTER_CONFLICTS.md
82_CHANGELOG_UI_REFACTOR.md
```

## 6.10 90–99：接手與封存

```text
90_HANDOFF_UI_REFACTOR.md
91_ARCHIVE_INDEX.md
```

---

# 7. 文件 frontmatter 規範

每份 Markdown 文件建議加入：

```yaml
---
title: ""
project: "roll_call_system"
document_type: ""
phase: ""
language: "繁體中文"
updated_at: "YYYY-MM-DD"
status: "DRAFT | APPROVED | COMPLETE | SUPERSEDED | ARCHIVED"
baseline: "RC11 COMPLETE"
---
```

如文件被取代，加入：

```yaml
status: "SUPERSEDED"
superseded_by: "XX_NEW_FILE.md"
```

不刪除舊文件。

---

# 8. 截圖命名規範

## 8.1 儲存位置

```text
docs/ui-refactor/screenshots/
├── ui-1-baseline/
├── ui-3-design-review/
├── ui-3-page-migration/
└── ui-4-integrated-acceptance/
```

## 8.2 截圖命名格式

```text
NN_PAGE_STATE_VIEWPORT_THEME_SEQUENCE.png
```

範例：

```text
01_TODAY_NORMAL_DESKTOP_LIGHT_01.png
02_TODAY_CONFLICT_IPAD_DARK_01.png
03_STUDENTS_EMPTY_MOBILE_LIGHT_01.png
04_MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT_01.png
05_DATAPAGE_STICKY_HEADER_DESKTOP_DARK_01.png
```

## 8.3 PAGE 固定詞彙

```text
TODAY
STUDENTS
STUDENT_DETAIL
MONTHPAGE
STATISTICS
DATAPAGE
SETTINGS
MAINTENANCE
```

## 8.4 VIEWPORT 固定詞彙

```text
DESKTOP
IPAD_LANDSCAPE
IPAD_PORTRAIT
MOBILE
NARROW
```

## 8.5 THEME 固定詞彙

```text
LIGHT
DARK
```

---

# 9. Evidence Archive 命名規範

## 9.1 儲存位置

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
```

## 9.2 資料夾命名格式

```text
UIRefactor_<PhaseOrPage>_<Purpose>_YYYY-MM-DD_<random>/
```

範例：

```text
UIRefactor_PhaseUI1_Audit_2026-06-10_a1b2c3/
UIRefactor_PhaseUI2_Setup_2026-06-11_d4e5f6/
UIRefactor_StudentsList_Migration_2026-06-15_g7h8i9/
UIRefactor_IntegratedAcceptance_2026-07-01_j1k2l3/
```

## 9.3 Evidence 可包含

```text
Synthetic Seed 截圖
測試結果
Build 結果
Diff QA
Browser QA
文件副本
```

## 9.4 Evidence 禁止包含

```text
正式 DB
正式學生資料
backend/data 內容
真實模板敏感資訊
正式下載檔案中的敏感資料
```

---

# 10. 外部匯出與接手文件命名

如需要將文件下載至對話外使用，可以加入日期：

```text
roll_call_system_UI重構接手文件_YYYY-MM-DD.md
roll_call_system_UI重構總體規劃_YYYY-MM-DD.md
roll_call_system_UI重構文件命名規範_YYYY-MM-DD.md
```

這些是外部匯出名稱，不取代 repo 內固定檔名。

repo 內仍使用：

```text
00_MASTER_UI_REFACTOR_PLAN.md
05_RULES_DOCUMENT_NAMING.md
90_HANDOFF_UI_REFACTOR.md
```

---

# 11. 新文件建立規則

建立新文件前，必須確認：

```text
是否已有相同用途文件？
是否應更新現有 REGISTER？
是否需要新編號？
是否屬於正確區段？
是否會造成重複文件？
是否應標記舊文件為 SUPERSEDED？
```

優先更新現有文件：

```text
REGISTER
CHANGELOG
HANDOFF
```

只有出現新主題、新 Phase 或新 Gate 時，才新增文件。

---

# 12. 禁止命名方式

禁止：

```text
notes.md
new.md
temp.md
test.md
final.md
final_v2.md
final_latest.md
use_this.md
UI改版.md
新UI文件.md
Claude建議.md
未命名.md
```

原因：

```text
無法排序
無法判斷用途
容易重複
不利於 Git Review
不利於跨工具接手
```

---

# 13. 文件更新規則

每次更新文件時：

```text
更新 updated_at
更新 status
必要時更新 changelog
如被取代，標記 SUPERSEDED
保留歷史，不直接刪除
```

如涉及重大設計決策，同步更新：

```text
80_REGISTER_DECISIONS.md
```

如涉及衝突，同步更新：

```text
81_REGISTER_CONFLICTS.md
```

如涉及 UI 重構進度，同步更新：

```text
82_CHANGELOG_UI_REFACTOR.md
```

---

# 14. 與主規劃文件的關係

本文件是：

```text
00_MASTER_UI_REFACTOR_PLAN.md
```

的配套規範。

本文件建議在 repo 中保存為：

```text
docs/ui-refactor/05_RULES_DOCUMENT_NAMING.md
```

---

# 15. 最終狀態

```text
DOCUMENT_NAMING_RULES_STATUS:
APPROVED

RECOMMENDED_REPO_PATH:
docs/ui-refactor/05_RULES_DOCUMENT_NAMING.md

BASELINE:
RC11_COMPLETE
```
