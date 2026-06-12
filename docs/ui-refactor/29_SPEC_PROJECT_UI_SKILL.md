---
title: "roll_call_system 專案專屬 UI Skill 規格"
project: "roll_call_system"
document_type: "project-specific UI skill specification"
phase: "PHASE UI-2E-1"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system 專案專屬 UI Skill 規格

## 0. 文件用途

```text
本文件定義後續 project-level Claude Code Skill 的內容與啟用方式。
本輪只寫規格，不建立實際 SKILL.md。
```

前置盤點（2026-06-10）：`.claude/` 目前只有 `launch.json`（tracked、RC11 基線既有）與 `settings.local.json`（gitignored）；`.claude/skills/` 不存在，無同名或外部 Taste Skill 衝突。

---

## 1. Skill Path

```text
.claude/skills/roll-call-ui-refactor/SKILL.md
```

Skill scope：

```text
PROJECT_ONLY
```

---

## 2. Skill Frontmatter Spec

後續實際 Skill 應使用：

```yaml
---
name: roll-call-ui-refactor
description: Apply roll_call_system UI-refactor governance when planning, designing, implementing, or reviewing frontend UI changes. Enforce the approved charter, interaction freeze, retain-redesign-challenge matrix, formal-data rules, and conflict-stop protocol. Use only for roll_call_system UI-refactor work.
user-invocable: true
---
```

明確規定：

```text
不要加入 allowed-tools。
不要預先授權 Bash。
不要預先授權寫入。
不要設定 dependency install 權限。
```

理由：

```text
Skill 是治理規則，不是自動執行腳本。
涉及寫入的操作仍需逐 Phase 明確批准。
```

---

## 3. Invocation Policy

```text
允許使用者手動啟動：
/roll-call-ui-refactor

允許 Claude 在明確屬於 roll_call_system UI 重構工作時載入。

不得用於一般 backend 任務。
不得用於 release 任務。
不得用於其他 repo。
```

如 Skill 誤觸發：

```text
收窄 description
或
另行裁決是否加入 disable-model-invocation: true
```

---

## 4. Skill 優先級

```text
正式資料安全
        ↓
Backend / DB / Excel / Release Contract
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
Taste Skill Adaptation
        ↓
工具建議
```

下層與上層衝突時停止（`27_PROTOCOL_CONFLICT_STOP.md`）。

---

## 5. Skill 必須引用的文件

```text
docs/ui-refactor/23_CHARTER_UI_REFACTOR.md
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
docs/ui-refactor/26_MATRIX_TOOL_RESPONSIBILITY.md
docs/ui-refactor/27_PROTOCOL_CONFLICT_STOP.md
docs/ui-refactor/28_RULES_TASTE_SKILL_ADAPTATION.md
docs/ui-refactor/80_REGISTER_DECISIONS.md
```

```text
SKILL.md 應保持精簡。
詳細規則保留在 docs/ui-refactor/。
需要時再讀取對應文件。
```

---

## 6. Skill Body Outline

實際 Skill 至少包含以下段落：

```text
Scope
Priority order
Formal Data Zone
UI-restyle allowed scope
Freeze rules
Approved decisions
Taste Skill adaptations
Mandatory preflight
Stop codes
Expected handoff
No silent Product Feature rule
No release action rule
```

---

## 7. Skill 強制規則

```text
先 audit，再改 UI
每次只修改批准範圍
不得自行新增 Product Feature
不得自行新增 dependency
不得修改 backend
不得修改 DB schema
不得修改 Excel contract
不得接觸 backend/data
不得使用真實學生資料
不得自行 push
不得自行 tag
不得自行 package
不得覆蓋 artifact
不得操作 live process
不得使用 killall / pkill / 模糊 grep kill
如有衝突，使用 27_PROTOCOL_CONFLICT_STOP.md 的固定格式停止
```

---

## 8. UI Design 強制規則

```text
避免過度卡片化
避免過度 Pill 化
避免裝飾性 Dot
狀態不得只靠顏色
Theme 層級一致
Radius 使用有限 scale
Spacing 使用有限 scale
Desktop 不可因留白犧牲掃讀效率
iPad touch target 必須合理
Narrow 不得 horizontal overflow
Toast 不得作為唯一 Error channel
```

---

## 9. 已批准決策

```text
DECISION-UI-001:
Month Grid conflict marker 與 absent marker 必須使用不同 icon、shape 或短文字。
具體樣式留待 Claude Design 比較。

DECISION-PF-001:
MonthPage batch-generate preview / confirm 已批准，但屬 Separate Product Feature Phase。
UI restyle 不得順手實作。
```

---

## 10. Skill Validation Plan

後續 UI-2E-2 建立實際 Skill 後，至少驗證：

```text
SKILL.md path 正確
frontmatter 正確
沒有 allowed-tools
沒有 dependency install
沒有 release action
能以 /roll-call-ui-refactor 手動啟動
Claude 能在 UI-refactor request 中辨認 skill
Claude 不會在 backend-only request 中誤觸發
如 .claude/skills 是本 session 新建，必要時重新啟動 Claude Code
```

---

## 11. 下一步

```text
下一步：
Phase UI-2E-2
建立並驗證：
.claude/skills/roll-call-ui-refactor/SKILL.md
```
