# RollCall Phase 2 — Excel 教材欄位偵測 / 預覽 / 匯出 完整開發驗收記錄

> 階段：Excel 教材欄位偵測、教材次數預覽、原因欄預覽、Excel 匯出、原因 formatter、backend cell write schema、backend / fallback 一致性、真實官方模板驗收
>
> 狀態：**已正式結案並推送至 `origin/main`**

---

## 1. Phase 2 目標

- Excel 教材欄位偵測（個別→配合圖文資料提供諮詢／建議、視像或配合圖文資料提供諮詢／建議原因）
- Excel 教材次數預覽
- Excel 原因欄預覽
- Excel 匯出（後端 openpyxl + 前端 xlsx-populate fallback）
- 原因 formatter（`day-code;day-code`）
- backend cell write schema（允許原因字串）
- backend / fallback 一致性（共用同一批 validated writes）
- 真實官方月報模板 read-only 欄位偵測驗收

本階段**不**處理：視像服務、教材 UI、原因 6 學年 UI、Phase 1 UX polish、DB schema、Session API、macOS/Windows package、codesign/Gatekeeper/notarization。

---

## 2. 穩定基線

| 項目 | 值 |
|---|---|
| Phase 1 commit（parent） | `9343311 feat(attendance): add materials service tracking for absences` |
| Phase 2 commit | `b60f4b2 feat(export): add materials service fields to Excel export` |
| Phase 2 完整 hash | `b60f4b24ad3e78e9900dd7554ee7f11cac59ad23` |
| branch | `main` |
| remote | `origin/main` 已同步（fast-forward `9343311..b60f4b2`） |

---

## 3. 使用者需求與決策演變（D1–D4）

### D1：backend 原因字串寫入
- `ExcelFillWrite.value` 由 `int | float` 擴充為 **`int | float | str`**。
- 字串**只允許** `day-code`（日 1–31、碼 1–6，以 `;` 連接、無空格）格式；最大 1024 字元。任意文字、formula-like、空字串、bool 一律拒絕。
- backend 維持 **dumb writer**：只按 `cellAddress` 寫值，不重新匹配學生、不重算統計、不自行生成原因字串。

### D2：缺少教材欄位時的條件式策略
- **本月無教材**（`materialsCount === 0`）且模板找不到教材／原因欄 → **允許只匯出直接服務**，顯示資訊提示。
- **本月有教材**（`materialsCount > 0`）但教材次數欄或原因欄任一缺失 → **阻止匯出**，要求先設定對應欄位（不得靜默漏填）。

### D3：同一天多節教材
- **不去重**：每一節教材服務都保留。
- 排序：先日期升序，同日再依開始時間升序。
- 原因欄筆數與教材服務次數一致。

### D4：沒有教材時，兩個教材欄位都不寫入（**使用者明確修正**）
- 最終規則：`materialsCount > 0` → 教材次數欄寫實際次數、原因欄寫 formatter 結果；`materialsCount === 0` → **教材次數欄與原因欄兩者完全不寫入**，保留模板原值。
- 預覽顯示「不寫入（保留原值）」，不顯示「將填入 0」。
- **修正歷程**：規劃初期曾擬定「教材次數為 0 時寫入 0」；使用者明確要求改為 **沒有教材時兩個教材欄都完全不寫入（不寫 `0` / `""` / `null`）**，以免覆蓋模板既有內容。本文件最終以此修正版為準。
- 防禦性阻擋：`materialsCount > 0` 但 formatter 回 `""` → 阻止匯出。

---

## 4. 欄位偵測

偵測三個目標欄並各自提供手動 `<select>`：
- `directServiceColumn`（個別 → 直接服務）
- `materialsColumn`（個別 → 配合圖文資料提供諮詢／建議＝教材次數）
- `materialsReasonColumn`（視像或配合圖文資料提供諮詢／建議原因）

規則：
- **教材兩欄只在 high confidence（命中目標月份）時自動選中**；medium / low 只進手動下拉，避免填錯欄。
- `normalizeText()` 比對前先將**全形 `／` → 半形 `/`**（真實模板用半形、需求文件可能用全形）。
- 教材次數欄 high：目標月 + `個別` + `配合圖文資料提供諮詢` + `建議`，且**不含** `原因`、**不含** `視像或`。
- 原因欄 high：目標月 + `視像或` + `配合圖文資料提供諮詢` + `原因`。
- **`normalizedPathIncludesMonth`（月份數字邊界修正）**：以「被比對月份前一字元非數字」為界，避免目標 **`1月` 誤命中 `11月`**、**`2月` 誤命中 `12月`**；`3–9月`/`10月`/`11月`/`12月` 不受影響。此修正屬 Excel 欄位偵測必要修正，並同時改善 Phase 1 直接服務欄在 1/2 月的偵測。

