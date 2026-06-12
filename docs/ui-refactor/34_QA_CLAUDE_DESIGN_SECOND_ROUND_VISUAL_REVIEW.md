---
title: "roll_call_system Claude Design 第二輪視覺審查"
project: "roll_call_system"
document_type: "Claude Design visual review"
phase: "PHASE UI-2F-3"
language: "繁體中文"
updated_at: "2026-06-11"
status: "APPROVED_FOR_HIFI_REFINEMENT"
baseline: "RC11 COMPLETE"
---

# roll_call_system Claude Design 第二輪視覺審查

## 0. 文件用途

本文件記錄 Claude Design 第二輪 focused comparison 對照板的中控視覺審查結果。

本文件不是批准版 `DESIGN.md`，亦不是 UI 實作授權。

用途：

```text
確認哪些方向可以固定
辨認仍需 hi-fi 驗證的視覺問題
限制第三輪只做局部 refinement
避免設計探索再次發散
```

建議保存於：

```text
docs/ui-refactor/34_QA_CLAUDE_DESIGN_SECOND_ROUND_VISUAL_REVIEW.md
```

---

# 1. 整體裁決

```text
PHASE_UI_2F3_VISUAL_REVIEW_STATUS:
APPROVED_FOR_HIFI_REFINEMENT
```

第二輪對照板已足以確認主方向：

```text
Desktop:
Sidebar Workspace

iPad Portrait / Narrow:
BottomTabBar

TodayPage:
單欄 compact chronological list

StudentsPage Desktop:
Split View

StudentsPage iPad Portrait / Narrow:
Sheet

DataPage:
D1 — 1 張主卡 + 4 個 compact stats

Month Grid:
responsive hybrid markers

Theme:
primitive → semantic → component
```

但仍不足以直接建立批准版 `DESIGN.md`。

原因：

```text
目前多數畫面仍是 low-fi 對照板
Month marker 仍需實際 12px / 七欄驗證
Students Split View 需確認 view / edit 狀態
DataPage 主卡層級需微調
Today row 的 action affordance 需 hi-fi 驗證
Dark contrast 尚需正式檢查
```

---

# 2. Sidebar Shell 視覺審查

## 2.1 Desktop Sidebar

對照板：

```text
A1
Desktop ≥1024
Sidebar 220px
```

判斷：

```text
APPROVED AS PRIMARY DIRECTION
```

優點：

```text
四個主要入口清楚
ThemeToggle 可移至 global shell
內容區不再被 max-w-4xl 過度限制
符合桌面生產力工具慣例
比浮動 BottomTabBar 更適合桌面
```

限制：

```text
Sidebar 不需要可收合
保持 200–240px 範圍
初始值 220px
```

## 2.2 iPad Portrait / Narrow

對照板：

```text
A2:
Icon Rail

A3:
BottomTabBar

A4:
Narrow BottomTabBar
```

判斷：

```text
A3 / A4 APPROVED
A2 REJECTED AS FORMAL DIRECTION
```

原因：

```text
Icon Rail 缺少文字 label
增加辨識成本
壓縮 Month Grid 七欄空間
額外增加第三套導航形態
```

固定：

```text
≥1024px:
Sidebar

<1024px:
BottomTabBar
```

BottomTabBar 必須：

```text
貼底
實底
上緣 hairline
保留 safe-area spacer
不得遮擋內容
```

---

# 3. TodayPage 視覺審查

對照板：

```text
B1:
T1 單欄 compact chronological list

B2:
T2 雙欄 SessionCard grid
```

判斷：

```text
T1 APPROVED
T2 REJECTED
```

理由：

```text
T1 維持時間軸順序
互相衝突的 14:00 / 14:30 課堂可直接上下比較
Badge cluster 仍可辨認
操作鈕仍可維持合理 hit area
```

T2 問題：

```text
時間軸變成之字形閱讀
衝突課堂被拆至不同欄
Badge 與操作鈕爭寬
操作鈕更容易低於合理 touch target
```

## 3.1 需在 hi-fi 驗證

```text
Action buttons:
✓
×
⋯
```

需要：

```text
aria-label
tooltip
hover / pressed / focus states
不得只靠顏色
```

Secondary summary slot：

