---
title: "roll_call_system UI 重構決策紀錄"
project: "roll_call_system"
document_type: "UI refactor decision register"
phase: "UI REFACTOR GOVERNANCE"
language: "繁體中文"
updated_at: "2026-06-11"
status: "ACTIVE"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構決策紀錄

## 0. 文件用途

本文件記錄 `roll_call_system` UI 重構期間已經由使用者裁決的重要產品決策。

用途：

```text
避免後續工具自行推翻已批准方向
避免 Claude Design、Stitch、Claude Code 或 Codex 產生互相衝突的方案
將 UI restyle 與 Product Feature Change 明確分離
為後續 DESIGN.md、Feature Phase、驗收條件與接手文件提供依據
```

建議保存於：

```text
docs/ui-refactor/80_REGISTER_DECISIONS.md
```

---

# 1. 決策總覽

| Decision ID | 主題 | 狀態 | 類型 | 後續處理 |
|---|---|---|---|---|
| `DECISION-UI-001` | Month Grid conflict marker | APPROVED | UI Design Contract | Claude Design 階段比較具體樣式 |
| `DECISION-PF-001` | MonthPage 批量生成 preview / confirm | APPROVED | Separate Product Feature Phase | 不得混入 UI restyle |
| `DECISION-UI-002` | Shell 導航（Sidebar / BottomTabBar） | APPROVED | UI Design Contract | 寫入 36_SPEC_UI_DESIGN_APPROVED.md §5 |
| `DECISION-UI-003` | TodayPage 單欄 compact list | APPROVED | UI Design Contract | 寫入 36 §6 |
| `DECISION-UI-004` | DataPage D1 + 38px table | APPROVED | UI Design Contract | 寫入 36 §8 |
| `DECISION-UI-005` | Month Grid responsive hybrid marker | APPROVED | UI Design Contract | 寫入 36 §9 |
| `DECISION-UI-006` | StudentsPage editable IOSSheet / Split View DEFER | APPROVED | UI Design Contract + Deferred Interaction Decision | 寫入 36 §7；依據 35 號文件 |
| `DECISION-UI-007` | Status semantic token 命名 | APPROVED | UI Design Contract | 寫入 36 §3 |
| `DECISION-UI-008` | Today secondary summary responsive 規則 | APPROVED | UI Design Contract | 寫入 36 §6 |
| `DECISION-UI-009` | Bulk-remove offline affordance | APPROVED | UI Design Contract | 寫入 36 §10；行為凍結不變 |

---

# 2. DECISION-UI-001：Month Grid conflict marker 必須重新設計

## 2.1 背景

`Phase UI-1B-2C Interactive Synthetic Local-only Capture` 發現：

```text
Month Grid conflict
=
bare red corner dot

Month Grid absent
=
近似 red dot
```

問題：

```text
衝突與缺席使用相近顏色
衝突與缺席使用相近 shape
沒有 icon
沒有短文字
容易造成語義混淆
狀態高度依賴顏色
```

原 finding：

```text
UIB2C-01
Severity:
HIGH
```

## 2.2 使用者裁決

```text
APPROVED:
重新設計
```

正式規則：

> Month Grid 的 conflict 與 absent 必須使用不同 icon、shape 或短文字，不得只靠顏色區分。

## 2.3 設計邊界

本輪只確定 semantic contract，不預先指定具體視覺樣式。

具體方案留待：

```text
Claude Design 階段
```

比較。

可探索方向包括：

```text
conflict:
警告 icon
不同 shape
短文字
角標
帶 icon 的 compact marker

absent:
保留狀態 dot
不同符號
短文字
與 conflict 明確區分的 secondary marker
```

## 2.4 驗收條件

後續設計與實作必須符合：

```text
衝突與缺席不能使用相同 marker
衝突與缺席不能只以色相差異區分
在 Light Mode 可辨認
在 Dark Mode 可辨認
在 iPad Landscape 可辨認
在 Narrow Viewport 可辨認
不得降低月份 grid 的掃讀效率
不得造成明顯 overflow
```

## 2.5 分類

```text
CATEGORY:
UI DESIGN CONTRACT

INCLUDE_IN_UI_RESTYLE:
yes

REQUIRES_PRODUCT_LOGIC_CHANGE:
no

CLAUDE_DESIGN_COMPARISON_REQUIRED:
yes
```

