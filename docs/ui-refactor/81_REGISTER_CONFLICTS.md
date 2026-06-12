---
title: "roll_call_system UI 重構衝突紀錄"
project: "roll_call_system"
document_type: "UI refactor conflict register"
phase: "PHASE UI-2G"
language: "繁體中文"
updated_at: "2026-06-11"
status: "ACTIVE"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構衝突紀錄

## 0. 文件用途

本文件記錄 UI 重構期間發生的重大衝突、停止事件與最終裁決。

用途：

```text
保存衝突的完整證據鏈（觀察 → 停止 → 審計 → 裁決 → 解除）
避免相同衝突在後續 Phase 重複發生
為 27_PROTOCOL_CONFLICT_STOP.md 的停止協議提供案例紀錄
為接手者提供裁決先例
```

配合使用：

```text
docs/ui-refactor/27_PROTOCOL_CONFLICT_STOP.md（停止協議與衝突分類）
docs/ui-refactor/80_REGISTER_DECISIONS.md（已批准決策）
```

依 27 號文件 §9：本 register 於第一筆重大衝突發生時建立；本輪（Phase UI-2G）即為建檔輪。

---

## 1. 使用規則

```text
後續新增重大衝突，必須追加至本文件。
不得覆蓋舊紀錄。
不得刪除已 RESOLVED 的條目。
每筆衝突使用遞增 CONFLICT_ID（CONFLICT-UI-002、CONFLICT-UI-003 …）。
回報欄位遵循 27 號文件 §6 固定格式。
SEVERITY 遵循 27 號文件 §3（BLOCKER / HIGH / MEDIUM / LOW）。
衝突解除只能依 27 號文件 §7 的 Resume 規則。
```

---

## 2. Conflict Summary Table

| Conflict ID | 主題 | Severity | Phase | 狀態 |
|---|---|---|---|---|
| `CONFLICT-UI-001` | StudentsPage Board 3 Contract Drift | HIGH | PHASE UI-2F-3 | RESOLVED |

先例補錄（發生於本 register 建檔前，詳見 27 號文件 §8；僅索引，不展開）：

| Case | 主題 | 處置 |
|---|---|---|
| Case A | UI-1A untracked docs | 中控更新 allowlist 後恢復 |
| Case B | `:8000` listener 消失 | 不自行重啟；中控更新 process baseline |
| Case C | backend/data tracked-file count 查詢越界 | 收緊 Formal Data Zone 至 only `test -d` |
| Case D | capture frontend 被外部回收 | 改為 same-round start → audit → cleanup |
| Case E | MonthPage batch preview 假設錯誤 | STOP_FOR_PRODUCT_DECISION → DECISION-PF-001 |

---

## 3. CONFLICT-UI-001 — StudentsPage Board 3 Contract Drift

```text
CONFLICT_ID:
CONFLICT-UI-001

SEVERITY:
HIGH

PHASE:
PHASE UI-2F-3

CATEGORY:
STOP_UI_INTERACTION_CONTRACT_CONFLICT
+
STOP_UI_UNAPPROVED_PRODUCT_FEATURE

OBSERVED:
Claude Design Board 3 混入未確認欄位、label drift、未存在操作與互動狀態。

UNVERIFIED FIELDS REMOVED:
電話
時薪
開始日期
備註

LABEL DRIFT RESTORED:
進行中 → 啟用中
已停 → 已停用
新增時段 → 新增固定課表
移除 → 刪除

UNAPPROVED ACTION REMOVED:
刪除學生

UNAPPROVED INTERACTION STATES REMOVED:
View State
獨立 Edit State
dirty state
未儲存提醒
inline editing
sticky dirty bar

SOURCE AUDIT:
PHASE UI-2F-3C-1
PASS_STUDENTSPAGE_EXISTING_CONTRACT_SOURCE_AUDIT

RESOLUTION:
建立 35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md
修正 Claude Design Board 3
正式 UI restyle 保留 editable IOSSheet contract
Desktop Split View 降級為 DEFERRED / SEPARATE INTERACTION DECISION

WRITE_ACTION_EXECUTED_DURING_SOURCE_AUDIT:
no

FORMAL_DATA_ACCESSED:
no

LIVE_PROCESS_TOUCHED:
no

STATUS:
RESOLVED
```

補充說明：

```text
裁決落點：
- 權威契約：docs/ui-refactor/35_QA_STUDENTSPAGE_BOARD3_CONTRACT_RECONCILIATION.md
- 設計契約：docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §7
- 決策登記：DECISION-UI-006（80_REGISTER_DECISIONS.md）

教訓：
設計探索輸出在進入批准版契約前，必須先經 strictly read-only source audit 對齊現行 contract；
任何未在 source 驗證的欄位、label、操作或互動狀態，一律視為 drift，不得寫入批准版文件。
```

---

## 4. Resume Rule

```text
衝突解除（RESOLVED）只能來自：
- 使用者明確裁決
- 中控更新 allowlist / baseline / Phase scope
- 中控拆出 Separate Product Feature Phase 或 Separate Interaction Decision

不得：
- 由執行工具自行推斷解除
- 由執行工具自行忽略
- 因偏差看似 benign 就繼續

每筆 RESOLVED 條目必須記錄裁決依據（對應 DECISION ID 或使用者指令輪次）。
後續新增重大衝突，必須追加至本文件；不得覆蓋舊紀錄。
```
