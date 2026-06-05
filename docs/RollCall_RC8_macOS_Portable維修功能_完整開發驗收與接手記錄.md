# RollCall RC8 — macOS Portable 維修功能｜完整開發、驗收與接手記錄

> 本文件為 RC8（portable-release-candidate-8）的單一權威交接文件。
> 目的：讓下一位開發者或 AI 對話「不需依賴本次對話」即可完整理解 RC8 的脈絡、設計、實作範圍、驗收狀態、安全不變量與接手規則。
> 撰寫時基線 commit：`2f91adaa12e775b41a2ca6fc5d58dd746f2373ec`。

---

## 1. 文件用途與專案概況

### 專案

- **專案名稱**：`roll_call_system`
- **用途**：一對一教學場景的點名、排課、出席狀態、缺席原因、補課／加課、統計與 Excel 匯出管理系統。

### 技術堆疊

| 層級 | 技術 |
| --- | --- |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | SQLite |
| Desktop portable | PyInstaller onedir（onedir，非 onefile） |
| macOS 啟動方式 | `.command` launcher |
| Source of truth | SQLite DB |
| Excel | 只作輸出，不是 source of truth |

### 核心原則

- **DB-first**：SQLite DB 是唯一真實資料來源（source of truth）。
- **正式資料不可被測試、build、package 或 Git 意外夾帶**。
- **所有高風險操作必須有 gate**（lifecycle lock、health probe、SQLite exclusive lock、emergency backup、人工輸入確認等）。
- Excel 僅為輸出產物，不可反向當作資料來源回填。

---

## 2. RC8 封存基線

| 項目 | 值 |
| --- | --- |
| branch | `main` |
| HEAD / local main / origin-main / remote main | `2f91adaa12e775b41a2ca6fc5d58dd746f2373ec` |
| tag | `portable-release-candidate-8` |
| tag 類型 | lightweight tag（`git cat-file -t` 回傳 `commit`） |
| artifact | `release/RollCall_Portable_macOS_RC8.zip` |
| artifact size | `21216705` bytes |
| artifact SHA-256 | `64c775db3f6791af2f4bc20256105da4b24139ac0749bfe98b2fb8546fbb567d` |

> 上述四個 ref（HEAD / local main / origin-main / remote main）在 RC8 接手唯讀 gate 中確認**全部相等**，tag 指向同一個 RC8 commit。

---

## 3. RC8 對應 commits

```text
cbb2719 feat(restore): add safe portable database rollback CLI
d2c3a0e feat(restore): add macOS portable maintenance wrapper
2f91ada fix(restore): distinguish health probes by data directory
```

各 commit 用途：

- **`cbb2719` — feat(restore): add safe portable database rollback CLI**
  新增安全的可攜式資料庫回復 CLI（RC8-A1）。提供 `list / validate / restore / history` 子命令，並建立完整 restore 流程與保護機制（lifecycle lock、health probe、SQLite exclusive lock probe、emergency backup、tmp copy、原子替換、post-validate、必要時 rollback）。

- **`d2c3a0e` — feat(restore): add macOS portable maintenance wrapper**
  新增 macOS 維修 wrapper（RC8-A2）。提供 `.command` 選單式維修入口，固定 `ROLL_CALL_DATA_DIR` 到目前 portable folder，只呼叫 binary CLI，本身不實作任何 DB 邏輯，並整合進 package 流程。

- **`2f91ada` — fix(restore): distinguish health probes by data directory**
  health fingerprint 修正（RC8-A3.4）。讓 `/health` 回傳 `dataDirFingerprint`，使 restore 能依「resolved data-dir path」區分不同 portable folder 的 instance，避免不同 folder 的新版 instance 佔用預設 port `8000` 時誤擋目前 folder 的 restore。

---

## 4. RC8-A1：安全資料回復 CLI

透過 binary CLI 提供回復能力，子命令：

```text
list                          列出可用備份
validate <backup_filename>    驗證指定備份是否為合法且可用的 SQLite DB
restore <backup_filename>     將指定備份安全還原為目前 app.db
history                       顯示 restore 歷史紀錄
```

### 主要檔案

```text
backend/app/services/restore_service.py     restore 核心邏輯
backend/run.py                              CLI 進入點與子命令分派
backend/tests/test_restore_service.py       restore service 單元 / 整合測試
backend/tests/test_restore_cli.py           CLI 行為測試
```