---

## 5. Formatter — `buildMaterialsReasonString()`

位置：`frontend/src/shared/appShared.tsx`

輸入：某學生的 sessions、目標月份起訖（`monthStartISO` / `monthEndISO`）。
輸出範例：`2-4;3-2`（亦可如 `3-4;18-2`）。

規則：
- 只取 `dateISO` 在目標月份內
- 只取 `status === "absent"`
- 只取 `materialsProvided === true`
- 只取 `materialsReasonCode` 為 1–6
- 日期升序、同日開始時間升序
- **不去重**（同日重複保留）
- 日子**不補零**（`3` 而非 `03`）
- 以 `;` 分隔、**無空格**
- 無有效紀錄 → 回 `""`

---

## 6. Backend validator

位置：`backend/app/schemas.py` → `ExcelFillWrite.validate_value`（`mode="before"`）

| 輸入 | 結果 |
|---|---|
| `bool`（`true`/`false`） | **拒絕**（先於 number 判斷，避免被當 1/0） |
| 有限 `int` / `float` | 接受 |
| `NaN` / `Infinity` / `-Infinity` | 拒絕（非有限） |
| `str` | 僅允許原因格式，最大 **1024** 字元 |
| 其他型別 | 拒絕 |

原因字串 regex（與前端 `isValidMaterialsReasonString` 一致）：

```
^(?:[1-9]|[12]\d|3[01])-[1-6](?:;(?:[1-9]|[12]\d|3[01])-[1-6])*$
```

接受：`3-4`、`3-4;18-2`、`3-4;3-4`、`31-6`
拒絕：`""`、`"4"`、`03-4`、`0-4`、`00-4`、`32-4`、`99-6`、`3-7`、`3-4;`、formula-like、bool、超過 1024。

---

## 7. Writes builder — `buildExportWrites()`

位置：`frontend/src/pages/DataPage.tsx`

- **單一事實來源**：backend payload 與 xlsx-populate fallback 都消費**同一批 validated writes**，不各自重寫。
- 直接服務：永遠寫入（number，含 `0`）。
- 教材次數：僅 `matCount > 0` 才加入 writes（`value !== null`）。
- 原因：僅 `matCount > 0` 且 formatter 非空且通過 validator 才加入 writes（`value !== ""`）。
- **D4**：`matCount === 0` → 教材次數 write 與原因 write **皆不存在**（不寫 `0` / `""` / `null`）。

---

## 8. Gating（匯出前防禦，依序）

| 條件 | 行為 |
|---|---|
| 本月存在 absent + materialsProvided 但 reasonCode 不在 1–6（異常教材） | **阻擋** |
| 本月有教材但教材次數欄或原因欄不全 | **阻擋** |
| 直接服務欄 / 教材次數欄 / 原因欄 任兩欄相同（碰撞） | **阻擋** |
| 某學生 `matCount > 0` 但 formatter 為空 | **阻擋** |
| 任一原因 write 不通過 validator（格式不合法） | **阻擋**（不呼叫 backend、不進 fallback） |
| 本月無教材且欄位缺失 | **允許 direct-only**，顯示資訊提示 |

阻擋訊息（節錄）：
- 「本月存在教材服務，但尚未設定完整的教材次數欄與原因欄。請選擇對應欄位後再匯出。」
- 「直接服務欄、教材次數欄與原因欄不能使用同一個 Excel 欄位。」
- 「部分教材服務缺少有效申報原因，請先檢查教材紀錄。」
- 「部分教材服務的原因格式異常，請先檢查教材紀錄。」
- 降級提示：「未偵測到教材相關欄位。本月沒有教材服務，將只填寫直接服務欄位。」

---

## 9. 實際修改檔案（精準 6 檔）

```
backend/app/schemas.py
backend/tests/test_excel_export.py
frontend/src/api/exportsApi.ts
frontend/src/pages/DataPage.tsx
frontend/src/pages/__tests__/DataPage.test.tsx
frontend/src/shared/appShared.tsx
```

`git diff --stat`：`6 files changed, 934 insertions(+), 80 deletions(-)`

---

## 10. 自動化測試

| 項目 | 結果 |
|---|---|
| backend `pytest` | **195 passed** |
| frontend `vitest` | **256 passed**（13 files） |
| frontend `npm run build`（`tsc -b && vite build`） | **通過**（僅 chunk > 500kB 既有警告） |

