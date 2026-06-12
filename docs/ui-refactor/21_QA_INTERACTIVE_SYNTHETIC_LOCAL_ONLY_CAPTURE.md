---
title: "roll_call_system Phase UI-1B-2C Interactive Synthetic Local-only Capture"
project: "roll_call_system"
document_type: "UI interactive baseline audit"
phase: "PHASE UI-1B-2C"
language: "繁體中文"
updated_at: "2026-06-10"
status: "COMPLETE_WITH_DESIGN_CONTRACT_CONFLICTS"
baseline: "RC11 COMPLETE"
source_report: "Claude Phase UI-1B-2C Interactive Synthetic Local-only Capture and Cleanup"
next_phase: "STOP_FOR_PRODUCT_DECISION"
---

# roll_call_system Phase UI-1B-2C Interactive Synthetic Local-only Capture

## 0. 文件用途

本文件記錄 `Phase UI-1B-2C Interactive Synthetic Local-only Capture` 的正式結果，並整理本輪發現的設計契約衝突。

本輪目標：

```text
重啟既有 frontend-only throwaway lane
        ↓
以 fresh temporary browser profiles
        ↓
只透過 UI 建立 synthetic localStorage 狀態
        ↓
補拍互動型 baseline screenshots
        ↓
Same-round precise cleanup
```

建議保存於：

```text
docs/ui-refactor/21_QA_INTERACTIVE_SYNTHETIC_LOCAL_ONLY_CAPTURE.md
```

---

# 1. Phase 結論

```text
PHASE_UI_1B2C_STATUS:
PASS_INTERACTIVE_SYNTHETIC_LOCAL_ONLY_CAPTURE_AND_CLEANUP
```

附帶一項已記錄偏差：

```text
Scenario D:
MonthPage bulk-remove second-confirm sheet
無法在 seed-fallback mode 進入
```

原因：

```text
MonthPage 在進入 bulk-remove flow 前
會對 GET /health 執行 backend health probe

dead :8211
→ fail closed
→ 顯示 offline guard toast
→ second-confirm sheet 不可達
```

本輪以：

```text
21_MONTHPAGE_BULK_REMOVE_BLOCKED_DESKTOP_LIGHT_01.png
```

替代第二層確認畫面。

---

# 2. Short Restart Safety Gate

| Check | Result |
|---|---|
| lane path | `<TMP_UI1B_CAPTURE_LANE>` 存在 |
| node_modules | symlink intact |
| branch | `main` |
| HEAD | `cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9` |
| ahead / behind | `0 / 0` |
| diff checks | clean |
| untracked docs | 4 allowlisted files only |
| `backend/data` | 只使用 `test -d` |
| `:5173` | live Vite PID `41123` 保留 |
| `:5199` | restart 前 free |
| `:8211` | dead API target，free |
| `:8000` | triple probe `3 / 3` no listener |

---

# 3. Restart PID Gate

```text
FRONTEND_PID:
66479

PARENT_NPM_PID:
66384

FRONTEND_CWD:
<TMP_UI1B_CAPTURE_LANE>/frontend

FRONTEND_LISTENER:
127.0.0.1:5199

HTTP_PROBE:
200 OK

VITE_API_BASE_URL:
http://127.0.0.1:8211

:8211:
connection refused

BACKEND:
not started
```

---

# 4. Browser Profile Gate

本輪使用：

```text
5 scenarios
×
5 fresh mktemp profiles
```

每個 profile：

```text
初始為空
只寫入 synthetic localStorage
沒有正式資料
完成後刪除
```

已確認：

```text
localStorage keys:
rollcall-theme
attendance_v1_data

students:
exactly 6 synthetic seed names
```

沒有殘留 Chrome process。

---

# 5. Scenario Results

