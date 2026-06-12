---
title: "roll_call_system Phase UI-1B-1 隔離 Lane 安全驗證"
project: "roll_call_system"
document_type: "UI isolated lane safety verification"
phase: "PHASE UI-1B-1"
language: "繁體中文"
updated_at: "2026-06-10"
status: "COMPLETE"
baseline: "RC11 COMPLETE"
source_report: "Claude Code Phase UI-1B-1 Isolated Lane Build and Safety Verification"
next_phase: "PHASE UI-1B-2A Seed-fallback Capture Lane Start"
---

# roll_call_system Phase UI-1B-1 隔離 Lane 安全驗證

## 0. 文件用途

本文件記錄 `Phase UI-1B-1 Isolated Lane Build and Safety Verification` 的正式結果。

本輪目的不是截圖，而是驗證：

```text
RC11 committed frontend
        ↓
frontend-only git archive
        ↓
/private/tmp throwaway lane
        ↓
symlink node_modules
        ↓
isolated frontend :5199
        ↓
dead API target :8211
        ↓
fresh browser profile
        ↓
built-in synthetic seed fallback
        ↓
precise PID cleanup
```

整條鏈路可在不接觸正式資料、不修改 repo、不操作 live process 的前提下可靠運作。

建議保存於：

```text
docs/ui-refactor/19_QA_ISOLATED_LANE_SAFETY_VERIFICATION.md
```

---

# 1. Phase 結論

```text
PHASE_UI_1B1_STATUS:
PASS_ISOLATED_LANE_SAFETY_VERIFICATION
```

中控判斷：

> 隔離 Lane 模式已完成端到端驗證，可以作為後續 UI baseline screenshot capture 與 Codex Browser Audit 的標準執行模式。

本輪沒有：

```text
source 修改
docs 修改
dependency 修改
正式資料存取
backend 啟動
screenshot matrix
commit
push
tag
package
```

---

# 2. RC11 基準

| Check | Value |
|---|---|
| branch | `main` |
| HEAD | `cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9` |
| origin/main | 與 HEAD 一致 |
| remote main | 與 HEAD 一致 |
| ahead / behind | `0 / 0` |
| `git diff --check` | empty |
| `git diff --cached --check` | empty |
| `backend/data` | EXISTS；只透過 `test -d` 驗證 |

---

# 3. 已知 UI-refactor 文件

本輪開始時，repo 內存在三份已知 untracked 規劃文件：

```text
docs/ui-refactor/
├── 00_MASTER_UI_REFACTOR_PLAN.md
├── 05_RULES_DOCUMENT_NAMING.md
└── 10_AUDIT_CURRENT_UI_INVENTORY.md
```

它們均屬有意加入的 UI 重構文件。

```text
ADDITIONAL_WORKTREE_CHANGES:
none
```

---

# 4. Process Baseline

本輪使用更新後的 process baseline。

| Port | Preflight | Rule |
|---|---|---|
| `:5173` | live Vite，PID `41123` | 保留，不得操作 |
| `:8000` | no listener | 維持 no listener，不得自行啟動 |
| `:5199` | free | 本輪 throwaway frontend 專用 |
| `:8211` | free | 維持 no listener，作為 dead API target |

中控判斷：

```text
PASS
```

---

# 5. Frontend-only Throwaway Lane

## 5.1 Lane

```text
LANE_PATH:
<TMP_UI1B_LANE>

LANE_SCOPE:
frontend-only

LANE_SOURCE:
git archive HEAD frontend

LANE_HEAD:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9
```

## 5.2 Purity

Lane top-level 只包含：

```text
frontend/
```

沒有：

```text
backend/
backend/data/
release/
docs/
test_artifacts/
```

中控判斷：

> `frontend-only git archive` 是 UI baseline capture 的正確標準模式。它比 archive 整個 repo 更安全，因為可直接排除正式資料區與 release artifact。

---

# 6. node_modules

```text
NODE_MODULES_MODE:
symlink
```

symlink 目標：

```text
<REPO_ROOT>/frontend/node_modules
```

驗證：

```text
vite binary reachable:
yes

npm install:
no

npm update:
no

lockfile modified:
no

dependency modified:
no
```

中控判斷：

```text
PASS
```

---

# 7. Seed-fallback Frontend

## 7.1 啟動配置

```text
VITE_API_BASE_URL:
http://127.0.0.1:8211

FRONTEND:
127.0.0.1:5199

BACKEND:
not started

MODE:
seed-fallback
```

## 7.2 PID Gate

```text
FRONTEND_PID:
44008

PARENT_NPM_PID:
43913

FRONTEND_COMMAND:
node <TMP_UI1B_LANE>/frontend/node_modules/.bin/vite
--host 127.0.0.1 --port 5199 --strictPort

FRONTEND_CWD:
<TMP_UI1B_LANE>/frontend

FRONTEND_LISTENER:
127.0.0.1:5199

HTTP_PROBE:
200 OK
```

只有本輪 Vite process 佔用：

```text
:5199
```

---

# 8. Fresh Browser Profile Gate

## 8.1 Profile

```text
BROWSER_PROFILE_PATH:
<TMP_UI1B_BROWSER_PROFILE>
```

Profile 本輪新建，初始為空。

