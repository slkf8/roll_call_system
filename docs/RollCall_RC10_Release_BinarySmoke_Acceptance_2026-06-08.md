# RollCall Portable macOS RC10 Release / Binary Smoke Acceptance

## 1. Scope

本文件記錄 RollCall Portable macOS RC10 的 pre-tag release evidence。範圍包含 clean binary build、portable package、RC10 named artifact identity、DB / lock exclusion、formal-data safety policy、host-shell packaged binary smoke，以及 cleanup tool limitation 的 accepted variance。

本文件不記錄 throwaway smoke lane 絕對路徑、不記錄具體 listener PID、不記錄正式資料內容或其衍生 metadata。

## 2. Source provenance

- RC10 source baseline：`a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`
- branch：`main`
- local / tracking / remote main：一致於 `a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`
- provenance state：build、package、smoke 均以此 source baseline 作為 pre-tag baseline

## 3. Build result

- build status：PASS
- build command：`./scripts/build_binary.sh`
- build output：`backend/dist/roll_call_backend/roll_call_backend`
- build binary size：9600880
- build binary SHA256：`2b93868b5685e29bbc590c5eeafe5e5b87c34eceb7d13ed3f4f3970a46fd8df2`
- build binary MD5：`b926d8b44dd31d946a772bdcbcc67a5d`

## 4. Package result

- package status：PASS
- package command：`./scripts/package_release.sh --zip`
- generic package folder：`release/RollCall_Portable_macOS/`
- generic package zip：`release/RollCall_Portable_macOS.zip`
- RC10 named artifact：`release/RollCall_Portable_macOS_RC10.zip`
- package result：new generic zip and RC10 named zip are byte-identical by hash
- RC9 protected artifact：unchanged

## 5. Artifact identity

- RC10 artifact path：`release/RollCall_Portable_macOS_RC10.zip`
- size：21222640
- SHA256：`e2c0fd84f6b3ddbb24c68dd932885e14894eefd400605d90fc3c015d008366c4`
- MD5：`df79d74cd2a1bb2b25d621c2d3ae9288`

RC9 protected artifact baseline retained:

- path：`release/RollCall_Portable_macOS_RC9.zip`
- SHA256：`4e965900d80c895f4f561c837b61d491f7362c1ea8c3c09d3d1d0271e4381691`
- MD5：`a9dc9a00987559c53a827bf83afdf9b9`

## 6. DB / lock exclusion

- package DB / lock exclusion：PASS
- packaged folder：無 DB / lock 污染
- RC10 named zip：無 DB / lock 污染
- runtime DB / lock：只建立於 throwaway smoke lane

## 7. Formal-data safety policy

- formal-data policy：`OPAQUE_PROTECTED_FORMAL_DATA_ZONE`
- formal-data contents inspected：no
- formal-data hash recorded：no

正式資料區僅作 opaque protected zone；release evidence 以明確 runtime data-dir 覆寫、throwaway lane runtime residue、packaged folder exclusion、repo worktree clean、RC9 / RC10 artifact hash 一致共同支持 isolation 結論。

## 8. Packaged binary host-shell smoke

- smoke status：`PASS_RC10_PACKAGED_BINARY_SMOKE_WITH_EXACT_SIGINT_CLEANUP_READY_FOR_DOCS_GATE`
- execution mode：macOS host Terminal foreground
- packaged binary：`release/RollCall_Portable_macOS/roll_call_backend/roll_call_backend`
- smoke port：8210
- health：PASS
- root HTML：PASS
- GET-only API smoke：PASS
- students count：0
- sessions count：0
- monthly endpoint：PASS
- packaged folder pollution：NONE
- port release：PASS
- existing `:5173` dev server：untouched

No POST / PUT / PATCH / DELETE API calls were used for smoke.

## 9. Cleanup tool limitation and accepted variance

- cleanup tool limitation：`TOOL_LIMITATION_TERMINAL_CTRL_C_KEYSTROKE`
- accepted variance：`ACCEPTED_EXACT_SIGINT_TO_RECORDED_LISTENER_PID`

Cleanup note:

- Terminal App automated Ctrl-C keystroke did not stop the busy foreground tab.
- The smoke listener on `:8210` was uniquely recorded before cleanup.
- Cleanup sent SIGINT only to that recorded listener PID.
- No `killall` was used.
- No `pkill` was used.
- No fuzzy grep kill was used.
- Existing `:5173` dev server was not operated.
- `:8210` was confirmed released after cleanup.

This variance is accepted as cleanup tooling limitation and is not treated as a product defect.

## 10. Evidence archive

- archive：`~/Documents/RollCall_AcceptanceArchives/RC10_BuildPreflight_2026-06-08_l6H5Ty/`
- build evidence：`phase_rc10_1_build_result.txt`、`phase_rc10_1_binary_metadata.txt`
- package evidence：`phase_rc10_2_package_result.txt`、`phase_rc10_2_package_hashes.txt`、`phase_rc10_2_named_zip_inventory.txt`
- DB / lock exclusion evidence：`phase_rc10_2_db_lock_exclusion_scan.txt`
- sandbox bind failure summary：`phase_rc10_3_sandbox_bind_failure.txt`
- host-shell smoke evidence：`phase_rc10_3_host_smoke_lane.txt`、`phase_rc10_3_health.json`、`phase_rc10_3_api_students_summary.txt`、`phase_rc10_3_api_sessions_summary.txt`、`phase_rc10_3_api_monthly_stats_summary.txt`、`phase_rc10_3_smoke_result.txt`
- cleanup variance evidence：`phase_rc10_3_cleanup_deviation.txt`、`phase_rc10_3_port_release_gate.txt`

## 11. Tag status

- lightweight tag：`portable-release-candidate-10`
- tag type：lightweight
- object type：commit
- local tag target：`a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`
- remote tag target：`a3af39bb69ffc8137ec32f8edbfc6bdb248fa30d`
- tag push state：已建立並單獨 push

Tag was created and pushed as a separate tag-only operation. Main has not been pushed yet.

Docs state:

- pre-tag docs commit：`06d028af0b21427826eea259c103efa708a88540`
- pre-tag docs commit：尚未 push 至 `origin/main`
- post-tag docs update：尚未 commit
- next step：post-tag docs stage gate → docs-only local commit → integrated main pre-push gate → 單次 `git push origin main`

## 12. Remaining out-of-scope work

- Windows 維修入口整合仍 out-of-scope。
- Windows portable package 與 Windows 實機 lock 驗收仍 out-of-scope。

## 13. Final pre-tag status

`PASS_RC10_PACKAGED_BINARY_SMOKE_WITH_EXACT_SIGINT_CLEANUP_READY_FOR_DOCS_GATE`

RC10 build、package、artifact identity、DB / lock exclusion、opaque formal-data policy、host-shell packaged binary smoke、accepted cleanup variance、evidence archive 與 tag status 均已補錄。RC10 tag `portable-release-candidate-10` 已建立並單獨 push；main 尚未 push。
