---
title: "roll_call_system StudentsPage Board 3 契約對齊驗收"
project: "roll_call_system"
document_type: "StudentsPage Board 3 contract reconciliation QA"
phase: "PHASE UI-2F-4"
language: "繁體中文"
updated_at: "2026-06-11"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
---

# roll_call_system StudentsPage Board 3 契約對齊驗收

## 0. 文件用途

本文件記錄 Claude Design Board 3（StudentsPage）與現行 frontend source contract 的對齊驗收結果。

用途：

```text
固定 StudentsPage 的權威欄位、狀態與操作清單
移除 Board 3 中未經驗證的欄位與操作
防止設計漂移被誤當成現有契約
為 36_SPEC_UI_DESIGN_APPROVED.md 的 StudentsPage 章節提供依據
```

依據：

```text
Phase UI-2F-3C-1
StudentsPage Existing Contract Source Audit
（strictly read-only，基準 HEAD cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9）
```

---

## 1. Source Audit 範圍

Phase UI-2F-3C-1 實際讀取（全部唯讀）：

```text
frontend/src/pages/StudentsPage.tsx（全文）
frontend/src/shared/appShared.tsx（StudentProfile / StudentScheduleRule type、IOSSheet、FieldRow）
frontend/src/api/studentsApi.ts（全文）
```

未讀取：

```text
backend/data/
release/
test_artifacts/
```

補充驗證：

```text
全 frontend/src grep「88vh」：0 筆
studentsApi.ts 只有 fetchStudents / createStudent / updateStudent，無 delete
```

---

## 2. Board 3 原始 Drift

Board 3 出現以下未經 source 驗證的內容：

```text
欄位漂移：
電話 / 時薪 / 開始日期 / 備註（皆不存在於 StudentProfile 與 API payload）

狀態漂移：
進行中 / 已停（現行狀態為 啟用中 / 已設定停用 / 已停用 三態）

操作漂移：
刪除學生（UI 與 API client 皆無）
單一「停用學生」（現行為 立即停用 + 指定日期停用 兩個獨立操作）
新增時段（現行 label 為 新增固定課表）
移除（現行 label 為 刪除，且必有確認 sheet）

互動漂移：
View State / Edit State 切換（現行 Sheet 開啟即可編輯，無唯讀檢視狀態）
dirty state / 未儲存提醒（現行無 dirty 偵測，取消與 backdrop 點擊直接丟棄）
Sticky Save / Cancel footer（現行 Save / Cancel 位於 Sheet header）
88vh Sheet fallback 被描述為現況（現行 IOSSheet 無任何高度限制與 internal scroll）
```

---

## 3. 權威 Student 欄位

`StudentProfile`（appShared.tsx）+ `CreateStudentPayload` / `UpdateStudentPayload`（studentsApi.ts）為全部欄位：

| field key | 顯示 label | 可編輯 | 出現位置 |
|---|---|---|---|
| `id` | ID | 否（readonly，「建立後自動產生」） | 列表卡片、Detail Sheet、搜尋 |
| `name` | 姓名 | 是（必填；duplicate 比對鍵） | 卡片標題、Detail Sheet、確認 Sheet |
| `birthday` | 生日 | 是（必填，`type="date"`；duplicate 比對鍵） | 卡片副行、Detail Sheet、確認 Sheet |
| `school` | 學校 | 是（選填） | 卡片副行、Detail Sheet |
| `status` | 狀態 | 否（readonly；僅經狀態管理操作 + 確認 Sheet 變更） | badge、篩選、summary、Detail Sheet |
| `deactivateMode` | （無獨立 label） | 間接（隨狀態操作寫入 immediate / scheduled） | 僅 payload |
| `deactivateOn` | 停用日期 | 經「指定日期停用 / 修改停用日期」confirm sheet | 卡片描述行、Detail Sheet |

逐項核對結果：

```text
電話        EXISTS_IN_CURRENT_SOURCE: no
時薪        EXISTS_IN_CURRENT_SOURCE: no
開始日期    EXISTS_IN_CURRENT_SOURCE: no
備註        EXISTS_IN_CURRENT_SOURCE: no（note 屬 Session，不屬 Student）
```

---

## 4. 權威 Student Status Taxonomy

Status union 只有三值：

| status key | 顯示 label | 篩選入口 | 狀態轉換 |
|---|---|---|---|
| `active` | 啟用中 | SegmentedControl + summary card | → inactive（立即停用）/ → scheduled_deactivation（指定日期停用） |
| `scheduled_deactivation` | 已設定停用 | SegmentedControl + summary card | → active（取消停用設定）/ → inactive（立即停用）/ 自身（修改停用日期） |
| `inactive` | 已停用 | SegmentedControl + summary card | → active（恢復學生） |

另有篩選「全部」。固定課表規則為獨立二態：`isActive` →「啟用中 / 已停用」。

```text
進行中    EXISTS_IN_CURRENT_SOURCE: no
已停      EXISTS_IN_CURRENT_SOURCE: no
```

---

## 5. 權威 Student Actions

