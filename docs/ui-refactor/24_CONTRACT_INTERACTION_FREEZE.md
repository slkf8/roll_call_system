---
title: "roll_call_system UI 重構互動契約凍結"
project: "roll_call_system"
document_type: "interaction contract freeze"
phase: "PHASE UI-2C"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構互動契約凍結

## 0. 文件用途

```text
本文件固定 UI restyle 期間不得被默認改變的產品互動契約。
視覺表達可以重設計，但行為、資料流程與安全 gate 不得因換 UI 而被改變。
```

契約依據：`10_AUDIT_CURRENT_UI_INVENTORY.md`（現況盤點）、`20`/`21` QA 系列（browser 實證）、`23_CHARTER_UI_REFACTOR.md`（凍結範圍）與 `80_REGISTER_DECISIONS.md`（已批准決策）。

---

## 1. 契約分類

```text
FREEZE:
UI restyle 中不得改變。

VISUAL_REDESIGN_ALLOWED:
行為凍結，但視覺表達可重設計。

SEPARATE_PRODUCT_FEATURE_PHASE:
已批准方向，但不得混入 UI restyle。
```

---

## 2. 全域互動契約

| Contract | Category | Freeze Rule |
|---|---|---|
| 四個 tab：today / month / students / data | FREEZE | 頁面資訊架構可比較（Sidebar / BottomTabBar 等），但功能入口不得遺失 |
| Theme persistence | FREEZE | `rollcall-theme` 行為不得默認刪除 |
| Local persistence | FREEZE | `attendance_v1_data`（versioned、restore 時 normalize）行為不得默認改變 |
| Backend fallback | FREEZE | backend unavailable 時既有 per-resource fallback（students / rules / sessions / globalEvents 各自獨立降級至本地資料）不得默認改變 |
| RC11 native date overlay | FREEZE | iPad-compatible overlay（透明 input 覆蓋 + showPicker enhancement）行為不得重寫 |
| Toast | VISUAL_REDESIGN_ALLOWED | 樣式可改，但不得成為唯一錯誤渠道 |
| Sheet / Dialog | VISUAL_REDESIGN_ALLOWED | 視覺可改，危險操作 gate 不得移除 |

---

## 3. TodayPage 契約

凍結的互動能力（入口與業務結果不得遺失或默認改變）：

```text
日期切換（上一天 / 下一天 / 日期選擇）
Native Date Overlay
今日課堂顯示（含排程摘要：今日排程 / 已到 / 缺席 / 未定）
出席操作（記錄已到 / 記錄缺席）
缺席原因（preset reasons + 備註）
教材相關欄位（教材 chip + 申報原因 1–6 + reason-6 學年上限）
補課（安排補課，補回本堂，含原課關聯）
額外加課（不抵扣缺席）
停課（標記停課 / 取消停課）
假期（設定全局事件：停課 / 假期、全日 / 指定時段、停課原因）
衝突偵測（checkOverlap，同日時段重疊）
非阻斷 conflict warning（card 層 ⚠ + 文字 pill）
刪除確認（刪除課次？danger sheet，含補課關聯解除提示）
Toast
Undo（撤銷已記錄狀態，回到待確認）
```

要求：

```text
SessionCard 可以重設計
互動步驟可於設計階段比較
但業務結果、狀態語義與 safety gate 不得默認改變
```

---

## 4. StudentsPage 契約

凍結的互動能力：

```text
學生列表（含狀態統計卡：全部 / 啟用中 / 已設定停用 / 已停用）
搜尋（姓名 / 生日 / 學校 / ID）
篩選（狀態 SegmentedControl）
學生新增
學生編輯（學生資料 sheet：姓名 / 生日 / 學校 / ID / 狀態）
學生狀態（active / scheduled_deactivation / inactive；立即停用 / 指定日期停用）
固定課表 CRUD（展開 / 新增固定課表 / 編輯 / 啟用狀態）
常規課堂生成（依固定課表生成 regular 課次的能力）
Student Detail Sheet
```

註明：

```text
Student Detail Sheet 可於 Claude Design 階段比較：
Sheet
Detail Page
Desktop Split View

但資料欄位與 CRUD 能力不得遺失。
```

