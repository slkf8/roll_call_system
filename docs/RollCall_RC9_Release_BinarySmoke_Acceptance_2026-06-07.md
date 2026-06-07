# RC9 Release — Build / Package / Binary Smoke Acceptance — 2026-06-07

## Final status

`RC9_RELEASE_BINARY_SMOKE_ACCEPTANCE_PASS`

## Provenance

- build source commit：`cca9498fef8d0ffaaa44ab4e506ab8202fda8543`（= 當時 origin/main HEAD）
- lightweight tag：`portable-release-candidate-9`
- tag target：`cca9498fef8d0ffaaa44ab4e506ab8202fda8543`
- tag state：**已建立並單獨 push**（local = remote → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543`，object type commit）

## Artifact

- path：`release/RollCall_Portable_macOS_RC9.zip`
- size：21221405
- MD5：`a9dc9a00987559c53a827bf83afdf9b9`
- SHA256：`4e965900d80c895f4f561c837b61d491f7362c1ea8c3c09d3d1d0271e4381691`

> 說明：RC9 named zip 由 `./scripts/package_release.sh --zip` 產生的 generic
> `release/RollCall_Portable_macOS.zip` 以 `cp` 複製而來（byte-identical）。generic zip 為
> 該腳本固定輸出名稱，依設計被覆寫；RC5–RC8 named zips 不受影響。

## Status chain

- `PASS_G2_RC9_CLEAN_BINARY_BUILD_READY_FOR_PACKAGE_APPROVAL`
- `PASS_G3_RC9_PACKAGE_CREATED_READY_FOR_SMOKE_APPROVAL`
- `PASS_G4_RC9_PACKAGED_BINARY_SMOKE_READY_FOR_DOCS_APPROVAL`

## Build / package

- build：`./scripts/build_binary.sh`（前端 `npm run build` + PyInstaller `--clean --noconfirm`，onedir，arm64）→ `backend/dist/roll_call_backend/roll_call_backend`（size 9600880）
- package：`./scripts/package_release.sh --zip` → `release/RollCall_Portable_macOS/` + generic zip（覆寫）→ cp 為 named RC9 zip
- package data：empty（`roll_call_backend/data/` 僅含空 `backups/`，無 `*.db` / `*.sqlite*` / `*.db-journal` / `app.lock`）

## Smoke summary

- isolated port：8200
- smoke lane：`/private/tmp/RollCall_RC9_Smoke.OGDDBF`
- health：HTTP 200（`dataDirFingerprint` `9af17d1d8d95a239`）
- data binding：RC9 runtime 僅開啟 `<SMOKE>/data/app.db` 與 `<SMOKE>/data/app.lock`
  - repo backend/data：未接觸
  - Desktop RC8 data：未接觸
  - package data：empty（未被 runtime 寫入）
- bundled frontend：PASS（`/` HTTP 200；`/assets/index-CXwNrtBm.js` HTTP 200，size 719568）
- DataPage entrance：PASS（首頁 → 「數據」→「數據與匯出」頁渲染，無 console blocking exception）
- template upload：未執行
- Excel export：未執行
- cleanup：只精準停止 smoke PID 25223（`kill -TERM`，無模糊 kill）；`:8200` 已無 listener、PID 已結束

## Protected artifacts

- RC5–RC8 named zips：unchanged
- RC8 操作手冊（`release/RollCall_RC8_操作手冊.md`）：unchanged
- Desktop RC8 portable metadata：unchanged
- Desktop RC8 `data/app.db` metadata：unchanged（僅核對 size/mtime，未讀取 SQLite 內容）

## Evidence

- permanent：`~/Documents/RollCall_AcceptanceArchives/RC9_BuildPreflight_2026-06-07_214255/`
  （protected_artifact_baseline.txt、phase_g2_build.log/result、phase_g3_package.log/result/inventory、phase_g4_smoke_result.txt）
- smoke lane：`/private/tmp/RollCall_RC9_Smoke.OGDDBF`（logs/rc9_backend.log、evidence/lane_state.txt、phase_g4_smoke_result.txt、phase_g4_smoke_inventory.txt）

## Remaining work

- `portable-release-candidate-9` lightweight tag **已建立並單獨 push** → `cca9498fef8d0ffaaa44ab4e506ab8202fda8543`（local = remote）
- 第一個 RC9 docs commit `35ef02c123acafdd083dfe722befdf9e0054866b` **已於本機建立**
- 本輪 tag post-push 文件狀態更新 **尚未 commit**
- RC9 docs commits **尚未 push 至 `origin/main`**
- Windows 維修入口仍 **out-of-scope**
