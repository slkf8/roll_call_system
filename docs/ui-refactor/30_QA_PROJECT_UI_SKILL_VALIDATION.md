---
title: "roll_call_system 專案專屬 UI Skill 驗收報告"
project: "roll_call_system"
document_type: "project UI skill validation report"
phase: "PHASE UI-2E"
language: "繁體中文"
updated_at: "2026-06-11"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
skill_path: ".claude/skills/roll-call-ui-refactor/SKILL.md"
next_phase: "PHASE UI-2F CLAUDE DESIGN INPUT AND DESIGN DRAFT SETUP"
---

# roll_call_system 專案專屬 UI Skill 驗收報告

## 0. 文件用途

本文件記錄 `roll_call_system` project-level Claude Code Skill：

```text
.claude/skills/roll-call-ui-refactor/SKILL.md
```

的建立與驗收結果。

Skill 的用途是：

```text
在 roll_call_system UI 重構工作中，自動載入專案治理規則；
限制工具越權；
維持 Interaction Contract Freeze；
禁止 Formal Data Zone 存取；
禁止將 Product Feature 偷渡進 UI restyle；
遇到衝突時 fail closed。
```

建議保存於：

```text
docs/ui-refactor/30_QA_PROJECT_UI_SKILL_VALIDATION.md
```

---

# 1. 驗收結論

```text
PROJECT_UI_SKILL_STATUS:
PASS

SKILL_PATH:
.claude/skills/roll-call-ui-refactor/SKILL.md

SKILL_SCOPE:
PROJECT_ONLY
```

已通過：

```text
靜態安全驗證
手動 discoverability 驗證
正向 auto-invocation 驗證
backend-only 負向 auto-invocation scope 驗證
```

中控判斷：

> `roll-call-ui-refactor` 已可投入 Phase UI-2 後續配置與 Phase UI-3 UI 重構工作。它是治理型 Skill，不是自動執行腳本，不預先授權 Bash、寫入、dependency install、release action 或正式資料存取。

---

# 2. 建立階段：Phase UI-2E-2

```text
PHASE_UI_2E2_STATUS:
PASS_PROJECT_UI_SKILL_CREATED_STATIC_VALIDATION_RESTART_REQUIRED
```

建立：

```text
.claude/skills/roll-call-ui-refactor/SKILL.md
```

Skill frontmatter：

```yaml
name: roll-call-ui-refactor
description: Apply roll_call_system UI-refactor governance when planning, designing, implementing, or reviewing frontend UI changes. Enforce the approved charter, interaction freeze, retain-redesign-challenge matrix, formal-data rules, and conflict-stop protocol. Use only for roll_call_system UI-refactor work.
user-invocable: true
```

沒有加入：

```text
allowed-tools
disallowed-tools
disable-model-invocation
context
agent
hooks
paths
shell
```

沒有建立：

```text
supporting scripts
hooks
plugins
MCP
dependency install
```

---

# 3. 靜態安全驗證

```text
SKILL_STATIC_SAFETY:
PASS
```

已確認：

```text
SKILL.md path 正確
frontmatter 正確
description 嚴格限制於 roll_call_system UI-refactor
user-invocable = true
只有單一 SKILL.md
沒有 allowed-tools
沒有 shell injection
沒有 supporting scripts
沒有 npx
沒有 npm install
沒有 dependency 修改
```

---

# 4. 手動 Discoverability 驗證

重新啟動 Claude Code 後，使用：

```text
/roll-call-ui-refactor
```

結果：

```text
PHASE_UI_2E3A_STATUS:
PASS_PROJECT_UI_SKILL_MANUAL_DISCOVERABILITY

SKILL_MANUAL_INVOCATION:
recognized
```

已確認 Skill 可以手動啟動。

載入後 Claude 能正確摘要：

```text
Priority Order
Formal Data Zone
UI-restyle Scope
Frozen Rules
DECISION-UI-001
DECISION-PF-001
Prohibited Actions
Stop Rule
```

---

# 5. 正向 Auto-invocation 驗證

在全新 Claude Code session 中：

```text
沒有手動輸入：
/roll-call-ui-refactor
```

只提供明確的 `roll_call_system` UI 重構規劃任務：

```text
針對 Month Grid conflict marker
整理 Claude Design 探索輸入
```

結果：

```text
PHASE_UI_2E3B1_STATUS:
PASS_PROJECT_UI_SKILL_POSITIVE_AUTO_INVOCATION
```

可觀察證據：

```text
Skill(roll-call-ui-refactor)
→ Successfully loaded skill
```

已確認 Skill 會在相關 UI 重構任務中自動載入。

## 5.1 正向載入後的治理表現

Claude 正確保留：

```text
Formal Data Zone
Interaction Contract Freeze
DECISION-UI-001
DECISION-PF-001
Stop Rule
Synthetic-data-only 原則
```

並將 Month Grid marker 探索限制於：

```text
icon
shape
短文字
放置位置
共存呈現
視覺密度
accessibility
status semantics
```

沒有擴張至：

```text
conflict detection logic
backend
DB
Excel
Formal Data Zone
Product Feature
```

---

# 6. Backend-only 負向 Auto-invocation Scope 驗證

在另一個全新 Claude Code session 中：

```text
沒有手動輸入 slash command
沒有提及 UI 重構
沒有提及 Skill 名稱
```

提供中性 backend-only 任務：

```text
只根據 backend source code
整理 runtime 啟動方式與 GET /health 行為
```

