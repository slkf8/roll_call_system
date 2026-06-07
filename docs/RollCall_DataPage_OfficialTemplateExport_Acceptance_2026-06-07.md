# DataPage Official Template Export Acceptance — 2026-06-07

## Final status

`DATAPAGE_OFFICIAL_TEMPLATE_EXPORT_ACCEPTANCE_PASS`

## Scope

- backend-primary export
- missing-column UI gate
- browser local fallback
- artifact handoff
- openpyxl semantic diff
- UI toast confirmation
- isolated lane cleanup
- durable evidence archival

## Status chain

- `PASS_C1_ARTIFACT_PRESENT_AFTER_MANUAL_HANDOFF`
- `PASS_D_OPENPYXL_DIFF_AND_LOG_EVIDENCE`
- `PASS_E_S_ISOLATED_LANE_RUNNING`
- `PASS_E1A_BROWSER_READY_FOR_FAILURE_INJECTION`
- `PASS_E1B_MH_C_FALLBACK_ARTIFACT_READY_FOR_OPENPYXL_DIFF`
- `PASS_E2_FALLBACK_ARTIFACT_SEMANTIC_DIFF_AND_UI_MESSAGE_CONFIRMED`
- `PASS_E2_5_B_UI_MESSAGE_CONFIRMED_BACKEND_RESTORED`
- `PASS_E3_ISOLATED_LANE_STOPPED_AND_ARCHIVED`
- `PASS_E4_DURABLE_ARCHIVE_CREATED_AND_VERIFIED`

## Isolated lane

- frontend `:5199`
- backend `:8123`（dev 分離來源；非 packaged 同源）

## Required semantics

- month block: AQ:AW for January（`AQ1 = 1月各情況次數`，下一月份區塊由 `AX1` 起）
- field mapping: C（姓名）/ E（出生日期）/ AQ（直接服務）/ AT（教材次數）/ AW（教材原因）
- sentinel preserved（`AT8 = KEEP-MATERIALS`、`AW8 = KEEP-REASON` 不覆寫）
- duplicated rows not written（測試學生己 Excel 行 9、10：AQ/AT/AW = None）
- unmatched row not added（測試學生庚 未加入、未寫入）
- 21 manifest-required semantics passed

## Global semantic diff（backend-primary vs browser fallback）

- worksheet range: A1:CX1000
- value diffs: 0
- data type diffs: 0
- formula diffs: 0
- merged range diffs: 0
- critical number-format diffs: 0
- result: `SEMANTICALLY_EQUIVALENT_WITH_NONCRITICAL_FORMAT_METADATA_DIFFERENCES`

> 非關鍵差異僅止於檔案層級（serialization 來源不同：backend = openpyxl，fallback = xlsx-populate）；
> 業務內容、公式、合併儲存格與關鍵數值格式完全一致。

## UI fallback

- first toast: 後端匯出失敗，已使用本地匯出
- second toast: 已匯出並填入 5 筆資料
- result: `PASS_UI_FALLBACK_MESSAGE_SOURCE_CONFIRMED`

## Durable evidence archive

`~/Documents/RollCall_AcceptanceArchives/DataPage_FallbackAcceptance_2026-06-07_XmQgul/`

短期暫存副本（可日後清除）：`/private/tmp/RollCall_DataPage_FallbackAcceptance.XmQgul`

## Observation

`OBSERVATION_RC8_EXTERNAL_RESTART_DURING_E3`

說明：

- E3 cleanup 期間，live RC8 `:8000` PID 由 62219 外部變更為 63166。
- 驗收 session 未向 RC8 process 發送 signal。
- RC8 health 200，fingerprint 維持對應 portable data。
- 此 observation 不影響 DataPage 驗收結論。

## Remaining release work

- 評估 RC9
- package / binary smoke
- Windows 維修入口與其他仍未完成項目
- push 仍需使用者另行批准
