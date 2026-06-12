---
title: "roll_call_system UI Design 草稿"
project: "roll_call_system"
document_type: "UI design draft"
phase: "PHASE UI-2F-1"
language: "繁體中文"
updated_at: "2026-06-11"
status: "DRAFT_NOT_APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI Design 草稿

## 0. 文件狀態

```text
本文件是設計探索草稿。
不是批准版 DESIGN.md。
不得作為 UI 實作依據。
不得由工具自行升級為 APPROVED。
```

---

## 1. Approved Constraints

```text
Formal Data Zone
Interaction Contract Freeze
DECISION-UI-001
DECISION-PF-001
Design Variance 3 / 10
Motion Intensity 2 / 10
Visual Density 6 / 10
Desktop + iPad first
Narrow usable
Synthetic-only
```

依據文件：

```text
docs/ui-refactor/23_CHARTER_UI_REFACTOR.md
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
docs/ui-refactor/80_REGISTER_DECISIONS.md
docs/ui-refactor/31_BRIEF_CLAUDE_DESIGN_HANDOFF.md
```

---

## 2. Design Family Comparison

```text
Family A:
待 Claude Design 提出

Family B:
待 Claude Design 提出

Family C:
可選
```

每個 Family 必須包含：

```text
Layout philosophy
Navigation
Page shell
Typography
Spacing
Radius
Surface hierarchy
Button hierarchy
Status semantics
Light mode
Dark mode
Desktop
iPad
Narrow
Advantages
Risks
```

---

## 3. Component Decisions

| Area | Current State | Candidate A | Candidate B | Candidate C | Decision | Reason | Status |
|---|---|---|---|---|---|---|---|
| App Shell | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Desktop Navigation | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Narrow Navigation | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Header | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Theme Toggle | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| SessionCard | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Status Pill | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Month Grid | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Conflict Marker | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Absent Marker | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Holiday Marker | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Students Detail | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Sheet | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Dialog | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Toast | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Empty State | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Loading State | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Inline Error | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| DataPage Toolbar | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| DataPage Summary | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| DataPage Table | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |
| Fallback Banner | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | PENDING |

---

## 4. Semantic Token Draft

以下各節待 Claude Design variants 與中控裁決後填寫：

### Color tokens

```text
待填寫
```

### Status tokens

```text
待填寫
```

### Surface tokens

```text
待填寫
```

### Text tokens

```text
待填寫
```

### Spacing scale

```text
待填寫
```

### Radius scale

```text
待填寫
```

### Typography scale

```text
待填寫
```

### Shadow policy

```text
待填寫
```

### Motion policy

```text
待填寫
```

---

## 5. Responsive Draft

### DESKTOP

```text
Navigation: 待填寫
Max width: 待填寫
Grid behavior: 待填寫
Table behavior: 待填寫
Sheet behavior: 待填寫
Touch target: 待填寫
Overflow rule: 待填寫
```

### IPAD_LANDSCAPE

```text
Navigation: 待填寫
Max width: 待填寫
Grid behavior: 待填寫
Table behavior: 待填寫
Sheet behavior: 待填寫
Touch target: 待填寫
Overflow rule: 待填寫
```

### IPAD_PORTRAIT

```text
Navigation: 待填寫
Max width: 待填寫
Grid behavior: 待填寫
Table behavior: 待填寫
Sheet behavior: 待填寫
Touch target: 待填寫
Overflow rule: 待填寫
```

### NARROW

```text
Navigation: 待填寫
Max width: 待填寫
Grid behavior: 待填寫
Table behavior: 待填寫
Sheet behavior: 待填寫
Touch target: 待填寫
Overflow rule: 待填寫
```

---

## 6. Retain / Redesign / Challenge Resolution

引用：

```text
docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
```

| Matrix ID | Area | Original Classification | Design Proposal | Decision | Reason |
|---|---|---|---|---|---|
| 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 | 待填寫 |

---

## 7. Interaction Contract Check

```text
[ ] Backend API unchanged
[ ] DB Schema unchanged
[ ] Excel Contract unchanged
[ ] Formal Data Flow unchanged
[ ] RC11 overlay behavior unchanged
[ ] Conflict detection unchanged
[ ] Guarded bulk-remove unchanged
[ ] DataPage row matching unchanged
[ ] DataPage export strategy unchanged
[ ] DECISION-PF-001 not mixed into UI restyle
```

---

## 8. Open Questions

```text
待 Claude Design 比較
待中控裁決
待使用者批准
```

---

## 9. Approval Gate

```text
本文件只有在以下條件成立後，才能轉為批准版設計契約：

- Claude Design 已提出少量 variants
- Stitch 如有需要只提供局部第二意見
- 中控完成合理性審查
- 使用者批准選定方向
- Interaction Contract Check 全部通過
- 沒有 Product Feature 偷渡
- 沒有 backend / DB / Excel contract 變更
```

批准後：

```text
另行建立正式規格文件。
不得直接覆蓋本草稿。
```

---

## 10. 下一步

```text
下一步：
Phase UI-2F-2
整理 synthetic-only Screenshot Handoff Folder。
```