```text
Desktop:
可選
單行
ellipsis

iPad Portrait / Narrow:
預設隱藏
```

優先級：

```text
時間
姓名
狀態
必要操作
secondary summary
```

---

# 4. StudentsPage 視覺審查

## 4.1 Filter Header

對照板：

```text
C1:
Stat Strip + 獨立 SegmentedControl

C2:
帶 count 的 SegmentedControl
```

判斷：

```text
C2 APPROVED
```

理由：

```text
C1 的 stat strip 與 filter 資訊高度重複
C2 可省下一整行
符合 Students list 局部 7 / 10 密度探索
```

限制：

```text
count 僅表示 filter count
不得被誤解為額外統計模組
count 視覺需次於 label
窄螢幕需驗證不 overflow
```

## 4.2 Desktop Split View

對照板：

```text
C3:
38 / 62 Split View
```

判斷：

```text
APPROVED AS PRIMARY DIRECTION
```

優點：

```text
左側列表密度合理
右側 detail pane 空間充足
固定課表與危險區有自然層級
比大型 Sheet 更符合 desktop workflow
```

## 4.3 必須修正的 hi-fi 規則

目前對照板右側 detail pane 帶有：

```text
儲存
```

但尚未清楚區分：

```text
View State
Edit State
```

不得默認讓 detail pane 永久處於可編輯狀態。

第三輪需比較：

```text
Variant ST1:
預設 View State
點擊「編輯」後進入 Edit State

Variant ST2:
局部 inline editing
但需明確 dirty state 與 Save / Cancel
```

限制：

```text
避免 accidental edit
保留學生欄位
保留 CRUD
保留固定課表
保留危險 gate
```

## 4.4 Sheet Fallback

對照板：

```text
C4:
Sheet fallback
88vh 上限
```

判斷：

```text
APPROVED
```

固定：

```text
iPad Portrait / Narrow:
Sheet

height:
min(content, 88vh)

internal scroll:
yes

danger zone:
置底
```

---

# 5. DataPage 視覺審查

對照板：

```text
D1:
1 主卡 + 4 compact stats

D2:
2 主卡 + inline secondary

D3:
summary strip + compact table
```

判斷：

```text
D1 APPROVED
D2 REJECTED
D3 STRESS-TEST REFERENCE ONLY
```

D1 優點：

```text
服務總次數的主層級清楚
四個次要指標仍可快速掃讀
不會把缺席資訊藏進小字
保持 DataPage table 可見高度
```

D2 問題：

```text
缺席 / 未完成等資訊被弱化
inline secondary 容易被忽略
```

D3 問題：

```text
主指標層級消失
30px row height 過緊
更像純報表工具
```

固定：

```text
table row height:
38px

density toggle:
不加入

Sticky Header:
保留

Fallback banner:
全寬 inline banner
icon + 文字
不得只靠 Toast
```

## 5.1 Hi-fi 微調

D1 仍需驗證：

```text
主卡寬度
四個 compact stats 的最小寬度
iPad Portrait 2×2 折行
主卡與 table 的垂直比例
```

---

# 6. Month Grid Marker 視覺審查

對照板：

```text
E1:
M1 文字優先

E2:
M2 Icon + Count

E3:
Dark Mode

E4:
iPad 七欄壓力測試
```

## 6.1 M1 判斷

```text
TEXT-ONLY:
不作主要方向
```

優點：

```text
學習成本低
中文語義直接
```

問題：

```text
86px 七欄 cell 中
conflict + absent 共存時容易折行
增加 row height
Month Grid 密度不穩定
```

## 6.2 M2 判斷

```text
RESPONSIVE HYBRID:
APPROVED WITH REVISION
```

保留：

```text
conflict:
⚠ n
```

不採用：

```text
absent:
⊘ n
```

原因：

```text
⊘ 可能被理解為禁止
學習成本不必要
12px 下辨識度未驗證
```

固定 marker：

```text
Compact cell:
conflict = ⚠ n
absent   = 缺 n

Wide cell:
conflict = ⚠ n 衝突
absent   = 缺 n 缺席
```

規則：

```text
不得只靠顏色
不得使用 bare dot
不得使用相同 shape
不得使用 ✕
不得使用 ⊘
必須保留數量
```

