---
title: "roll_call_system UI Design 批准規格"
project: "roll_call_system"
document_type: "approved UI design contract"
phase: "PHASE UI-2F-4"
language: "繁體中文"
updated_at: "2026-06-11"
status: "APPROVED"
baseline: "RC11 COMPLETE"
supersedes: "32_DRAFT_DESIGN.md"
---

# roll_call_system UI Design 批准規格

本文件是 Phase UI-3 實作的單一設計依據。

## 0. 文件地位

```text
本文件是 UI restyle 的正式設計契約。
32_DRAFT_DESIGN.md 保留作歷史草稿，不得作為實作依據。
工具建議不得推翻本文件。
```

依據文件：

```text
docs/ui-refactor/23_CHARTER_UI_REFACTOR.md
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
docs/ui-refactor/28_RULES_TASTE_SKILL_ADAPTATION.md
docs/ui-refactor/33_DECISION_CLAUDE_DESIGN_EXPLORATION_BOUNDARIES.md
docs/ui-refactor/34_QA_CLAUDE_DESIGN_SECOND_ROUND_VISUAL_REVIEW.md
docs/ui-refactor/35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md
docs/ui-refactor/80_REGISTER_DECISIONS.md
```

---

## 1. Product Language

```text
Apple-inspired Productivity Interface
Low Noise
Operational
Trust-first
Desktop-friendly
iPad-friendly
Narrow usable
Low motion
中高資訊密度
```

---

## 2. Calibration

```text
DESIGN_VARIANCE:
3 / 10

MOTION_INTENSITY:
2 / 10

VISUAL_DENSITY:
6 / 10

LOCAL_DENSITY_UP_TO:
7 / 10
```

局部密度 7 / 10 只允許：

```text
Today compact list
Students list
DataPage table
```

限制：

```text
不得將全站統一提高至 7 / 10
不得因提高密度而犧牲 touch target
不得因提高密度而造成 narrow overflow
```

---

## 3. Token Architecture

固定層級：

```text
primitive
→ semantic
→ component
```

至少建立以下 semantic tokens：

```text
accent
surface.page
surface.sidebar
surface.card
surface.inset
text.primary
text.secondary
text.tertiary
border.subtle

status.present.fg
status.present.bg
status.absent.fg
status.absent.bg
status.pending.fg
status.pending.bg
status.conflict.fg
status.conflict.bg
status.holiday.fg
status.holiday.bg
status.makeup.fg
status.makeup.bg
```

規則：

```text
accent 只表達互動
accent 不得表達狀態
pending 使用中性灰
dark mode 只 remap semantic 層
component 禁止直接引用 primitive
```

必要時才新增 border token（`status.<state>.border`），不預先全套建立。

---

## 4. Typography

```text
一般 user-facing UI text:
最低 12px

11px:
只限低優先級 metadata
並需驗證 contrast 與可讀性
```

---

## 5. Shell

```text
Desktop ≥1024px:
Sidebar 220px
允許範圍 200–240px
不需要可收合

<1024px:
BottomTabBar

Icon Rail:
不採用

BottomTabBar:
貼底
實底
上緣 hairline
safe-area spacer
不得遮擋內容

ThemeToggle:
global shell
Manual Light / Dark
OS auto-follow DEFER
```

---

## 6. TodayPage

```text
單欄 compact chronological list
不得採雙欄 grid
行高約 64px
有效 hit area ≥44px
資訊優先級：
時間 → 姓名 → 狀態 → 必要操作 → secondary summary
```

Secondary summary：

```text
Desktop ≥1024px:
可顯示單行
超出 ellipsis

<1024px:
預設隱藏
不新增展開手勢
```

Action buttons（✓ / × / ⋯）必須具備：

```text
aria-label
tooltip
hover / pressed / focus states
不得只靠顏色
```

---

## 7. StudentsPage

依據：`35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md`。

Filter header：