| Scenario | Result | Network | Screenshot |
|---|---|---|---|
| A. Today conflict | PASS — 透過 FAB 新增 14:30–15:30 synthetic extra lesson；3 張卡片出現 `⚠ 衝突` | only `:5199` + dead `:8211` | `18_TODAY_CONFLICT_DESKTOP_LIGHT_01.png` |
| B. Month holiday | PASS — 透過 UI 新增 6/10 全日假期；月份 grid 顯示文字 `假期` | clean | `19_MONTHPAGE_HOLIDAY_CLOSURE_DESKTOP_LIGHT_01.png` |
| C. Month batch preview | PASS WITH CONTRACT FINDING — 透過 UI 新增固定課表後開啟批量生成 Sheet；沒有真正 dry-run preview | clean | `20_MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT_01.png` |
| D. Bulk-remove second confirm | SUBSTITUTE CAPTURE — seed-fallback 下被 backend health probe fail-closed 阻擋；拍攝 guard toast | clean | `21_MONTHPAGE_BULK_REMOVE_BLOCKED_DESKTOP_LIGHT_01.png` |
| E. Month conflict iPad landscape | PASS — 月份 grid 顯示 conflict dot；1180×820 無 overflow | clean | `22_MONTHPAGE_CONFLICT_IPAD_LANDSCAPE_LIGHT_01.png` |

全局 Network Gate：

```text
REQUEST_TO_8000:
no

ALLOWED:
:5199
dead :8211
```

---

# 6. Screenshot Manifest

本輪新增：

```text
5 screenshots
```

Evidence Archive 現有總數：

```text
22 screenshots
```

保存於：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
```

本輪資料夾：

```text
screenshots/interactive-local-only/
```

---

# 7. UI Audit Findings

## 7.1 HIGH：Month Grid conflict 與 absent 共用近似紅點語義

```text
FINDING_ID:
UIB2C-01

SEVERITY:
HIGH
```

月份 grid 中：

```text
conflict
=
bare red corner dot

absent
=
近似 red dot
```

問題：

```text
相同顏色
相近形狀
不同語義
沒有文字
沒有 icon
```

這違反：

```text
狀態不得只靠顏色辨認
```

Card-level conflict pill 的表達較合理：

```text
⚠
+
衝突文字
```

中控建議：

> 後續 UI Design System 必須為 Month Grid 建立 distinct semantic markers，不得讓 conflict 與 absent 共用同一種 red-dot 視覺語法。

---

## 7.2 MEDIUM：Batch generate 沒有真正 dry-run preview

```text
FINDING_ID:
UIB2C-05

SEVERITY:
MEDIUM
```

原先規劃文件曾假設：

```text
MonthPage batch generate
→ dry-run preview
→ confirm
```

但實際 UI 行為是：

```text
開啟批量生成 Sheet
→ 按下批量生成
→ 直接執行
```

因此：

```text
真正 dry-run preview:
NOT FOUND
```

這不是單純視覺問題，而是：

```text
PRODUCT INTERACTION CONTRACT QUESTION
```

必須停止並由使用者決定：

```text
A. 保留現有直接執行
B. 後續新增 preview / confirm
```

不得在 UI refactor 中默認新增。

---

## 7.3 MEDIUM：Bulk-remove offline 只以 Toast 表達

```text
FINDING_ID:
UIB2C-02

SEVERITY:
MEDIUM
```

Seed-fallback 下，bulk-remove flow 因 backend health probe fail closed。

目前表達：

```text
6 秒 Toast
```

問題：

```text
menu entry 未預先 disabled
沒有 inline explanation
Toast 是唯一提示
```

中控建議：

> 後續 UI 重構可改善 offline affordance，但不得改變 fail-closed 業務規則。

---

## 7.4 LOW：Holiday cell suppresses affected count

```text
FINDING_ID:
UIB2C-04

SEVERITY:
LOW
```

月份 grid 中，全日假期會顯示：

```text
假期
```

但可能不再清楚顯示：

```text
當日受影響課堂數
```

需於 Claude Design 階段評估：

```text
是否保留 affected-count secondary info
```

---

## 7.5 LOW：Card conflict pill cluster 擁擠

```text
FINDING_ID:
UIB2C-06

SEVERITY:
LOW
```

TodayPage card 右側同時出現多個狀態時：

```text
conflict
status
kind
```

會形成擁擠。

窄螢幕可能 wrap。

---

# 8. Responsive / Accessibility Findings

## 8.1 Responsive

```text
horizontal overflow:
none
```

iPad landscape：

```text
viewport:
1180 × 820