---

# 3. DECISION-PF-001：MonthPage 批量生成新增 preview / confirm

## 3.1 背景

原本規劃文件曾假設：

```text
MonthPage batch generate
→ dry-run preview
→ confirm
→ execute
```

但 `Phase UI-1B-2C` 實際驗證後確認：

```text
現有 MonthPage batch generate
→ 開啟批量生成 Sheet
→ 按下批量生成
→ 直接執行
```

真正的 preview / confirm：

```text
NOT FOUND
```

原 finding：

```text
UIB2C-05
Severity:
MEDIUM
```

## 3.2 使用者裁決

```text
APPROVED:
新增 preview / confirm
```

正式規則：

> MonthPage 批量生成必須新增 preview / confirm 流程。

## 3.3 Preview 最低內容要求

Preview 至少顯示：

```text
日期範圍
學生數
新增數
跳過數
衝突數
```

## 3.4 流程原則

後續 Product Feature Phase 應設計為：

```text
選擇批量生成
        ↓
設定月份或日期範圍
        ↓
取得 authoritative preview
        ↓
顯示：
- 日期範圍
- 學生數
- 新增數
- 跳過數
- 衝突數
        ↓
使用者確認
        ↓
才執行批量生成
```

## 3.5 與 UI restyle 的隔離

本決策屬於：

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

原因：

```text
涉及互動流程改變
可能涉及 backend authoritative preview
可能涉及 API contract
可能涉及測試新增
需要獨立驗收
需要獨立 commit
```

## 3.6 後續 Phase 命名建議

```text
Product Feature Phase:
MONTHPAGE_BATCH_GENERATE_PREVIEW_CONFIRM
```

建議於 UI Foundation 與主要頁面視覺方向穩定後，再獨立規劃。

## 3.7 驗收條件

至少驗收：

```text
preview 顯示日期範圍
preview 顯示學生數
preview 顯示新增數
preview 顯示跳過數
preview 顯示衝突數
未確認前不得寫入
取消後不得寫入
確認後才執行
重複操作不應產生不合理重複課堂
衝突處理規則需明確
offline 狀態需 fail closed
錯誤不得只以 Toast 表達
```

## 3.8 分類

```text
CATEGORY:
PRODUCT FEATURE CHANGE

INCLUDE_IN_UI_RESTYLE:
no

SEPARATE_PHASE_REQUIRED:
yes

POTENTIAL_API_CHANGE:
yes

POTENTIAL_BACKEND_CHANGE:
yes

TARGETED_TESTS_REQUIRED:
yes

BROWSER_QA_REQUIRED:
yes
```

---

# 4. 相關 UI Audit Findings

| Finding ID | 狀態 | 對應決策 |
|---|---|---|
| `UIB2C-01` | RESOLVED BY DECISION | `DECISION-UI-001` |
| `UIB2C-05` | RESOLVED BY DECISION | `DECISION-PF-001` |
| `UIB2C-02` | OPEN | Bulk-remove offline 只靠 Toast，後續 UI 重構改善 affordance |
| `UIB2C-04` | OPEN | Holiday cell 是否保留 affected-count secondary info |
| `UIB2C-06` | OPEN | TodayPage card conflict pill cluster 擁擠 |

---

# 5. 對後續 DESIGN.md 的影響

批准版 `DESIGN.md` 必須包含：

```text
Month Grid semantic marker rules
conflict marker 與 absent marker 必須區分
狀態不得只靠顏色
Light / Dark 對應
Narrow / iPad 對應
```

批准版 `DESIGN.md` 不應直接規定：

```text
批量生成 preview / confirm 的 backend contract
```

原因：

```text
該項屬 Separate Product Feature Phase
```

DESIGN.md 可以記錄：

```text
MonthPage batch generation:
Future approved feature phase will introduce preview / confirm.
Do not silently implement during UI restyle.
```

---

# 6. 工具規則

後續所有工具必須遵守：

```text
Claude Design:
比較 Month Grid marker 視覺方案
不得自行改變 batch generation feature scope

Stitch:
可提供 Month Grid marker 第二意見
不得自行新增未批准操作

Claude Code:
UI restyle 中不得順手實作 batch generate preview / confirm
必須等待獨立 Product Feature Phase

Claude / Codex Browser QA:
驗收 conflict marker 非 color-only
在獨立 Product Feature Phase 驗收 preview / confirm
```