結果：

```text
BACKEND_SCOPE_CHECK_STATUS:
PASS_READONLY_BACKEND_SOURCE_INVENTORY

SKILL_EVENTS_OBSERVED:
none
```

本輪沒有出現：

```text
Skill(roll-call-ui-refactor)
```

因此：

```text
NEGATIVE_AUTO_INVOCATION_SCOPE_TEST:
PASS
```

## 6.1 負向測試的意義

目前 description 沒有在一般 backend-only source inventory 中誤觸發。

這足以通過初始驗收。

但這不是對所有未來任務的絕對保證。後續如出現誤觸發：

```text
先停止
記錄案例
收窄 description
或
另行裁決是否加入 disable-model-invocation: true
```

不得直接忽略。

---

# 7. Backend-only 測試中的最小權限控制

Claude 曾提出：

```text
find backend ...
+
ls -la repo root
```

中控拒絕多餘的：

```text
ls -la repo root
```

只允許收窄後的 backend source inventory。

原則：

```text
完成任務所需的最小讀取範圍
不得因方便而擴大探索範圍
不得給予不必要的持久授權
```

負向測試最終只讀取：

```text
backend/run.py
backend/app/config.py
backend/app/main.py
backend/app/services/app_lock.py
backend/app/database.py
```

沒有讀取：

```text
backend/data/
frontend/
release/
test_artifacts/
```

---

# 8. Formal Data Zone 驗證

正式資料區：

```text
backend/data/
=
OPAQUE_PROTECTED_FORMAL_DATA_ZONE
```

在 UI Skill 建立與驗收階段：

```text
FORMAL_DATA_CONTENT_ACCESSED:
no
```

常規規則維持：

```bash
test -d backend/data
```

為唯一允許查詢。

backend-only 負向 scope 測試中，因不需要確認 Formal Data Zone 是否存在，因此：

```text
FORMAL_DATA_ZONE_QUERIED:
no
```

---

# 9. Skill 治理層級

Skill 內固定以下優先順序：

```text
Formal-data safety
+
Backend / DB / Excel / Release Contracts
        ↓
23_CHARTER_UI_REFACTOR.md
        ↓
24_CONTRACT_INTERACTION_FREEZE.md
        ↓
80_REGISTER_DECISIONS.md
        ↓
25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
        ↓
批准版 DESIGN.md
        ↓
28_RULES_TASTE_SKILL_ADAPTATION.md
        ↓
工具建議
```

原則：

```text
低層不得覆蓋高層
工具建議不是自動批准規格
有衝突必須 fail closed
```

---

# 10. Skill 強制限制

Skill 禁止未經 Phase 明確批准的：

```text
新增 dependency
新增 Product Feature
修改 backend
修改 DB schema
修改 Excel contract
存取 Formal Data Zone
操作 live process
使用 killall
使用 pkill
使用 pattern kill
push
tag
package
artifact overwrite
```

---

# 11. 已批准決策載入驗證

## 11.1 DECISION-UI-001

```text
Month Grid conflict marker
與
absent marker
```

必須使用不同：

```text
icon
shape
或
短文字
```

不得只靠顏色區分。

```text
SKILL_LOAD_VALIDATION:
PASS
```

## 11.2 DECISION-PF-001

```text
MonthPage batch-generate preview / confirm
```

已批准，但只能放入：

```text
Separate Product Feature Phase
```

不得混入：

```text
UI restyle
```

```text
SKILL_LOAD_VALIDATION:
PASS
```

---

# 12. 驗收矩陣

| 驗收項目 | 結果 |
|---|---|
| Skill path | PASS |
| Skill frontmatter | PASS |
| Project-only description | PASS |
| No allowed-tools | PASS |
| No shell injection | PASS |
| No supporting scripts | PASS |
| Manual invocation | PASS |
| Positive auto-invocation | PASS |
| Backend-only negative scope test | PASS |
| Formal Data safety | PASS |
| Git baseline preserved | PASS |
| No source modification | PASS |
| No dependency modification | PASS |
| No release action | PASS |

---

# 13. 後續使用規則

## 13.1 UI 重構相關任務

允許：

```text
Skill 自動載入
或
使用者手動輸入：
/roll-call-ui-refactor
```

## 13.2 Backend-only 任務

預期：

```text
不自動載入 UI Skill
```

如誤觸發：

```text
STOP_UI_SKILL_SCOPE_MISMATCH
```

並重新評估 description。

## 13.3 Release 任務

UI Skill 不應作為：

```text
release
push
tag
package
artifact overwrite
```

的執行入口。

---

# 14. Changed Files Gate

驗收結束時：

```text
SOURCE_MODIFIED:
no

DOCS_MODIFIED:
no

CLAUDE_SKILL_MODIFIED:
no

SETTINGS_MODIFIED:
no

DEPENDENCY_MODIFIED:
no

PROCESS_STARTED:
no

PROCESS_STOPPED:
no

FORMAL_DATA_CONTENT_ACCESSED:
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

# 15. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_2E_COMPLETE

PROJECT_UI_SKILL:
CREATED_AND_VALIDATED

MANUAL_INVOCATION:
PASS

POSITIVE_AUTO_INVOCATION:
PASS

BACKEND_ONLY_NEGATIVE_SCOPE_TEST:
PASS

NEXT_PHASE:
PHASE_UI_2F_CLAUDE_DESIGN_INPUT_AND_DESIGN_DRAFT_SETUP
```