| 操作 | 入口 | 確認 gate | 條件限制 |
|---|---|---|---|
| 新增學生 | Header / 空狀態按鈕 → IOSSheet | 必填 toast gate + 「重覆提醒」duplicate sheet | — |
| 編輯學生（查看 / 編輯資料） | 點卡片 / ⋯ menu → 同一 Sheet | 同上；儲存後同步課次學生姓名 | — |
| 立即停用 | ⋯ menu（danger）+ Detail Sheet | 確認 Sheet + 受影響未來課次數 | active / scheduled_deactivation |
| 指定日期停用 | ⋯ menu + Detail Sheet | 確認 Sheet + 日期驗證（必填、不可早於今天） | active |
| 修改停用日期 | ⋯ menu + Detail Sheet | 同一 confirm sheet（預填 deactivateOn） | scheduled_deactivation |
| 取消停用設定 | ⋯ menu + Detail Sheet | 無確認 sheet，直接執行 + toast | scheduled_deactivation |
| 恢復學生 | ⋯ menu + Detail Sheet | 確認 Sheet | inactive |
| 刪除學生 | **不存在** | — | — |

---

## 6. Fixed Schedule Contract

```text
顯示欄位：
週X / 開始時間 HH:MM / 時長（分鐘）/ 啟用中｜已停用 badge
區塊標題「固定課表」+「共 N 條規則」（可展開收起，in-memory 不持久化）

新增流程：
「新增固定課表」→ IOSSheet（星期 / 開始時間 / 時長 / 狀態 readonly）→ 儲存
驗證：start 非空且 durationMin > 0

編輯流程：
「編輯」→ 同一 Sheet；「停用 / 恢復」toggle 直接執行無確認

刪除流程：
「刪除」→ 確認 Sheet「刪除固定課表規則」（顯示星期 / 時間 / 時長，確認刪除 danger）

生成課堂流程（皆直接執行 + toast，無確認 sheet）：
生成本月 regular 課次
清除本月 regular
重新生成本月 regular
限制：學生須 active、有 isActive 規則、有月份資訊
```

---

## 7. 修正版 Board 3 驗收

### 7.1 移除（UNVERIFIED / DRIFT）

```text
移除：
電話
時薪
開始日期
備註
刪除學生
進行中
已停
單一「停用學生」
新增時段
移除
View State
dirty state
未儲存提醒
inline editing
sticky dirty bar
```

### 7.2 保留（EXISTING CONTRACT）

```text
保留：
ID
姓名
生日
學校
狀態
停用日期

啟用中
已設定停用
已停用

立即停用
指定日期停用
修改停用日期
取消停用設定
恢復學生

新增固定課表
編輯
停用 / 恢復
刪除
生成本月 regular 課次
清除本月 regular
重新生成本月 regular
```

另保留：搜尋（姓名 / 生日 / 學校 / ID）、四段狀態篩選、「重覆提醒」duplicate sheet、各狀態變更確認 sheet 與受影響課次數顯示。

---

## 8. StudentsPage 正式 UI-restyle 邊界

正式裁決：

```text
StudentsPage UI restyle:
Desktop / iPad / Narrow 均保留 editable IOSSheet contract

88vh + internal scroll:
APPROVED_VISUAL_PROPOSAL
（Sheet height = min(content, 88vh)，非現況描述）

Desktop Split View:
DEFERRED
SEPARATE INTERACTION DECISION
```

允許的視覺改善（不改互動契約）：

```text
Sheet height = min(content, 88vh) + internal scroll
危險操作區分組
Save / Cancel 位置與樣式調整（label 與行為不變）
帶 count 的 SegmentedControl（C2）
```

不得新增：

```text
View State / Edit State 切換
dirty state / 未儲存提醒
Split View
刪除學生
任何新欄位
```

---

## 9. Split View DEFER 規則

`34_QA_CLAUDE_DESIGN_SECOND_ROUND_VISUAL_REVIEW.md` 曾將 Desktop Split View（C3，38/62）列為 PRIMARY DIRECTION，但其 §4.3 同時確認 Split View 必須先解決 View / Edit State 問題——而 View / Edit State 屬互動流程變更，超出本輪 UI restyle 範圍。

因此正式裁決：

```text
Desktop Split View:
DEFERRED

分類:
SEPARATE INTERACTION DECISION

規則:
不得在 Phase UI-3 UI restyle 中實作 Split View
不得在 restyle 中引入 View State / Edit State / dirty state
Split View 連同 ST1 / ST2 比較，留待獨立 Interaction Decision Phase
該 Phase 需獨立驗收、獨立 commit
本決議取代 34 號文件中 Split View 作為 desktop 主方向的暫定判斷
```

---

## 10. 結論

```text
RECONCILIATION_STATUS:
COMPLETE

BOARD3_UNVERIFIED_ITEMS_REMOVED:
yes

EXISTING_CONTRACT_RESTORED:
yes

STUDENTSPAGE_RESTYLE_CONTRACT:
editable IOSSheet（全 viewport）
+
APPROVED_VISUAL_PROPOSAL: 88vh + internal scroll

SPLIT_VIEW:
DEFERRED（Separate Interaction Decision）

下一步：
本文件作為 36_SPEC_UI_DESIGN_APPROVED.md §7 StudentsPage 章節的權威依據。
```