### restore 流程（嚴格順序）

```text
filename safety（basename 安全檢查，拒絕路徑穿越如 ../app.db）
→ acquire same data-dir lifecycle lock（取得與 app 相同 data-dir 的生命週期鎖）
→ validate source（驗證來源備份為合法 SQLite）
→ health probe（探測目前 data-dir 是否有運行中 instance）
→ SQLite exclusive lock probe（SQLite 獨占鎖探測）
→ emergency backup（還原前先建立緊急備份）
→ tmp copy（複製到暫存檔）
→ validate tmp（驗證暫存檔）
→ os.replace（原子替換 app.db）
→ post-validate（替換後再次驗證）
→ 必要時 rollback（驗證失敗則回滾）
→ finally release lock（無論成功失敗，最終釋放 lifecycle lock）
```

---

## 5. RC8-A1.1：lifecycle lock

### 主要檔案

```text
backend/app/services/app_lock.py       OS-level data-dir lifecycle lock 實作
backend/tests/test_app_lock.py         lock 行為測試
```

### 說明

App 與 restore CLI **共用相同 data-dir 的 OS-level lock**。app 啟動期間持有該鎖；restore 必須取得相同鎖才能執行，因此 app 運行期間 restore 會被阻擋。

### 強調（不可違反）

- **lifecycle lock 是主要 gate**。
- **SQLite lock 與 health probe 是 defense-in-depth（縱深防禦）**，不是主要 gate。
- **不得自動 kill PID**。
- **不得以人工刪除 `app.lock` 當作解鎖方法**。正確解鎖方式是正常關閉 app。

---

## 6. RC8-A1.2：pytest data isolation

### 主要檔案

```text
backend/tests/conftest.py               測試資料隔離設定
backend/tests/test_data_isolation.py    隔離不變量驗證
```

### 機制

```python
_TEST_DATA_DIR = tempfile.mkdtemp(prefix="rollcall-tests-")
os.environ["ROLL_CALL_DATA_DIR"] = _TEST_DATA_DIR
```

上述設定**必須在所有 `app.*` import 之前完成**。

### 不可破壞的不變量

- **pytest 永遠不得碰觸 `backend/data/app.db`**。
- **不要將隔離邏輯移回 fixture**。
- **原因**：engine 在 import-time 即建立；若用 fixture 設定隔離，會「太晚」執行，engine 已經指向正式 data-dir。因此隔離必須在 import-time（`conftest.py` 模組層級）完成。

---

## 7. RC8-A2：macOS 維修 wrapper

### 主要檔案

```text
scripts/maintenance_restore.command                    macOS 維修選單 wrapper
backend/tests/test_maintenance_restore_script.py       wrapper 行為測試
scripts/package_release.sh                             package 打包腳本
```

### package 結構

```text
RollCall_Portable_macOS/
├── 啟動 RollCall.command
├── README.txt
├── maintenance/
│   └── RollCall 資料回復工具.command
└── roll_call_backend/
    ├── roll_call_backend
    └── data/
        └── backups/
```

### wrapper 限制（不可違反）

- **只顯示選單**。
- **只呼叫 binary CLI**。
- **固定 `ROLL_CALL_DATA_DIR` 到目前 portable folder**。
- **不設定 `ROLL_CALL_ENABLE_APP_LOCK`**。
- **不自行操作 SQLite**。
- **不自行複製、覆蓋、刪除 DB**。
- **不 kill PID**。
- **restore 前要求輸入 `RESTORE`** 作為人工確認。

---

## 8. RC8-A3.4：health fingerprint

### 主要檔案

```text
backend/app/config.py                          data-dir 解析與 fingerprint 計算
backend/app/main.py                            /health endpoint
backend/app/services/restore_service.py        restore 端 health 判斷
backend/tests/test_restore_service.py          health 判斷規則測試
backend/tests/test_static_serving.py           靜態服務 / health 整合
backend/tests/test_students.py                 既有 API 回歸
```

### `/health` 回應

```json
{
  "ok": true,
  "dataDirFingerprint": "<16-char lowercase hex>"
}
```

### 演算法

```text
SHA-256(resolved data-dir path)
→ hex
→ 取前 16 字元
```

### 用途