## 8.2 驗證結果

```text
LOCALSTORAGE_INITIAL_STATE:
empty

PRE_EXISTING_attendance_v1_data:
no

PAGE_LOADED:
yes

SEED_FALLBACK_CONFIRMED:
yes

REAL_DATA_VISIBLE:
no
```

驗證畫面：

```text
tab bar:
今日 / 月份 / 學生 / 數據

header:
2026年6月10日（週三）

synthetic seed sessions:
4

synthetic names:
陳小明
李小欣
```

載入後 app 將 synthetic seed 寫入 throwaway profile 的：

```text
attendance_v1_data
```

這是預期行為。

throwaway browser profile 已於 cleanup 刪除。

## 8.3 DOM Evidence

Evidence Archive 保存：

```text
dom_seed_fallback.html
```

該檔只包含 synthetic seed 與 UI labels。

中控判斷：

```text
本輪可接受
```

後續規則：

> DOM dump 不是 screenshot capture 的必要產物。後續只有在需要診斷時才保存，並且必須再次確認只包含 synthetic data。

---

# 9. Formal Data Zone Compliance

正式資料區：

```text
backend/data/
=
OPAQUE_PROTECTED_FORMAL_DATA_ZONE
```

本輪只執行：

```bash
test -d backend/data
```

共兩次：

```text
preflight
safety probe
```

沒有：

```text
ls
find
stat
hash
copy
git ls-files
count
archive inclusion
archive extraction
metadata query
```

Lane 為 frontend-only，因此完全不包含 backend 路徑。

```text
FORMAL_DATA_ZONE_QUERY:
only test -d

FORMAL_DATA_CONTENT_ACCESSED:
no
```

---

# 10. Cleanup

## 10.1 精準 PID Cleanup

停止：

```text
frontend vite PID:
44008

parent npm PID:
43913

headless Chrome PID:
44621
```

只停止本輪精確識別的 PID。

沒有使用：

```text
killall
pkill
pattern kill
模糊 grep kill
```

## 10.2 Cleanup 後 Port

| Port | Final State |
|---|---|
| `:5173` | preserved，PID `41123` |
| `:8000` | no listener |
| `:5199` | no listener |
| `:8211` | no listener |

## 10.3 Removed

```text
<TMP_UI1B_LANE>
<TMP_UI1B_BROWSER_PROFILE>
```

## 10.4 Retained Evidence

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
UIRefactor_PhaseUI1B1_LaneSafety_2026-06-10_5a91f7/
```

Evidence 包含：

```text
lane_build
frontend_gate
browser_gate
safety_probe
cleanup_report
dom_seed_fallback.html
```

只包含 synthetic data。

---

# 11. Changed Files Gate

```text
git status --short --branch:
## main...origin/main
?? docs/ui-refactor/
```

其中只包含已知 UI-refactor 文件。

```text
SOURCE_MODIFIED:
no

DOCS_MODIFIED:
no

DEPENDENCY_MODIFIED:
no

PROCESS_STARTED:
yes
only throwaway frontend :5199
and throwaway headless Chrome verifier

PROCESS_STOPPED:
yes
only exact this-round PIDs

BACKEND_STARTED:
no

FORMAL_DATA_ZONE_QUERY:
only test -d

FORMAL_DATA_CONTENT_ACCESSED:
no

SCREENSHOTS_CAPTURED:
no

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

# 12. 中控裁決

## 12.1 已批准標準模式

後續 seed-fallback baseline capture 應重用：

```text
frontend-only git archive
        ↓
symlink node_modules
        ↓
VITE_API_BASE_URL=http://127.0.0.1:8211
        ↓
Vite :5199 --strictPort
        ↓
fresh temporary browser profile
        ↓
Synthetic Seed only
        ↓
Evidence Archive only
        ↓
precise PID cleanup
```

## 12.2 不應改變

```text
不得 archive 整個 repo
不得抽取 backend/
不得啟動 live :8000
不得操作 live :5173
不得接觸 backend/data
不得使用日常 browser profile
不得將 baseline screenshots 提交至 repo
```

---

# 13. 下一步

```text
NEXT_PHASE:
PHASE UI-1B-2A
Seed-fallback Capture Lane Start
```

目標：

```text
重建已驗證的 frontend-only lane
保留 lane 運行
記錄精確 PID
建立 Screenshot Evidence Archive
準備交由 Codex 進行第一輪 Browser Audit
```

`UI-1B-2A` 不應直接一次完成全部 baseline screenshots。

後續再分為：

```text
UI-1B-2A
Claude Code：
Seed-fallback Capture Lane Start

UI-1B-2B
Codex：
Seed-fallback Browser Audit and Baseline Screenshots

UI-1B-2C
Claude Code：
Precise Cleanup and Evidence Verification
```

---

# 14. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PHASE_UI_1B_1_COMPLETE

BASELINE:
RC11_COMPLETE

ISOLATED_LANE_PATTERN:
PROVEN

NEXT_PHASE:
PHASE_UI_1B_2A_SEED_FALLBACK_CAPTURE_LANE_START

SCREENSHOT_STORAGE_POLICY:
EVIDENCE_ARCHIVE_ONLY

FORMAL_DATA_ACCESS:
forbidden
```