```text
帶 count 的 SegmentedControl
count 次於 label
保留四段：
全部
啟用中
已設定停用
已停用
```

正式 contract：

```text
Desktop / iPad Portrait / Narrow:
Students list
+
editable IOSSheet
```

允許視覺改善：

```text
Sheet height = min(content, 88vh)
internal scroll
危險操作區分組
Save / Cancel 位置與樣式調整
```

不得新增：

```text
View State
dirty state
未儲存提醒
Split View
刪除學生
新欄位
```

Split View：

```text
DEFERRED
SEPARATE INTERACTION DECISION
```

權威欄位 / 狀態 / 操作清單以 35 號文件 §3–§6 為準：欄位只有 ID、姓名、生日、學校、狀態、停用日期；狀態只有 啟用中 / 已設定停用 / 已停用；操作為 新增學生、編輯學生、立即停用、指定日期停用、修改停用日期、取消停用設定、恢復學生，加上固定課表的 新增固定課表 / 編輯 / 停用恢復 / 刪除 / 生成本月 regular 課次 / 清除本月 regular / 重新生成本月 regular。

---

## 8. DataPage

```text
D1:
1 張主卡
+
4 個 compact stats

table row height:
38px

density toggle:
不加入

Sticky Header:
保留

Fallback banner:
全寬 inline banner
icon + 文字
Toast 不得為唯一渠道
```

iPad Portrait：

```text
主卡整行
4 stats 使用 2×2
```

---

## 9. MonthPage

導航：

```text
Desktop:
toolbar 顯示「批量操作」

iPad / Narrow:
toolbar overflow menu
完整文字 label
```

Marker（responsive hybrid）：

```text
Compact cell:
conflict = ⚠ n
absent   = 缺 n

Wide cell:
conflict = ⚠ n 衝突
absent   = 缺 n 缺席

Holiday:
假期
停 n 堂
```

禁止：

```text
bare dot
✕
⊘
只靠顏色
相同 shape
```

必須保留數量;DECISION-UI-001（conflict 與 absent 必須以 icon / shape / 短文字區分）持續適用。

---

## 10. Bulk-remove Offline Affordance

```text
health probe 執行中:
menu item disabled
顯示「正在檢查後端連線…」

probe 失敗:
menu item disabled
inline explanation
Toast 只作 secondary feedback
```

行為凍結：

```text
Guarded bulk-remove
backend health gate
offline fail-closed
authoritative preview
danger confirmation
```

---

## 11. Dark Mode

```text
Manual Light / Dark
rollcall-theme persistence 保留
只 remap semantic tokens
不得使用 color-scheme: only light 作正式 app 規則
不得複製 verifier sandbox workaround
```

---

## 12. Accessibility

至少固定：

```text
狀態不得只靠顏色
touch target ≥44px
keyboard focus state
hover / pressed / disabled state
tooltip / aria-label
Reduced Motion
Toast 不得作唯一錯誤渠道
narrow 不得 horizontal overflow
```

---

## 13. Frozen Contracts

引用：

```text
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
```

不得改變：

```text
Backend API
DB schema
Excel contract
Attendance / absence / makeup / extra-lesson logic
Conflict detection logic
RC11 native date / month overlay
Guarded bulk-remove
DataPage row matching
DataPage preview / confirm
DataPage export strategy
browser fallback
release flow
```

---

## 14. Separate Product Features

保留為獨立 Phase，不得混入 UI restyle：

```text
MonthPage batch-generate preview / confirm
=
Separate Product Feature Phase
（DECISION-PF-001）

Students Desktop Split View
=
Separate Interaction Decision
（DECISION-UI-006）
```

---

## 15. Implementation Order

只規劃，不實作：

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

## 16. Stop Conditions

引用：

```text
docs/ui-refactor/27_PROTOCOL_CONFLICT_STOP.md
```

任何實作階段遇到與本契約、Interaction Freeze 或 Formal Data Rule 衝突時，fail closed 停止並回報，不得自行裁決。