---

# 7. 下一步

兩項衝突已解除。

```text
NEXT_ACTION:
PHASE UI-1 CLOSEOUT
```

Phase UI-1 Closeout 應整合：

```text
repo inventory
page map
component map
interaction inventory
22 張 screenshot baseline
UI audit findings
已批准決策
未解決但可延後問題
Phase UI-2 輸入
```

完成 Phase UI-1 Closeout 後，才進入：

```text
Phase UI-2
環境、文件、工具與工作流配置
```

---

# 8. 最終狀態

```text
DECISION_REGISTER_STATUS:
ACTIVE

RESOLVED_CONFLICTS:
2

DECISION-UI-001:
APPROVED

DECISION-PF-001:
APPROVED_AS_SEPARATE_PRODUCT_FEATURE_PHASE

NEXT_PHASE:
PHASE_UI_1_CLOSEOUT
```

---

# 9. Phase UI-2F-4 追加決策（2026-06-11）

以下決策由使用者於 Phase UI-2F 設計探索（Claude Design 第一、二輪 + Board 3 對齊）後批准，完整規格寫入 `36_SPEC_UI_DESIGN_APPROVED.md`。本節只追加，不變更 §1–§8 既有內容。

## DECISION-UI-002：Shell 導航

```text
Desktop ≥1024px 使用 Sidebar 220px（允許 200–240px）；
<1024px 使用 BottomTabBar；
不採 Icon Rail。

BottomTabBar 必須：貼底、實底、上緣 hairline、safe-area spacer、不得遮擋內容。
ThemeToggle 移至 global shell；Manual Light / Dark；OS auto-follow DEFER。
```

## DECISION-UI-003：TodayPage 版型

```text
TodayPage 採單欄 compact chronological list；不採雙欄 grid。
行高約 64px，有效 hit area ≥44px。
資訊優先級：時間 → 姓名 → 狀態 → 必要操作 → secondary summary。
```

## DECISION-UI-004：DataPage 摘要與密度

```text
DataPage 採 1 主卡 + 4 compact stats（D1）；
table row height 38px；不加入 density toggle。
Sticky Header 保留；Fallback banner 為全寬 inline banner。
iPad Portrait：主卡整行 + 4 stats 2×2。
```

## DECISION-UI-005：Month Grid responsive hybrid marker

```text
Month Grid 採 responsive hybrid marker：
compact = ⚠ n / 缺 n
wide = ⚠ n 衝突 / 缺 n 缺席
Holiday = 假期 + 停 n 堂
禁止 bare dot、✕、⊘ 與 color-only。
必須保留數量。DECISION-UI-001 持續適用。
```

## DECISION-UI-006：StudentsPage 容器契約

```text
StudentsPage UI restyle 保留 editable IOSSheet contract（Desktop / iPad / Narrow）。
88vh + internal scroll 是批准的 visual proposal（非現況描述）。
Desktop Split View DEFER，列為 Separate Interaction Decision。
不得新增 View State、dirty state、未儲存提醒、刪除學生與新欄位。
依據：35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md。
```

## DECISION-UI-007：Status semantic token 命名

```text
Status semantic token 使用 status.<state>.fg / status.<state>.bg。
必要時才新增 border token。
層級固定為 primitive → semantic → component；
accent 只表達互動；pending 使用中性灰；dark mode 只 remap semantic 層。
```

## DECISION-UI-008：Today secondary summary

```text
Today secondary summary 只於 Desktop（≥1024px）顯示單行（超出 ellipsis）；
<1024px 預設隱藏，不新增展開手勢。
```

## DECISION-UI-009：Bulk-remove offline affordance

```text
Bulk-remove health checking / offline 使用 disabled menu item + inline explanation
（probe 執行中顯示「正在檢查後端連線…」）；
Toast 只作 secondary feedback。
Guarded bulk-remove、backend health gate、offline fail-closed 行為凍結不變。
```

## 9.1 追加後狀態

```text
DECISION_REGISTER_STATUS:
ACTIVE

APPROVED_DECISIONS:
DECISION-UI-001 ~ DECISION-UI-009 + DECISION-PF-001

AUTHORITATIVE_DESIGN_CONTRACT:
docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md

NEXT_PHASE:
PHASE UI-3（須由使用者啟動，不得自行進入）
```