不同 portable folder 的新版 instance 即使佔用預設 port `8000`，也**不會誤擋目前 folder 的 restore**。restore 端會比對 fingerprint，只有「相同合法 fingerprint」才視為「目前 data-dir 有運行中 instance」而阻擋。

### 完整判斷規則表

| `/health` 回應 | 行為 |
| --- | --- |
| `ok=true` + 相同合法 fingerprint | block restore |
| `ok=true` + 不同合法 fingerprint | 不因 health 單獨 block |
| `ok=true` + fingerprint 缺失 | 保守 block |
| `ok=true` + fingerprint = null | 保守 block |
| `ok=true` + 非字串、空值、非 hex、大寫或長度錯誤 | 保守 block |
| 非 200 | 不因 health block |
| 壞 JSON | 不因 health block |
| JSON 非 object | 不因 health block |
| 沒有 `ok=true` | 不因 health block |

### 合法 fingerprint 規則

```text
^[0-9a-f]{16}$
```

> 設計取捨：在「fingerprint 缺失 / null / 格式錯誤」時採**保守 block**（因無法確認是否為同 data-dir 的運行中 instance）；而在 health 本身不可信（非 200 / 壞 JSON / 非 object / 無 `ok=true`）時，**不以 health 單獨 block**，改由 lifecycle lock 與 SQLite lock 作為主要保護。

---

## 9. 備份與回復資料格式

### portable data dir 主要檔案

```text
app.db                    正式資料庫
app.lock                  lifecycle lock 檔
restore_history.jsonl     restore 歷史（JSON Lines）
backups/                  備份目錄
```

### 備份種類

| 類型 | 檔名 | 用途 |
| --- | --- | --- |
| latest | `app_latest.db` | 最近狀態 |
| daily | `app_YYYY-MM-DD.db` | 每日快照 |
| emergency | `app_before_restore_YYYY-MM-DD_HHMMSS.db` | 回復前保護備份 |

> **emergency backup 不會被 daily cleanup 誤刪**。

### restore history 欄位

```text
timestamp           時間戳
source              來源備份檔名
emergency           回復前建立的 emergency backup 檔名
result              結果（成功 / 失敗）
error               錯誤訊息（若有）
rollback_result     rollback 結果（若有觸發）
```

---

## 10. 核心安全不變量

```text
正式 DB 不得被 pytest 碰觸
package 出廠不得夾帶 DB
restore 不得在同 data-dir app 運行期間執行
wrapper 不得實作 DB 邏輯
不得用人工刪除 app.lock 解鎖
不得直接操作正式 backend/data/
不得覆蓋既有 release artifact
不得自行清理 /private/tmp 驗收證據
```

### package folder 與 zip 均不得包含

```text
*.db
*.sqlite
*.sqlite3
*-wal
*-shm
restore_history.jsonl
app.lock
```

---

## 11. 自動化與 smoke 驗收紀錄

### pytest

```text
pytest tests
→ 292 passed, 1 skipped
```

### smoke 總結

```text
clean build     PASS
binary smoke    PASS
CLI smoke       PASS
package smoke   PASS
wrapper E2E     PASS
```

### 已驗證情境

```text
/health fingerprint 與 resolved data-dir path 相符
app 運行中 OS lock contended
shutdown 後 final refresh mtime 推進
shutdown 後 OS lock released
list PASS
validate app_latest.db PASS
restore app_latest.db PASS
history PASS
非法 basename ../app.db 拒絕
同 data-dir 運行中 restore 拒絕
停機後 restore 成功
emergency backup 可 validate
zip integrity PASS
folder DB exclusion PASS
zip DB exclusion PASS
extracted pre-launch DB-free PASS
maintenance wrapper executable PASS
launcher executable PASS
README 維修說明存在
不同 data-dir decoy instance 佔用 8000 時 restore 仍成功
外部 ROLL_CALL_DATA_DIR sentinel 保持空
同 data-dir target app 運行中 wrapper restore 被 lifecycle lock 拒絕
```

---

## 12. RC8 接手唯讀 repo gate

本輪實際 PASS 結果：

```text
workspace：
/Users/soulongkit/Documents/Vscode/roll_call_system

branch：
main

HEAD / main / origin-main / remote main：
2f91adaa12e775b41a2ca6fc5d58dd746f2373ec

Git worktree：
clean

local tag：
portable-release-candidate-8 存在

remote tag：
portable-release-candidate-8 存在

tag object type：
commit，即 lightweight tag

artifact：
存在

artifact size：
21216705 bytes

artifact SHA-256：
64c775db3f6791af2f4bc20256105da4b24139ac0749bfe98b2fb8546fbb567d
```