Holiday：

```text
假期
停 n 堂
```

## 6.3 第三輪必驗

```text
12px 實際辨識度
Light contrast
Dark contrast
iPad 七欄 cell
conflict + absent 同格
holiday cell
今日圈與 marker 共存
```

---

# 7. Semantic Token 視覺審查

對照板：

```text
F1:
Light / Dark semantic token direction
```

判斷：

```text
APPROVED AS TOKEN ARCHITECTURE
```

固定層級：

```text
primitive
→
semantic
→
component
```

固定 semantic direction：

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
status.present
status.absent
status.pending
status.conflict
status.holiday
status.makeup
```

固定規則：

```text
accent 只表達互動
accent 不得表達狀態
pending 使用中性灰
conflict 使用琥珀
absent 使用紅
dark mode 只 remap semantic 層
```

## 7.1 不直接固定的內容

不得直接複製：

```text
示意 hex
color-scheme: only light
任何 verifier sandbox workaround
```

原因：

```text
正式專案仍需 Manual Light / Dark
對照板修正只處理非標準驗證沙箱
```

## 7.2 字級修正

對照板中：

```text
text.tertiary:
最小 11px
```

中控裁決：

```text
一般 user-facing UI text:
最低 12px

11px:
只可用於低優先級 metadata
且需通過 contrast 與可讀性驗證
```

---

# 8. 已批准 Decision 1–5

## Decision 1

```text
≥1024px:
Sidebar

<1024px:
BottomTabBar

Icon Rail:
不採用
```

## Decision 2

```text
Month Grid responsive hybrid marker:
批准

Compact:
⚠ n
缺 n

Wide:
⚠ n 衝突
缺 n 缺席

Holiday:
假期
停 n 堂
```

## Decision 3

```text
DataPage table:
38px 單一密度

density toggle:
不加入
```

## Decision 4

```text
Today desktop:
可加入單行 secondary summary slot

iPad Portrait / Narrow:
預設隱藏
```

## Decision 5

```text
MonthPage 批量操作:
可移至 toolbar

Desktop:
文字按鈕「批量操作」

iPad / Narrow:
工具列 overflow menu
完整文字 label

offline:
disabled state + inline explanation
```

不得改變：

```text
direct-execute 現況
Guarded bulk-remove
backend health gate
offline fail-closed
```

---

# 9. 可直接進入 Design Draft 的條款

```text
Desktop Sidebar 220px
<1024 BottomTabBar
Global ThemeToggle
Today T1 chronological list
Students C2 count segmented
Students Desktop Split View 38 / 62
Students Sheet fallback 88vh
DataPage D1
DataPage table 38px
DataPage Sticky Header
Fallback inline banner
Month responsive hybrid marker
Holiday secondary count
Semantic token architecture
Low motion
Density baseline 6 / 10
局部列表可至 7 / 10
```

---

# 10. 第三輪 Hi-fi 必須收斂的項目

只處理：

```text
1. TodayPage T1 Light / Dark
2. MonthPage Light / Dark
3. Month marker compact / wide / iPad 七欄
4. Students Split View View State / Edit State
5. DataPage D1 desktop / iPad portrait
6. Sidebar + BottomTabBar shell
7. Fallback banner
8. Bulk-remove offline disabled affordance
```

不要：

```text
重新提出新 design family
製作完整 prototype
修改 repo
輸出程式碼
新增 Product Feature
要求正式資料
```

---

# 11. Stitch 使用判斷

```text
CURRENT_DECISION:
NOT REQUIRED YET
```

理由：

```text
目前主要方向已明確
剩餘問題可以由 Claude Design 第三輪 hi-fi refinement 解決
暫不需要額外工具擴張
```

只有在以下情況才引入 Stitch：

```text
Month marker 12px 辨識仍有爭議
Students Split View hi-fi 有兩套同樣合理方案
Sidebar / BottomTabBar responsive 邊界仍不穩定
```

---

# 12. 下一步

```text
NEXT_ACTION:
PHASE UI-2F-3B
FAMILY B HIFI FOCUSED BOARD
```

輸出回到中控審查後，才決定是否建立正式 `DESIGN.md`。
