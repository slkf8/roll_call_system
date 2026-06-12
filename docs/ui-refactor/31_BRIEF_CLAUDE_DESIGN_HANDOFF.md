---
title: "roll_call_system Claude Design 輸入 Brief"
project: "roll_call_system"
document_type: "Claude Design handoff brief"
phase: "PHASE UI-2F-1"
language: "繁體中文"
updated_at: "2026-06-11"
status: "DRAFT_FOR_DESIGN_EXPLORATION"
baseline: "RC11 COMPLETE"
---

# roll_call_system Claude Design 輸入 Brief

## 0. 文件用途

```text
本文件是 Claude Desktop／Claude Design 的 synthetic-only 設計輸入 Brief。
用途是探索視覺方向、layout variants、status semantics 與 responsive 策略。
不是實作提示詞，不是正式 DESIGN.md，不授權修改 repo。
```

本 Brief 的依據文件：

```text
docs/ui-refactor/23_CHARTER_UI_REFACTOR.md
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md
docs/ui-refactor/28_RULES_TASTE_SKILL_ADAPTATION.md
docs/ui-refactor/80_REGISTER_DECISIONS.md
```

---

## 1. Product Context

```text
roll_call_system 是教學與點名管理工具。
主要使用情境是桌面與 iPad。
核心頁面只有四頁：
TodayPage
MonthPage
StudentsPage
DataPage
```

產品要求：

```text
高頻操作
快速掃讀
低誤操作
低 motion
中高資訊密度
synthetic-only
```

---

## 2. Initial Design Calibration

```text
DESIGN_VARIANCE:
3 / 10

MOTION_INTENSITY:
2 / 10

VISUAL_DENSITY:
6 / 10
```

設計方向：

```text
Apple-inspired Productivity Interface
```

限制：

```text
不得過度卡片化
不得過度 Pill 化
不得使用裝飾性 Dot
不得因大量留白犧牲掃讀效率
不得使用 Landing Page composition
不得使用大量動畫
```

---

## 3. Interaction Freeze Summary

摘要引用：

```text
docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md
```

凍結項目（摘要，完整契約以原文件為準）：

```text
Backend API 凍結
DB Schema 凍結
Excel Contract 凍結
Attendance / Absence / Makeup / Extra Lesson 邏輯凍結
Conflict detection logic 凍結
RC11 native date / month overlay 行為凍結
Guarded bulk-remove flow 與 backend health gate 凍結
DataPage row matching、preview / confirm、export、browser fallback 凍結
```

```text
Claude Design 只探索呈現方式，不改變產品行為。
```

---

## 4. Approved Decisions

```text
DECISION-UI-001:
Month Grid conflict marker 與 absent marker 必須明確區分。
必須使用不同 icon、shape 或短文字。
不得只靠顏色。

DECISION-PF-001:
MonthPage batch-generate preview / confirm 已批准為 Separate Product Feature Phase。
不得混入 UI restyle。
Claude Design 可保留未來入口位置，但不得假設該功能已存在。
```

完整決策紀錄見 `docs/ui-refactor/80_REGISTER_DECISIONS.md`。

---

## 5. Confirmed UI Problems

按優先級整理（依據 `10_AUDIT_CURRENT_UI_INVENTORY.md`、`20`/`21` QA 系列與 `25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md`）：

### HIGH

```text
缺乏 semantic design tokens
Dark Mode 依賴大量 isDark ternary
Status semantics 分散
Responsive strategy 分散
Month Grid conflict 與 absent marker 混淆
```

### MEDIUM

```text
StudentsPage 缺少 ThemeToggle
Month nav 約 32×32px
Desktop density 偏低
Empty / Loading / Inline Error 未系統化
Bulk-remove offline 只靠 Toast
Today 與 Month 對 session 的視覺表達分裂
```

### LOW

```text
最小字級偏小
Students Detail Sheet 偏高
DataPage fallback banner 偏弱
Holiday cell affected-count secondary info 不清楚
Today conflict pill cluster 擁擠
```

---

## 6. Open Questions for Claude Design

要求 Claude Design 比較少量差異明確的 variants，不得單方面定案：

```text
1. Desktop 使用 Sidebar，還是保留 BottomTabBar？
2. Narrow viewport 是否保留 BottomTabBar？
3. Students Desktop 使用 Sheet、Detail Page，還是 Split View？
4. Month Grid conflict marker 使用 icon、shape、短文字，還是組合式 marker？
5. Month Grid absent marker 是否保留 dot？
6. Holiday cell 是否顯示 affected-count secondary info？
7. DataPage summary cards 與 table density 如何平衡？
8. Students Detail Sheet 是否應降低高度？
9. OS theme 是否需要自動跟隨？
10. 全站 Status Semantic Model 如何分層？
```

---

## 7. Screenshot Evidence Archive

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
```

```text
共 22 張 synthetic-only baseline screenshots。
screenshots 不提交 repo。
Phase UI-2F-2 只挑選少量代表圖片，複製至 external handoff folder。
```

---

## 8. Initial Screenshot Shortlist

```text
01_TODAY_NORMAL_DESKTOP_LIGHT_01.png
02_TODAY_NORMAL_DESKTOP_DARK_01.png
03_STUDENTS_LIST_DESKTOP_LIGHT_01.png
05_MONTHPAGE_NORMAL_DESKTOP_LIGHT_01.png
07_DATAPAGE_MONTHLY_STATS_DESKTOP_LIGHT_01.png
09_TODAY_NORMAL_IPAD_PORTRAIT_LIGHT_01.png
10_STUDENTS_LIST_NARROW_LIGHT_01.png
11_MONTHPAGE_NORMAL_IPAD_LANDSCAPE_LIGHT_01.png
13_TODAY_ABSENCE_SHEET_DESKTOP_LIGHT_01.png
15_STUDENTS_DETAIL_SHEET_DESKTOP_LIGHT_01.png
18_TODAY_CONFLICT_DESKTOP_LIGHT_01.png
19_MONTHPAGE_HOLIDAY_CLOSURE_DESKTOP_LIGHT_01.png
20_MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT_01.png
21_MONTHPAGE_BULK_REMOVE_BLOCKED_DESKTOP_LIGHT_01.png
22_MONTHPAGE_CONFLICT_IPAD_LANDSCAPE_LIGHT_01.png
```

註明：

```text
20 是現有批量生成 Sheet，不是真正 preview。
21 是 offline guard toast，不是真正 bulk-remove second-confirm sheet。
```

---

## 9. Expected Claude Design Output

要求輸出：

```text
A. 兩至三個 design families
B. 每個 family 的 layout philosophy
C. Desktop navigation 方案
D. Narrow navigation 方案
E. Month Grid marker variants
F. Students detail variants
G. DataPage density variants
H. Light / Dark semantic token 建議
I. Retain / Redesign / Challenge 回應
J. 明確列出不應變更的 interaction contract
```

不得直接輸出：

```text
完整 repo code
backend 修改
新 dependency
Product Feature 實作
正式資料
```

---

## 10. 下一步

```text
下一步：
Phase UI-2F-2
整理 synthetic-only Screenshot Handoff Folder。
```
