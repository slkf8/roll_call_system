---
title: "roll_call_system Claude Design 第二輪探索邊界決策"
project: "roll_call_system"
document_type: "design exploration boundary decision"
phase: "PHASE UI-2F-3"
language: "繁體中文"
updated_at: "2026-06-11"
status: "APPROVED_FOR_EXPLORATION"
baseline: "RC11 COMPLETE"
---

# roll_call_system Claude Design 第二輪探索邊界決策

## 0. 文件用途

本文件記錄 Claude Design 第一輪探索後，由使用者批准的第二輪探索邊界。

本文件不是批准版 `DESIGN.md`，亦不是 UI 實作授權。

用途：

```text
固定第二輪比較範圍
避免候選方向被誤當成最終方案
避免 Product Feature 偷渡進 UI restyle
限制 Claude Design 只比較少量高價值 variants
```

建議保存於：

```text
docs/ui-refactor/33_DECISION_CLAUDE_DESIGN_EXPLORATION_BOUNDARIES.md
```

---

# 1. Decision A：Design Family 探索優先級

```text
STATUS:
APPROVED
```

第二輪探索優先級：

```text
PRIMARY EXPLORATION:
Family B — Sidebar Workspace

LOW-RISK FALLBACK:
Family A — Refined Card

STRESS-TEST REFERENCE:
Family C — Inset Grouped List
```

限制：

```text
Family B 不是已批准最終方案
Family A 需保留作低風險 fallback
Family C 只作局部密度壓力測試，不作全站主要候選
```

---

# 2. Decision B：Visual Density 校準

```text
STATUS:
APPROVED
```

全站基準：

```text
VISUAL_DENSITY:
6 / 10
```

局部允許探索至：

```text
7 / 10
```

適用範圍：

```text
DataPage table
Students list
Today compact chronological list
```

限制：

```text
不得將全站統一提高至 7 / 10
不得因提高密度而犧牲 touch target
不得因提高密度而造成 narrow overflow
不得破壞 TodayPage 時間順序掃讀
```

---

# 3. Decision C：MonthPage 批量操作入口位置

```text
STATUS:
APPROVED
```

允許：

```text
視覺位置調整
工具列重排
更清楚的 label
更清楚的 offline affordance
```

必須保留：

```text
入口容易找到
不得增加高頻操作步驟
現有 direct-execute 行為維持不變
Guarded bulk-remove flow 維持不變
backend health gate 維持不變
```

禁止：

```text
在 UI restyle 中提前實作 batch-generate preview / confirm
假設未來 Product Feature 已存在
修改 backend API
修改安全 gate
```

---

# 4. Decision D：Students Detail 容器策略

```text
STATUS:
APPROVED
```

第二輪探索優先級：

```text
Desktop:
優先探索 Split View

iPad Portrait:
保留 Sheet

Narrow:
保留 Sheet

Detail Page:
只作低優先級比較
```

限制：

```text
學生欄位不得遺失
CRUD 能力不得遺失
固定課表能力不得遺失
危險操作 gate 不得弱化
```

---

# 5. Decision E：OS Theme Auto-follow

```text
STATUS:
DEFERRED
```

UI restyle 階段維持：

```text
Manual Light / Dark
```

本階段不得新增：

```text
auto / light / dark
三段式 theme control
```

OS auto-follow：

```text
列為後續獨立產品決策
```

---

# 6. 第二輪必須比較但尚未裁決的項目

## 6.1 Desktop Sidebar 與 iPad 中寬 viewport

已批准：

```text
Desktop ≥ 1024px:
優先探索完整 Sidebar
```

尚未裁決：

```text
768–1023px:
Icon Rail
vs
BottomTabBar
```

不得預先假設 iPad Portrait 必須使用 icon rail。

## 6.2 TodayPage 時間序列

必須比較：

```text
Variant T1:
單欄 compact chronological list

Variant T2:
雙欄 SessionCard grid
```

限制：

```text
不得破壞時間順序掃讀
不得只以增加卡片數量判斷較佳方案
```

## 6.3 StudentsPage 計數與篩選

必須比較：

```text
Variant S1:
Compact Stat Strip
+
獨立 SegmentedControl

Variant S2:
帶 count 的 SegmentedControl
```

不得預先批准將 summary 全部塞入篩選控制。

## 6.4 DataPage Summary Density

必須比較：

```text
Variant D1:
1 張主卡
+
4 個 compact stats

Variant D2:
2 張主卡
+
inline secondary metrics

Variant D3:
單一 summary strip
```

必須保留：

```text
DataPage table density
Sticky Header
Fallback banner
```

## 6.5 Month Grid Marker

集中比較：

```text
Variant M1:
文字優先
conflict = 衝突
absent = 缺 n

Variant M2:
Icon + count
conflict = ⚠ n
absent = 獨立 absent icon + n
```

禁止：

```text
只靠顏色
使用相同 shape
使用 decorative dot 作唯一狀態語法
使用 ✕ 作 absent icon
```

原因：

```text
✕ 容易被理解為刪除、取消或關閉
```

Holiday marker：

```text
保留文字：
假期

探索 secondary info：
停 n 堂
```

---

# 7. 已固定設計規則

第二輪可以直接視為固定條件：

```text
Desktop 導航優先探索 Sidebar
Narrow 保留 BottomTabBar
ThemeToggle 移至 global shell
建立全站 semantic token layer
Month conflict 與 absent marker 明確分離
Holiday 保留文字標籤
DataPage Sticky Header 保留
Fallback banner 改為 inline banner
Bulk-remove 維持 fail closed
Motion 維持低強度
Desktop 密度提高但不得犧牲時間序列掃讀
```

---

# 8. 第二輪 Claude Design 輸出要求

第二輪只需要 focused comparison，不需要再提出全新 design family。

要求輸出：

```text
A. Sidebar shell focused comparison
B. 768–1023px Icon Rail vs BottomTabBar
C. Today T1 vs T2
D. Students S1 vs S2
E. Students Split View desktop layout
F. DataPage D1 vs D2 vs D3
G. Month Grid M1 vs M2
H. Light / Dark semantic token direction
I. 每個 variant 的優點、風險與推薦
J. 明確列出仍需使用者裁決的項目
```

不得：

```text
輸出完整程式碼
修改 repo
要求正式資料
假設 Product Feature 已存在
新增 backend / DB / Excel contract
新增 dependency
```

---

# 9. 下一步

```text
NEXT_ACTION:
CLAUDE DESIGN SECOND-ROUND FOCUSED COMPARISON
```

本輪輸出回到中控審查後，才決定：

```text
是否進入 prototype
是否需要 Stitch 局部第二意見
是否建立批准版 DESIGN.md
```
