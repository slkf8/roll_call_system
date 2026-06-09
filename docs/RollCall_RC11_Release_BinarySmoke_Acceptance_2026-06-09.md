# RC11 Release Binary Smoke Acceptance（2026-06-09）

> 記錄 RC11 portable release 的 clean build、package、artifact identity、isolated packaged binary smoke 與 formal-data policy，供日後 audit。本文件只描述截至撰寫時的狀態；後續若有新 commit / tag / push，請以實際 `git log` 與 artifact hash 為準。

## 1. Scope

RC11「月份選擇互動修正」功能鏈 push 至 `origin/main` 後的 portable release：clean binary build、portable package、RC11 named artifact 建立、isolated packaged binary GET-only smoke。功能本身（MonthPage / DataPage native date overlay）見 [`RollCall_RC11_MonthPicker_iPad_Acceptance_2026-06-08.md`](RollCall_RC11_MonthPicker_iPad_Acceptance_2026-06-08.md)。

## 2. Source baseline

| 項目 | 值 |
|---|---|
| source baseline commit | `38846dc67591494d3a00ee9cfc45f7da0a181b51` |
| branch | `main`（已 push origin/main） |
| 撰寫時間 | 2026-06-09 |

## 3. Clean binary build

- `./scripts/build_binary.sh` 執行一次，frontend build + PyInstaller `--clean --noconfirm`，exit code 0。
- binary：`backend/dist/roll_call_backend/roll_call_backend`（存在且可執行）。
- 後端 EXE bootloader hash 與 RC10 相同屬預期：RC11 變更為前端，打包後落在 `_internal/frontend_dist/`，不影響後端 EXE。

## 4. Package result

- quarantine 既有 RC10 遺留 generic zip 後，執行一次 `./scripts/package_release.sh --zip`，exit code 0。
- 新建 `release/RollCall_Portable_macOS`（generic folder）與 `release/RollCall_Portable_macOS.zip`（generic zip）。
- RC11 named zip 由 generic zip 以 no-clobber 複製建立。
- package 只清空 staging data，正式 `backend/data` 未被觸碰。

## 5. Artifact identity

| 項目 | 值 |
|---|---|
| artifact | `release/RollCall_Portable_macOS_RC11.zip` |
| size | `21222989` |
| SHA256 | `5aceca9e173cd5a483c390d979fb840e5ea6e473ed9034942d1f120dda483300` |
| MD5 | `b2409b2bd11538d6ee0e6a5c7c5a08cf` |
| inventory | 137 entries / uncompressed 42,481,343 bytes |
| generic / named | **BYTE-IDENTICAL** |

## 6. DB / lock exclusion

- RC11 named zip、generic zip、generic folder 皆通過 DB / lock filename exclusion scan：無任何 SQLite DB 或 runtime lock 檔案（含 journal / WAL / SHM 變體）。
- shipped data dir 僅含空 `roll_call_backend/data/` + `data/backups/`。
- **PASS**。

## 7. Formal-data policy

| 項目 | 值 |
|---|---|
| policy | `OPAQUE_PROTECTED_FORMAL_DATA_ZONE` |
| formal_data_contents_inspected | `no` |

正式 `backend/data` 全程僅 `test -d`，未列出、遍歷、讀取、stat 或 hash 任何內部檔案。

## 8. Packaged smoke execution

| 項目 | 值 |
|---|---|
| status | `PASS_RC11_ISOLATED_PACKAGED_SMOKE_READY_FOR_RELEASE_DOCS` |
| execution_mode | `DIRECT_PACKAGED_BINARY_BACKGROUND_WITH_EXACT_PID_CLEANUP` |
| launcher_used | no |
| smoke_port | 8211 |
| runtime_data_dir | throwaway lane runtime（`ROLL_CALL_DATA_DIR` 強制隔離） |
| formal_data_contents_inspected | no |
| policy | `OPAQUE_PROTECTED_FORMAL_DATA_ZONE` |

