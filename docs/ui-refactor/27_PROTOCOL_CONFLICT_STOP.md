---
title: "roll_call_system UI 重構衝突停止協議"
project: "roll_call_system"
document_type: "conflict stop protocol"
phase: "PHASE UI-2D"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構衝突停止協議

## 0. 文件用途

```text
本文件定義 UI 重構期間何時必須 fail closed、停止推進、回報衝突並等待使用者裁決。
```

本協議對所有工具與所有 Phase 生效，配合 `23_CHARTER_UI_REFACTOR.md` §9（停止條件）、`24_CONTRACT_INTERACTION_FREEZE.md` §9 與 `26_MATRIX_TOOL_RESPONSIBILITY.md` §1（權限層級）使用。

---

## 1. 基本原則

```text
有衝突先停止，不猜測。
有風險先回報，不自行修正。
資料安全高於進度。
功能契約高於視覺美感。
批准版 DESIGN.md 高於工具建議。
工具額度不足不是降低驗收標準的理由。
```

---

## 2. 衝突分類

| Conflict Category | Trigger | Stop Code | Required Action | Resume Authority |
|---|---|---|---|---|
| Git baseline mismatch | branch / HEAD / ahead-behind 與交接基準不符 | `STOP_UI_GIT_BASELINE_MISMATCH` | 停止、回報 EXPECTED vs ACTUAL、零寫入 | 使用者 / 中控更新 baseline |
| Worktree deviation | 非預期 staged / unstaged / untracked | `STOP_UI_WORKTREE_DEVIATION` | 停止、列出偏差檔案、不得清理 | 使用者 / 中控更新 allowlist |
| Formal data access required | 任何流程需要讀取 backend/data | `STOP_UI_FORMAL_DATA_ACCESS_REQUIRED` | 立即停止、零查詢 | 使用者明確裁決 |
| Live process contact required | 需操作 live :5173 / :8000 等 | `STOP_UI_LIVE_PROCESS_CONTACT` | 停止、回報 PID / port 觀察 | 使用者 / 中控更新 process baseline |
| API contract change | 設計或實作需改 backend API | `STOP_UI_API_CONTRACT_CHANGE` | 停止、出衝突報告（§6） | 使用者裁決（獨立 Phase） |
| DB schema change | 需改 SQLite schema | `STOP_UI_DB_SCHEMA_CHANGE` | 同上 | 使用者裁決（獨立 Phase） |
| Excel contract change | 需改 Excel mapping / template / export | `STOP_UI_EXCEL_CONTRACT_CHANGE` | 同上 | 使用者裁決（獨立 Phase） |
| Freeze contract conflict | 方案違反 24_CONTRACT 任一凍結項 | `STOP_UI_INTERACTION_CONTRACT_CONFLICT` | 停止、引用契約條目 | 使用者裁決 |
| Unapproved Product Feature | restyle 中混入未批准功能 | `STOP_UI_UNAPPROVED_PRODUCT_FEATURE` | 停止、標記 scope creep | 使用者裁決（拆出獨立 Phase） |
| DESIGN.md conflict | 工具輸出與批准版 DESIGN.md 衝突 | `STOP_UI_DESIGN_CONTRACT_CONFLICT` | 停止、對照差異 | 中控裁決，必要時使用者 |
| Tool output conflict | 兩個工具提出互斥方案 | `STOP_UI_TOOL_OUTPUT_CONFLICT` | 停止當前分支、整理比較表 | 中控裁決，必要時使用者 |
| New dependency required | 任何新 dependency | `STOP_UI_NEW_DEPENDENCY_REQUIRED` | 停止、列出收益與維護成本 | 使用者裁決 |
| Desktop / iPad conflict | 兩端最佳方案互斥 | `STOP_UI_RESPONSIVE_CONFLICT` | 停止、列出取捨 | 中控裁決，必要時使用者 |
| Push / tag / package request | 任何 release 動作請求 | `STOP_UI_RELEASE_ACTION_REQUESTED` | 停止、等待集中決策（UI-4） | 使用者明確裁決 |
| Real data visible in browser | QA / capture 畫面出現疑似真實資料 | `STOP_UI_REAL_DATA_VISIBLE` | 立即停止、不保存畫面、回報來源 | 使用者裁決 |
| Dirty browser profile | profile 帶既有 attendance_v1_data | `STOP_UI_DIRTY_BROWSER_PROFILE` | 停止、銷毀 profile、換 fresh profile 重來 | 中控確認後重試 |