---

## 5. MonthPage 契約

凍結的互動能力：

```text
月份切換（上一個月 / 下一個月 / 回到本月）
RC11 native month overlay
Calendar Grid（週日起始、日格課次摘要）
課堂分佈（出席比 n/m、pending / absent 計數）
假期（全日事件於日格顯示文字標記）
停課（含停課原因）
補課
額外加課
衝突偵測（同日重疊 → 日格 marker + 日內 conflict 摘要）
批量生成固定課次（現行為 direct execution；local 模式直接寫入州）
Guarded bulk-remove（批量移除日期內課次）
Backend health gate（入口 fresh GET /health 探測，offline fail-closed）
Authoritative remove preview（dryRun=true 權威預覽）
第二層危險確認（確認移除課次？紅色 danger sheet）
```

已批准決策（原文引用）：

```text
DECISION-UI-001:
Month Grid conflict marker 與 absent marker 必須明確區分。
不得只靠顏色。
具體 marker 樣式留待 Claude Design 比較。
```

```text
DECISION-PF-001:
MonthPage 批量生成 preview / confirm 已批准新增，
但屬於 Separate Product Feature Phase。

UI restyle 期間：
不得順手實作。
不得默認改 backend。
不得默認改 API。
不得把現有 direct-execute 行為錯寫成已存在 preview。
```

---

## 6. DataPage 契約

凍結的互動能力：

```text
月份切換（上一個月 / 回到本月 / 下一個月 + native month overlay）
教師服務範圍（range 統計 + 起訖日期選擇）
統計（月度統計：出席 / 缺席 / 未完成點名 / 課次總數 / 每學生明細）
Sticky Header（學生明細表）
模板上傳（選擇 xlsx 模板 → 工作表選擇）
欄位 gate（欄位辨識 + 確認 selects）
Row Matching（姓名 + 生日 匹配 key）
Preview / Confirm（填入前預覽與確認）
Backend-primary export（後端優先填表）
Browser fallback（xlsx-populate 本地備援）
Fallback banner（統計資料暫時無法從後端載入，已使用本地資料）
School-year override（原因 6 統計學年 + 調整）
```

凍結：

```text
Excel mapping
Template contract
Row matching key
Export endpoint
Backend-primary strategy
Fallback strategy
```

允許：

```text
Toolbar layout
Banner 呈現
Table visual density
Summary card 數量
Responsive layout
```

---

## 7. 正式資料與 Evidence 契約

```text
backend/data/
=
OPAQUE_PROTECTED_FORMAL_DATA_ZONE

常規操作只允許：
test -d backend/data

所有 UI audit、prototype、screenshot、Browser QA：
synthetic data only
```

Evidence 一律存於 `<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/`（不入 repo），命名依 `05_RULES_DOCUMENT_NAMING.md` §9。

---

## 8. Product Feature 隔離清單

| Feature | Status | Rule |
|---|---|---|
| MonthPage batch-generate preview / confirm | APPROVED FOR SEPARATE PHASE | 不得混入 UI restyle |
| Preview 顯示日期範圍 | REQUIRED | Separate Product Feature Phase |
| Preview 顯示學生數 | REQUIRED | Separate Product Feature Phase |
| Preview 顯示新增數 | REQUIRED | Separate Product Feature Phase |
| Preview 顯示跳過數 | REQUIRED | Separate Product Feature Phase |
| Preview 顯示衝突數 | REQUIRED | Separate Product Feature Phase |

---

## 9. 停止條件

如任何設計或實作方案：

```text
改變 API
改變 DB schema
改變 Excel contract
改變正式資料流程
移除 safety gate
改變 backend health gate
把 Separate Product Feature 偷渡進 UI restyle
要求真實資料
```

必須停止並回報：

```text
STOP_UI_CONTRACT_CONFLICT
```

並依 `23_CHARTER_UI_REFACTOR.md` §9 記錄衝突等待裁決。

---

## 10. 下一步

```text
下一步：
建立 Retain / Redesign / Challenge Matrix。
```
