# Roll Call TodayPage 日期選擇器與批量生成範圍 UX 完整開發驗收記錄

## 1. 功能背景與問題

問題 1：

TodayPage 在 iPad 上無法點開中間日期選擇器，只能逐次點擊左／右箭嘴切換日期。

問題 2：

批量生成固定課次原本鎖定在 `selectedDate` 所屬月份，無法直接快速選擇其他月份，亦無法自由生成跨月或跨年範圍。

## 2. 使用者確認後的需求

TodayPage：

- UI 維持原樣
- 不新增 Sheet
- 不重新設計
- 只修復 iPad 點擊中間日期後無法打開原生 picker

批量生成：

- 新增簡潔年份切換：`‹ 2026 年 ›`
- 新增 1-12 月 chips
- 選中狀態只以顏色顯示
- 不新增「本月」「已選月份」等文字
- 月份 chips 只作快速填入
- 保留開始日期與結束日期
- 允許手動修改
- 允許跨月
- 允許跨年

## 3. TodayPage 技術修正

原本問題：

`input type="date"` 使用零尺寸隱藏 input：

- `w-0`
- `h-0`
- `opacity-0`
- `pointer-events-none`
- `-z-10`

並依賴程式化：

- `showPicker()`
- 或 `input.click()`

修改後：

日期文字區：

- `relative` 容器

可見日期文字：

- `span`

透明 `input type="date"` overlay：

- `absolute`
- `inset-0`
- `h-full`
- `w-full`
- `opacity-0`
- `cursor-pointer`

安全點：

- input 不在 button 內
- 無互動元素巢狀
- 無 `input.click()` recursion
- `showPicker()` 如存在，只作 desktop enhancement
- overlay 只覆蓋日期文字
- 左右箭嘴與「回到今天」保留
- 視覺 UI 不變

## 4. StudentsPage 批量生成 UX

新增：

- `batchChipYear`
- 年份左右切換
- 1-12 月 chips
- 4 x 3 grid
- 月份 chips 快速填入
- 完整月份高亮判斷

規則：

年份切換：

- 只修改 `batchChipYear`
- 不立即改變開始／結束日期

點擊月份：

- 填入該年該月 1 日至月底

完整月份：

- 對應 chip `aria-pressed=true`
- 使用主題色高亮

手動改為部分月份、跨月或跨年：

- 所有月份 chip 取消高亮

## 5. 解除同月限制

移除：

- `isSameMonth(batchFromDate, selectedDate)`
- `isSameMonth(batchToDate, selectedDate)`
- 「請選擇本月範圍內的日期」
- 開始日期 input `min/max`
- 結束日期 input `min/max`

保留：

- 開始日期不得為空
- 結束日期不得為空
- 開始日期不得晚於結束日期

## 6. 保持不變的安全規則

- 只處理 active students
- 只使用 active schedule rules
- 只新增 regular sessions
- 避免重複 regular
- 只 append
- 不刪除 sessions
- 不修改 makeup
- 不修改 extra

## 7. UI 文案更新

原本：

- 批量生成本月 regular

修改後：

- 批量生成固定課次

副標：

- 在指定日期範圍內，依固定課表補齊課次。

說明：

- 同學生、同日期、同開始時間的固定課次會自動略過，不會重複生成。

底部提示：

- 只會補齊缺少的固定課次，不影響補課與加課。

## 8. 實際修改檔案

- `frontend/src/pages/StudentsPage.tsx`
- `frontend/src/pages/TodayPage.tsx`
- `frontend/src/pages/__tests__/StudentsPage.test.tsx`
- `frontend/src/pages/__tests__/TodayPage.sessionsBackend.test.tsx`

## 9. 自動化測試

targeted frontend：

- 2 files passed
- 112 tests passed

完整 frontend：

- 13 files passed
- 271 tests passed

frontend build：

- `tsc -b && vite build` 通過

既有非阻塞 warning：

- Node：`--localstorage-file was provided without a valid path`
- Vite：chunk > 500 kB

兩者均非本次阻塞。

## 10. iPad 真機驗收

TodayPage：

- 中間日期可點開
- 原生日期 picker 正常彈出
- 選擇日期後正常切換
- 左箭嘴正常
- 右箭嘴正常
- 回到今天正常
- UI 維持原樣
- 無異常

## 11. 批量生成 UI 驗收

Sheet：

- 年份切換正常
- 1-12 月 chips 正常
- 選中月份只用顏色高亮
- 切換年份後日期保持不變
- 2028-02 正確填入 2028-02-01 至 2028-02-29
- 2027-02 正確填入 2027-02-01 至 2027-02-28
- 2027-04 正確至 04-30
- 2027-05 正確至 05-31
- 跨月日期可以輸入
- 跨月後 chips 全部取消高亮
- 跨年日期可以輸入
- 無異常

## 12. Chrome UI spot-check

虛構資料：

學生：

- BatchUX SpotCheck

固定課表：

- 星期一
- 10:00
- 60 分鐘
- 啟用

跨月結果：

範圍：

- 2027-07-26 至 2027-08-09

BatchUX SpotCheck：

- 2027-07-26 10:00
- 2027-08-02 10:00
- 2027-08-09 10:00

每個日期均只有 1 節，無重複。

重複生成：

- 第二次使用相同範圍生成
- 範圍內沒有可新增的 regular 課次
- 已存在課次被略過
- dedup 正常

跨年結果：

範圍：

- 2027-12-20 至 2028-01-10

BatchUX SpotCheck：

- 2027-12-20 10:00
- 2027-12-27 10:00
- 2028-01-03 10:00
- 2028-01-10 10:00

preservation：

補課：

- 2027-08-04 15:00-16:00
- 仍存在，未修改，未刪除

加課：

- 2027-08-05 16:00-17:00
- 仍存在，未修改，未刪除

## 13. 驗收環境備註

隔離資料夾：

- `/private/tmp/RollCall_BatchUX_iPad_Manual.lRLFZQ`

source app：

- 由使用者在 macOS Terminal 前景啟動

Tailscale Serve：

- `https://soumacbook-pro.tailcb0735.ts.net`
- 代理至 `http://127.0.0.1:8000`

sandbox 限制：

Codex sandbox 內 `curl 127.0.0.1:8000` 失敗，但使用者 Terminal、瀏覽器與 Tailscale 請求均成功。判定為 sandbox localhost namespace 限制，不是 backend 啟動失敗。

automation caveat：

Chrome automation 使用程式式 `fill()` 時，曾未正確觸發 React controlled input state，誤建立一筆隔離 extra：

- 2027-08-09 00:15

人工實際鍵入後正常。該資料只存在 `/private/tmp` 隔離 DB，不屬於產品 bug。

## 14. Commit 與 push

commit：

- `e47ac78 feat(schedule): improve date picker and batch generation UX`

完整 hash：

- `e47ac7890b0e8acb766c48053a046b3ae69680a0`

parent：

- `e8587323d3cc71e6d450c43c9368caa6e021804d`

push：

- `git push origin main`

結果：

- `e858732..e47ac78 main -> main`

local HEAD：

- `e47ac7890b0e8acb766c48053a046b3ae69680a0`

origin/main：

- `e47ac7890b0e8acb766c48053a046b3ae69680a0`

remote main：

- `e47ac7890b0e8acb766c48053a046b3ae69680a0`

## 15. 後續建議

1. 建立 docs-only commit 並 push
2. 規劃 macOS RC7 build / package / 驗收
3. RC7 驗收通過後，以 RC7 取代 RC6 運行
4. 清理本次 `/private/tmp` 隔離資料