backend 測試涵蓋：number、`3-4`、`3-4;18-2`、`3-4;3-4`、bool/任意文字/空字串/formula/`3-7`/`3-4;`/>1024/`0-4`/`00-4`/`32-4`/`99-6`/`"4"` 拒、樣式/合併格/欄寬保留。

frontend 測試涵蓋：7 欄/月 fixture、三欄偵測、high-only 自動選、medium/low 不自動、`1月`vs`11月` 邊界、半形/全形斜線、手動切換、formatter 排序/同日重複/無效排除、validator、三欄預覽、D4 skip writes、無教材+缺欄降級、有教材+缺欄阻擋、三欄碰撞、異常教材阻擋、backend/fallback 同一批 writes、backend/fallback 實際產物一致。

---

## 11. 人工驗收

隔離環境：`/private/tmp/RollCall_Phase2_Manual.t8KboO`（`ROLL_CALL_DATA_DIR` 隔離；正式 DB / `app_backup.db` / 官方模板均未被觸碰）。

Synthetic 模板：
- 完整：`phase2_full_template.xlsx`（1月→直接服務 AQ / 教材 AT / 原因 AW；無教材列 AT7/AW7 預填 `KEEP-MATERIALS` / `KEEP-REASON`；C3 粗體+黃底、A 欄寬 24、月份合併格）
- 缺欄：`phase2_direct_only_template.xlsx`（僅直接服務欄）

匯出產物只讀檢查（`outputs/backend_export.xlsx`）：

| 學生 | AQ | AT | AW |
|---|---|---|---|
| Phase2 有教材（列 6） | **1** | **2** | **`2-4;3-2`** |
| Phase2 無教材（列 7） | **1** | **KEEP-MATERIALS** | **KEEP-REASON** |

- 非目標格：未改（全表 diff 僅 4 格變動：AQ6 / AT6 / AW6 / AQ7）
- 樣式：保留（C3 粗體 + 黃底 `00FFFF00`）
- 合併格：保留（36 = 36，`AQ1:AW1` 在）
- 欄寬：保留（A = 24）
- 三欄碰撞：阻擋
- 無教材 + 缺欄：允許 direct-only（顯示降級提示）
- 有教材 + 缺欄：阻擋

> 註：實際教材日期為 1/2、1/3（碼 4、碼 2），故 `AW6 = 2-4;3-2`；與腳本示意的 3/18 為輸入差異，經查邏輯正確、非 bug。

---

## 12. 官方模板 read-only 驗收

檔案：`test_artifacts/附件1_.xlsx_ 的副本 (2).xlsx`（read-only；未寫回、未複製、未輸出學生資料）。
predicate 與 DataPage 偵測邏輯一致，每月唯一且正確：

| 月份 | 直接服務 | 教材次數 | 原因 |
|---|---|---|---|
| 9月 | **O** | **R** | **U** |
| 1月 | **AQ** | **AT** | **AW** |
| 2月 | **AX** | **BA** | **BD** |
| 11月 | **AC** | **AF** | **AI** |
| 12月 | **AJ** | **AM** | **AP** |

---

## 13. Commit 與 push

```
commit : b60f4b2 feat(export): add materials service fields to Excel export
push   : git push origin main
結果   : 9343311..b60f4b2  main -> main

local HEAD  : b60f4b24ad3e78e9900dd7554ee7f11cac59ad23
origin/main : b60f4b24ad3e78e9900dd7554ee7f11cac59ad23
remote main : b60f4b24ad3e78e9900dd7554ee7f11cac59ad23
```

- 推送方式：精準 fast-forward（未帶 `--tags` / `--force` / `--all`）
- 本次 Phase 2 **未建立、未推送任何 tag**

---

## 14. 非阻塞備註（未來改善 / 已知限制）

1. **同源單一 port 架構下 backend 完全離線時，fallback chunk 可能無法載入**：production build `API_BASE_URL=""`（同源），fallback 的 xlsx-populate 為延遲載入 chunk，由同一 backend 提供；backend 完全離線時整個前端離線，fallback 無法救援下載。fallback 真正適用情境為「靜態檔可取得、但匯出 API 個別失敗」。fallback 寫檔一致性已由自動化測試覆蓋。
2. **切換目標月份後欄位不會自動重新分析**：目前需重新上傳模板才會以新月份重新偵測欄位（既有行為）。
3. **Phase 1 UX**：學年 override 不適用時仍顯示「手動」。
4. **Phase 1 UX**：學年回退提示字色偏淡。

> 以上皆非 Phase 2 阻塞項；Phase 1 UX 兩項屬既有事項，留待後續處理。