- RC11 named zip 解壓至 throwaway lane，直接執行 packaged binary（非 launcher、非 :8000）。
- runtime DB / lock 只建立於 throwaway runtime dir；extracted package 啟動後仍無 DB / lock，repo `backend/data` 未受影響。
- evidence archive：`~/Documents/RollCall_AcceptanceArchives/RC11_BuildPreflight_2026-06-09_15dcbf/`。

## 9. GET-only smoke matrix

| Endpoint | Method | HTTP | 結果 |
|---|---|---|---|
| /health | GET | 200 | PASS |
| / | GET | 200 | index.html 可讀 |
| /api/students | GET | 200 | 空資料 PASS |
| /api/sessions | GET | 200 | 空資料 PASS |
| /api/global-events | GET | 200 | 空資料 PASS |
| /api/statistics/monthly?month=2026-01 | GET | 200 | 空統計 PASS |

write API（POST / PUT / PATCH / DELETE）：**未執行**。

## 10. Cleanup

- 記錄唯一 listener PID。
- 終止前驗證該 PID command line 指向 throwaway extract binary。
- 只對記錄 PID 發送 SIGTERM，graceful shutdown（uvicorn application shutdown complete）。
- 未使用 `pkill` / `killall` / 模糊 grep kill。

## 11. Runtime listener isolation

- `:8211`：smoke 後已釋放，無 listener。
- `:5173`：既有 dev server，全程只觀察，未操作。
- `:8000`：既有 packaged backend，全程只觀察，未操作。

## 12. Evidence archive

archive：`~/Documents/RollCall_AcceptanceArchives/RC11_BuildPreflight_2026-06-09_15dcbf/`

- RC11-1 build evidence（protected baseline、runtime baseline、build log / result、binary hashes、post-build gate）。
- RC11-2 package evidence（pre-package inventory / hashes、quarantine inventory、package log / result、generic inventory、named zip inventory、package hashes、DB / lock exclusion scan、post-package gate）。
- RC11-3 smoke preflight evidence（preflight gate、named zip inventory / hashes、DB / lock scan、launcher review、GET plan、lane plan、cleanup plan、post-preflight gate）。
- RC11-3 smoke result evidence（smoke result、runtime state、HTTP results、cleanup result、post-smoke gate）。

archive 未複製 synthetic runtime database、runtime lock 或 raw runtime log；raw log 只保留於 throwaway lane。

## 13. RC10 invariant

| 項目 | 值 |
|---|---|
| RC10 named zip SHA256 | `e2c0fd84f6b3ddbb24c68dd932885e14894eefd400605d90fc3c015d008366c4`（未變） |
| RC10 tag | `portable-release-candidate-10` → `a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`（commit，local = remote，未變） |

## 14. RC11 tag status

| 項目 | 值 |
|---|---|
| tag | `portable-release-candidate-11` |
| 狀態 | **尚未建立、尚未 push** |
| 預計 target | `38846dc67591494d3a00ee9cfc45f7da0a181b51` |
| 預計 type | lightweight |

## 15. Out-of-scope

- Windows portable
- Windows 維修入口
- Windows 實機 lock 驗收
- RC11 tag 建立與 push
- post-tag docs
- main docs push

## 16. Current state

- RC11 source feature commits 已 push 至 `origin/main`（HEAD `38846dc67591494d3a00ee9cfc45f7da0a181b51`）。
- RC11 portable package 與 named artifact 已建立並通過 isolated packaged binary smoke。
- RC11 release candidate tag 尚未建立、尚未 push。
- tracked worktree clean；release artifacts 為 gitignored，未進入 tracked repo。

## 17. Next step

post-tag 前：完成本批 release docs 的 precise stage gate → docs-only local commit；其後評估 RC11 lightweight tag 建立與 push（user-gated）→ post-tag docs / main docs push。