### protected release artifacts

```text
release/RollCall_Portable_macOS.zip
release/RollCall_Portable_macOS_RC5.zip
release/RollCall_Portable_macOS_RC6.zip
release/RollCall_Portable_macOS_RC7.zip
release/RollCall_Portable_macOS_RC8.zip
```

---

## 13. macOS Portable 維修工具人工驗收

使用者已在 portable 副本內，以既有資料人工驗證：

```text
舊資料可複製至 portable 副本
備份可正常恢復
恢復前 emergency backup 可看到
恢復後資料內容正常
正常關閉後重新啟動，資料仍存在
history 可看到恢復紀錄
app 運行期間 restore 被 lifecycle lock 阻擋
停機後 restore 可再次成功
list 正常
validate 正常
```

### 結論

```text
RC8 macOS Portable 維修功能核心人工驗收：
PASS
```

### 補充說明

以下兩項情境：

```text
不存在備份檔
人工建立損壞 broken.db
```

**未額外人工重測**，保留既有 automated test 與 smoke test 作為邊界驗證證據。

---

## 14. Excel DataPage 官方模板 UI 最終人工驗收

使用者已確認：

```text
Excel DataPage 官方模板 UI 最終人工驗收：
PASS
```

原先待驗收項目更新為**已完成人工驗收**：

```text
DataPage UI 上傳官方模板
欄位識別
row matching
preview
confirm
browser download
backend export 與 frontend xlsx-populate fallback 比較
fallback toast
fallback download
```

---

## 15. `/private/tmp` 驗收證據目錄

### 主要保留目錄

```text
/private/tmp/RollCall_RC8_Binary_Smoke.g5MQEv
/private/tmp/RollCall_RC8_CLI_Smoke.NNNZBc
/private/tmp/RollCall_RC8_Fingerprint_Smoke.4aSkI5
/private/tmp/RollCall_RC8_Package_Fingerprint.Nbyv2L
/private/tmp/RollCall_RC8_Extract_Fingerprint.sbPjxX
/private/tmp/RollCall_RC8_Decoy.61Vx9Y
/private/tmp/RollCall_RC8_Wrapper_Sentinel.Ud5B9P
```

### 較早 RC8 tmp

```text
/private/tmp/RollCall_RC8A11_Lock.3duBVQ
/private/tmp/RollCall_RC8A11_Lock.c1W4GT
/private/tmp/RollCall_RC8A1_CLI.zd2TyJ
/private/tmp/RollCall_RC8_Extract.v3bVRa
/private/tmp/RollCall_RC8_Package.pRtxDH
/private/tmp/RollCall_RC8_Sentinel.O0QZjM
```

> **註明：未取得批准前不得清理。** 這些目錄為 RC8 驗收證據。

---

## 16. 仍未完成與暫緩事項

### Windows 維修入口（維持暫緩）

```text
maintenance_restore.bat
scripts/package_release.ps1 整合
Windows portable package
msvcrt.locking Windows 實機驗收
```

### 正式 schema migration framework（尚未導入）

```text
目前沒有正式 migration framework
不要隨意加入 PRAGMA user_version
如需導入，應獨立設計 migration policy
```

---

## 17. RC8 最終結論

```text
RC8 macOS portable release：
正式封存完成

Repo gate：
PASS

自動化測試：
PASS

Binary / CLI / package / wrapper smoke：
PASS

Portable 維修工具人工驗收：
PASS

Excel DataPage 官方模板 UI 最終人工驗收：
PASS

Windows 維修入口：
維持暫緩
```

---

## 18. 下一個接手對話的規則

```text
接手後不要立即修改
先執行唯讀 repo gate

任何修改前列出：
- 預計新增
- 預計修改
- 預計刪除
- 驗收條件
- 停止點

等待使用者明確批准後才可操作

不得直接操作正式 backend/data/
不得覆蓋既有 release artifact
不得自行清理 /private/tmp 驗收證據
Windows 維修入口不得自行開始
```

---

_本文件由 RC8 文件補記階段建立，僅新增此檔，不修改任何既有檔案、程式碼、release artifact 或正式資料。_