MonthPage:
usable
```

## 8.2 Accessibility

最重要問題：

```text
Month Grid:
conflict vs absent red-dot polysemy
```

touch target 問題仍然保留：

```text
Month nav controls:
約 32 × 32px
```

---

# 9. Same-round Cleanup

停止：

```text
frontend vite PID:
66479

parent npm PID:
66384
```

只使用精準 PID cleanup。

沒有使用：

```text
killall
pkill
pattern kill
```

cleanup 後：

| Port | Final State |
|---|---|
| `:5173` | live Vite PID `41123` 保留 |
| `:8000` | no listener |
| `:5199` | no listener |
| `:8211` | no listener |

已刪除：

```text
<TMP_UI1B_CAPTURE_LANE>
5 個 browser profiles
scratch files
archive __pycache__
```

保留：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B2_SeedFallbackCapture_2026-06-10_37af56/
```

---

# 10. Changed Files Gate

```text
SCREENSHOTS_CAPTURED:
yes
5 new screenshots
22 total baseline screenshots

SOURCE_MODIFIED:
no

DOCS_MODIFIED:
no

DEPENDENCY_MODIFIED:
no

TEMP_SYNTHETIC_LOCALSTORAGE_MODIFIED:
yes
fresh profiles only

BUSINESS_DATA_MODIFIED:
no

BACKEND_STARTED:
no

FORMAL_DATA_ZONE_QUERY:
only test -d

FORMAL_DATA_CONTENT_ACCESSED:
no

LIVE_PROCESS_TOUCHED:
no

REQUEST_TO_8000:
no

CAPTURE_FRONTEND_STOPPED:
yes
exact PIDs only

TEMP_BROWSER_PROFILES_REMOVED:
yes

LANE_REMOVED:
yes

EVIDENCE_ARCHIVE_RETAINED:
yes

COMMIT_CREATED:
no

PUSH_EXECUTED:
no

TAG_CREATED:
no

PACKAGE_EXECUTED:
no
```

---

# 11. 中控裁決

## 11.1 Baseline capture 已足夠支持第一輪 UI Audit 收口

目前 evidence 已覆蓋：

```text
四頁正常狀態
Light / Dark
Desktop
iPad Portrait
iPad Landscape
Narrow
Today absence sheet
Today menu
Students detail
Students fixed schedule
DataPage sticky header
Today conflict
Month holiday
Month batch-generate sheet
Month bulk-remove offline guard
Month conflict iPad
```

第一輪 UI audit 不需要立即建立 backend-specific lane。

## 11.2 暫不補拍 backend-specific states

暫不建立：

```text
empty-backend capture
seeded-backend capture
synthetic workbook capture
```

理由：

```text
Phase UI-1 的目標是分析現況與建立設計 brief
現有 22 張 screenshots 已足夠找出主要 UI 問題
額外 backend lane 會增加風險與成本
缺少的高風險畫面可在對應頁面遷移前補拍
```

待補拍清單：

```text
Students empty state
MonthPage real bulk-remove second confirm
DataPage clean backend-primary stats
DataPage workbook preview / confirm
```

## 11.3 必須先處理的設計契約衝突

```text
CONFLICT-UI-001:
Month Grid conflict vs absent marker ambiguity

CONFLICT-UI-002:
Month batch generate 是否應新增 preview / confirm
```

在使用者裁決前：

```text
不得進入 UI Design System 實作
不得新增功能
不得默認修改 MonthPage interaction contract
```

---

# 12. 下一步

```text
NEXT_ACTION:
USER_PRODUCT_DECISION_REQUIRED
```

需要使用者決定：

```text
1. MonthPage batch generate：
   保留直接執行
   或
   後續新增 preview / confirm

2. Month grid conflict marker：
   後續設計時必須改成 distinct non-color-only marker
```

第二項中控建議：

```text
應修改
```

第一項中控建議：

```text
建議新增 preview / confirm
```

但這屬產品功能改動，必須獨立 Phase，不應混入純 UI restyle。

---

# 13. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_1B_2C_COMPLETE_WITH_CONTRACT_CONFLICTS

BASELINE_SCREENSHOTS:
22

SCREENSHOT_STORAGE_POLICY:
EVIDENCE_ARCHIVE_ONLY

NEXT_PHASE:
STOP_FOR_PRODUCT_DECISION
```