---

## 3. 衝突嚴重程度

```text
BLOCKER:
不能繼續，必須使用者裁決。

HIGH:
可能破壞功能、安全或正式資料；必須停止。

MEDIUM:
有多個合理方案；停止當前分支，先比較。

LOW:
可記錄，不阻塞，但不得默認忽略。
```

對應慣例：Formal data / real data / release action / contract change 類一律 BLOCKER 或 HIGH；tool output / responsive 類通常 MEDIUM；§5 所列情況為 LOW。

---

## 4. 必須停止的典型情況

```text
branch / HEAD / ahead-behind 不符
unexpected staged / unstaged / untracked
需要讀取 backend/data
需要使用正式 DB
需要使用真實學生資料
需要開啟正式 Excel 模板
需要操作 live :5173 / :8000
設計工具要求完整 repo
設計建議改變 API
設計建議改變 DB schema
設計建議改變 Excel mapping
設計建議移除 backend health gate
UI restyle 混入 MonthPage batch preview / confirm
工具輸出互相衝突
Desktop 與 iPad 最佳方案互斥
需要新增 dependency
要求 push / tag / package
```

---

## 5. 不必停止但要記錄的情況

```text
小型字級不一致
低風險 icon 重複
Vite boilerplate
低風險 spacing drift
可延後補拍的 screenshot
工具額度不足但已有合格備援
```

記錄位置：當輪最終回報 + 必要時寫入對應 QA / REGISTER 文件。

---

## 6. 固定衝突回報格式

```text
CONFLICT_ID:
...

SEVERITY:
BLOCKER / HIGH / MEDIUM / LOW

PHASE:
...

CURRENT_CONTRACT:
...

OBSERVED:
...

PROPOSAL:
...

BENEFIT:
...

RISK:
...

OPTIONS:
A.
B.
C.

RECOMMENDATION:
...

REQUIRED_DECISION:
...

WRITE_ACTION_EXECUTED:
yes / no

FORMAL_DATA_ACCESSED:
yes / no

LIVE_PROCESS_TOUCHED:
yes / no
```

---

## 7. 恢復執行規則

```text
只有以下情況才可恢復：
- 使用者明確裁決
- 中控更新 allowlist
- 中控更新 baseline
- 中控更新 Phase scope
- 中控拆出 Separate Product Feature Phase
```

不得：

```text
由執行工具自行推斷
由執行工具自行忽略
因為偏差看似 benign 就繼續
```

---

## 8. 已知案例

以下案例來自 Phase UI-1A 至 UI-2A 的實際執行，作為協議的先例依據。

### Case A：UI-1A untracked docs

```text
docs/ui-refactor/
出現有意加入文件
→ Claude 正確停止
→ 中控更新 allowlist
→ 恢復執行
```

### Case B：`:8000` listener 消失

```text
原 live backend 停止
→ 不自行重啟
→ 中控更新 process baseline
```

### Case C：backend/data tracked-file count

```text
count-only query 仍超出 only test -d 規則
→ 收緊 Formal Data Zone
→ 改為 frontend-only git archive
```

### Case D：capture frontend 被外部回收

```text
跨輪 background process 不可靠
→ 改為 same-round start → audit → cleanup
```

### Case E：MonthPage batch generate preview 假設錯誤

```text
文件假設有 dry-run preview
實際 direct execute
→ STOP_FOR_PRODUCT_DECISION
→ 使用者批准 Separate Product Feature Phase
```

共通教訓：每一次停止都比自行繼續便宜；基準偏差由中控更新規則後恢復，而不是由執行工具現場解釋。

---

## 9. Conflict Register

```text
重大衝突與裁決同步記錄至：
docs/ui-refactor/81_REGISTER_CONFLICTS.md
```

本輪：

```text
只記錄規則
不建立 81_REGISTER_CONFLICTS.md
```

（81 於第一筆重大衝突發生時建立；§8 已知案例屆時一併補錄。）

---

## 10. 下一步

```text
下一步：
Phase UI-2E
Taste Skill Adaptation
+
Project-specific UI Skill Spec
```
