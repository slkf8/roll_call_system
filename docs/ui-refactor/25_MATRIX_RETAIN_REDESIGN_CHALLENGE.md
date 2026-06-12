---
title: "roll_call_system UI 保留、重設計與待比較矩陣"
project: "roll_call_system"
document_type: "retain redesign challenge matrix"
phase: "PHASE UI-2C"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 保留、重設計與待比較矩陣

## 0. 文件用途

本矩陣將現有 UI 的每個重要區域分類為保留、重設計、待比較或凍結，作為 Phase UI-3（Claude Design 探索與裁決）的固定輸入。分類依據：`10_AUDIT_CURRENT_UI_INVENTORY.md` 的 evidence-based 發現（UI-F 系列）、`20`/`21` QA 的 browser 實證（UIB2B / UIB2C 系列）、`23_CHARTER_UI_REFACTOR.md` 凍結範圍與 `24_CONTRACT_INTERACTION_FREEZE.md` 互動契約。

---

## 1. Matrix 分類

```text
FREEZE:
行為或安全契約不得改變。

RETAIN:
現有方向合理，預設保留。

REDESIGN:
確認需要重設計。

CHALLENGE:
存在多個合理方案，需於 Claude Design / Stitch 階段比較。

SEPARATE_PRODUCT_FEATURE:
已批准，但不得混入 UI restyle。

DEFER:
現階段不處理，留待對應頁面遷移或獨立 Phase。
```

---

## 2. Matrix 欄位

```text
ID
Area
Current State
Classification
Reason
Allowed During UI Restyle
Needs Claude Design Comparison
Needs Separate Product Feature Phase
Acceptance Notes
```

下表中「Restyle 允許」= Allowed During UI Restyle；「CD 比較」= Needs Claude Design Comparison；「獨立 Phase」= Needs Separate Product Feature Phase。

---

## 3. Global Matrix

| ID | Area | Current State | Classification | Reason | Restyle 允許 | CD 比較 | 獨立 Phase | Acceptance Notes |
|---|---|---|---|---|---|---|---|---|
| M-G01 | Semantic design tokens | 無 token 層；500+ 處 hard-coded hex（UI-F03） | REDESIGN | 無單一色彩 / 間距 / 圓角來源，drift 嚴重 | 建立 token 層並逐步替換 | yes | no | 替換後視覺 diff 須經 screenshot 對比 |
| M-G02 | Theme layer | isDark boolean ternary ×287 處（UI-F01） | REDESIGN | 每個 surface 自行決定顏色，無法統一 retheme | 改為 token / variant 驅動 | yes | no | `rollcall-theme` persistence 行為凍結 |
| M-G03 | Typography scale | 任意 text-[NNpx]，最小 10–11px（UIB2B-03） | REDESIGN | 無層級系統；tab label 11px / 標題 28–34px 失衡 | 建立 type scale | yes | no | 中文可讀性優先 |
| M-G04 | Spacing scale | 任意 px/rem 混用 | REDESIGN | 無間距尺度 | 建立 spacing scale | yes | no | — |
| M-G05 | Radius scale | rounded-2xl / [22px] / [24px] / [28px] 並存 | REDESIGN | 圓角規則不一致 | 建立 radius scale | yes | no | — |
| M-G06 | Surface hierarchy | page / card / secondary 三層 helper，但常被 inline hex 繞過 | REDESIGN | helper 與 inline 並存（UI-F03） | 統一 surface tokens | yes | no | — |
| M-G07 | Button hierarchy | IconButton 4 tones + 各頁自製按鈕樣式 | REDESIGN | 同類按鈕多套樣式（UI-F02 旁證） | 建立 primary/secondary/danger 層級 | yes | no | 44px 觸控目標下限 |
| M-G08 | Status semantic model | Pill（shared）+ Students badge + Data badge 三套（UI-F02） | REDESIGN | 同一狀態跨頁表達不同；多 source of truth | 收斂為單一 status token 模型 | yes | no | 狀態必須 文字/圖示+色，不得 color-only |
| M-G09 | Empty state | 僅 PlaceholderCard + 零散文字 | REDESIGN | 無系統化 empty 規格（UI-F09） | 建立 empty state 元件 | yes | no | — |
| M-G10 | Loading state | 無 spinner / skeleton；靜默降級 | REDESIGN | 載入無回饋（UI-F09） | 建立 loading 規格 | yes | no | 不得阻斷 fallback 行為 |
| M-G11 | Inline error | 錯誤幾乎只靠 Toast | REDESIGN | Toast 不得為唯一錯誤渠道（charter §7 沿用規則） | inline error / banner 規格 | yes | no | 與 M-D06 連動 |
| M-G12 | Toast | 頂部 6s 自動消失，全域單一 | RETAIN | 行為合理；非唯一渠道後保留 | 樣式微調 | no | no | 行為凍結（contract §2） |
| M-G13 | App Shell | 單 shell：max-w-4xl 置中 + pb-28 + 固定 BottomTabBar | REDESIGN | 桌面 1440 兩側 ~270px 空白（UIB2B-04） | 重排 shell 密度 / 寬度策略 | yes | no | 四 tab 入口不得遺失 |
| M-G14 | Desktop navigation | BottomTabBar（行動式樣式用於桌面） | CHALLENGE | Sidebar 可能更高效，但改變全域 layout | 探索 variants | yes | no | DECISION 待 UI-3B 裁決 |
| M-G15 | Narrow navigation | BottomTabBar 浮動覆蓋內容（UIB2B-05） | CHALLENGE | 保留 vs 重構（遮擋問題） | 探索 variants | yes | no | — |
| M-G16 | BottomTabBar | 4 tab + 「更多」overflow scaffold；label 11px | CHALLENGE | 與 M-G14/15 連動裁決 | 視覺重設計 | yes | no | overflow scaffold 行為保留 |
| M-G17 | Responsive breakpoints | 無全域策略；sm/md/lg 僅 Data(19)/Month(7)/Students(1)，Today=0（UI-F04） | REDESIGN | 各頁自理或完全沒有 | 建立全域 breakpoint 規格 | yes | no | iPad 直橫 + NARROW 390 必驗 |
| M-G18 | Dark Mode strategy | JS ternary 全手寫；不響應 OS（UIB2B-08） | REDESIGN | 架構性債務；與 M-G02 同改 | token 化 dark 對應值 | yes | no | 現有深色視覺基調可沿用 |
| M-G19 | OS theme auto-follow | 不支援 prefers-color-scheme | CHALLENGE | 自動跟隨 vs 手動切換的產品選擇 | 設計階段比較 | yes | no | 不得移除手動切換 |
| M-G20 | Icon system | ~20 個手寫 inline SVG；MonthPage 另有頁內 icon（UI-F10） | RETAIN | 風格統一、無依賴；僅需歸位重複項 | 整併頁內重複 icon | no | no | 不引入 icon 庫（新 dependency 需批准） |

---

## 4. TodayPage Matrix

| ID | Area | Current State | Classification | Reason | Restyle 允許 | CD 比較 | 獨立 Phase | Acceptance Notes |
|---|---|---|---|---|---|---|---|---|
| M-T01 | Today SessionCard | 大時間字 + 名字 + 右側 pill/按鈕群；一屏約 4 卡 | REDESIGN | 桌面密度低（UIB2B-04）；卡片層級可優化 | 重設計卡片 | yes | no | 出席/缺席/更多操作與狀態語義凍結 |
| M-T02 | Conflict Pill | 琥珀色 ⚠ + 「衝突」文字 | RETAIN | 圖示+文字，非 color-only（UIB2C-03 好模式） | 微調樣式 | no | no | month grid 須對齊此模式（M-M04） |
| M-T03 | Card badge cluster | 衝突 + 狀態 pill 同列右上，1440 已擁擠（UIB2C-06） | REDESIGN | 窄幅將換行混亂 | 重排 badge 佈局 | yes | no | 資訊不得刪減 |
| M-T04 | Absence Sheet | 備註 + 原因 chips + 教材 chips + 完成按鈕 | RETAIN | 結構清楚；validation 完整 | 視覺 polish | no | no | 教材 reason-6 學年 gate 凍結 |
| M-T05 | Menu（card ⋯） | 內嵌下拉 Menu（補課/加課/停課/編輯/刪除） | CHALLENGE | Menu vs action sheet 模式重疊（UI-F08） | 比較統一模式 | yes | no | menu 項目能力不得遺失 |
| M-T06 | Toast + Undo | 操作後 toast + 卡上撤銷鈕 | RETAIN | 行為合理 | 樣式微調 | no | no | 行為凍結 |

---

## 5. StudentsPage Matrix

| ID | Area | Current State | Classification | Reason | Restyle 允許 | CD 比較 | 獨立 Phase | Acceptance Notes |
|---|---|---|---|---|---|---|---|---|
| M-S01 | Students list | 卡片列 + 狀態統計卡 ×4 | REDESIGN | 統計卡佔位大；列密度低 | 重排列表 | yes | no | 篩選/統計能力凍結 |
| M-S02 | Search | 姓名/生日/學校/ID 即時過濾 | RETAIN | 功能完整 | 樣式微調 | no | no | — |
| M-S03 | Filter | SegmentedControl 四檔 | RETAIN | 模式合理 | 樣式微調 | no | no | — |
| M-S04 | ThemeToggle placement | Students 頁缺 ThemeToggle（UIB2B-01） | REDESIGN | 全域控制不一致；用戶在此頁無法切換 | 統一放置策略 | yes | no | 與 M-G14 shell 裁決連動 |
| M-S05 | Student Detail Sheet | 全高 sheet，底部內容被裁（UIB2B-06） | CHALLENGE | Sheet vs Detail Page vs Split View | 三方案比較 | yes | no | 欄位與 CRUD 不得遺失（contract §4） |
| M-S06 | Desktop split view | 不存在 | CHALLENGE | 桌面效率潛力 vs iPad 直向策略 | 探索 variant | yes | no | — |
| M-S07 | Fixed schedule Sheet | 新增固定課表 sheet（週期/時間/時長/狀態） | RETAIN | 表單結構合理 | 視覺 polish | no | no | 規則 CRUD 與生成能力凍結 |

---

## 6. MonthPage Matrix

| ID | Area | Current State | Classification | Reason | Restyle 允許 | CD 比較 | 獨立 Phase | Acceptance Notes |
|---|---|---|---|---|---|---|---|---|
| M-M01 | Calendar Grid | 7 欄日格 + n/m 摘要 | RETAIN | master plan 明定沿用 | 密度/視覺微調 | no | no | 結構凍結傾向 |
| M-M02 | Month nav controls | ‹ › 32×32（UIB2B-02） | REDESIGN | 低於 44px 觸控下限；跨頁不一致 | 放大+統一 | yes | no | ≥44px |
| M-M03 | Native month overlay | RC11 透明 input 覆蓋 | FREEZE | RC11 驗收行為 | 不可改 | no | no | contract §2 |
| M-M04 | Conflict marker | 角落紅點，color-only（UIB2C-01） | REDESIGN | DECISION-UI-001：不得只靠顏色；與 absent 紅點同形同色 | icon/shape/短文字方案 | yes | no | 必須與 M-M05 可區分 |
| M-M05 | Absent marker | 紅點 + 數字（●1） | CHALLENGE | 保留 dot vs 換表達；與 M-M04 連動 | 比較方案 | yes | no | 不得與 conflict 同形 |
| M-M06 | Holiday marker | 日格灰字「假期/停課」 | RETAIN | 文字標記可辨認（UIB2C-04 部分良好） | 樣式微調 | no | no | — |
| M-M07 | Affected-count secondary info | 全日事件後課次數被隱藏（UIB2C-04） | CHALLENGE | 「影響幾堂」資訊消失 vs 簡潔 | 比較呈現 | yes | no | — |
| M-M08 | Batch generate（現行 direct execution） | 範圍選擇後直接執行（local 直寫） | FREEZE | 現行行為凍結；改流程屬獨立 phase | 不可改流程 | no | no | 不得錯寫成已有 preview |
| M-M09 | Batch generate preview / confirm（未來） | 不存在 | SEPARATE_PRODUCT_FEATURE | DECISION-PF-001 | 不得實作 | no | yes | preview 須含日期範圍/學生數/新增數/跳過數/衝突數 |
| M-M10 | Guarded bulk-remove | 範圍 → 權威預覽 → 紅色二次確認 | FREEZE | 已驗收破壞性流程 | 視覺微調僅限不削弱 | no | no | 流程與文案語義凍結 |
| M-M11 | Bulk-remove offline affordance | 離線僅 6s toast（UIB2C-02） | REDESIGN | toast-only 回饋不足 | menu 內 inline 不可用狀態 | yes | no | health gate 本身凍結（M-M12） |
| M-M12 | Bulk-remove backend health gate | 入口 fresh GET /health，fail-closed | FREEZE | charter §4 明定 | 不可改 | no | no | UIB2C 已實證正確 |
| M-M13 | Bulk-remove second confirm | 紅色 danger sheet「確認移除課次？」 | FREEZE | 危險操作 gate | 視覺可 polish、不得弱化 | no | no | — |

---

## 7. DataPage Matrix

| ID | Area | Current State | Classification | Reason | Restyle 允許 | CD 比較 | 獨立 Phase | Acceptance Notes |
|---|---|---|---|---|---|---|---|---|
| M-D01 | Statistics toolbar | 月份 nav（上一個月/回到本月/下一個月）+ 月標題 | REDESIGN | contract §6 允許 toolbar layout 重排 | 重排 | yes | no | 月份切換能力凍結 |
| M-D02 | Monthly stats | 摘要卡 ×5 + 每學生明細表 | RETAIN | 資訊結構合理 | 卡數/密度依 M-D05 | no | no | 統計口徑凍結 |
| M-D03 | Teacher service range | range 起訖選擇 + 總次數卡 | RETAIN | 功能合理 | 樣式微調 | no | no | 統計邏輯凍結 |
| M-D04 | Sticky Header | th sticky top-0，scroll 實證正常（UIB2B 17） | RETAIN | master plan 明定沿用 | 樣式微調 | no | no | sticky 行為必須保留 |
| M-D05 | Table visual density | sm: 斷點最多的頁；明細表偏密 | CHALLENGE | 密度 vs 可讀性 / summary card 數量平衡 | 比較密度方案 | yes | no | 與 open question 連動 |
| M-D06 | Fallback banner | 小號橙字，易忽略（UIB2B-07） | REDESIGN | 本地模式唯一持久訊號太弱 | 強化層級 | yes | no | banner 觸發邏輯凍結 |
| M-D07 | Template upload | 選擇 xlsx → 工作表 select | FREEZE | export contract 一環 | 視覺微調僅限 | no | no | — |
| M-D08 | Column gate | 欄位辨識 + 確認 selects | FREEZE | contract §6 | 同上 | no | no | — |
| M-D09 | Row matching | 姓名+生日 key | FREEZE | contract §6 | 不可改 | no | no | — |
| M-D10 | Preview / Confirm | 填入前預覽確認 | FREEZE | contract §6 | 視覺微調僅限 | no | no | — |
| M-D11 | Backend-primary export | 後端優先填表 | FREEZE | contract §6 | 不可改 | no | no | — |
| M-D12 | Browser fallback | xlsx-populate 備援 | FREEZE | contract §6 | 不可改 | no | no | — |
| M-D13 | Open Design integration | 未引入 | DEFER | charter §8：不作 Phase UI-2 阻塞 | 不處理 | no | no | 第一批遷移穩定後評估 |

---

## 8. 必須分類對照表（合規檢查）

| Item | Required Classification | 本文件對應 |
|---|---|---|
| Semantic design tokens | REDESIGN | M-G01 ✓ |
| Theme layer | REDESIGN | M-G02 ✓ |
| Status semantic model | REDESIGN | M-G08 ✓ |
| Responsive breakpoints | REDESIGN | M-G17 ✓ |
| Empty / Loading / Inline Error | REDESIGN | M-G09/G10/G11 ✓ |
| Month Grid conflict marker | REDESIGN | M-M04 ✓ |
| Month Grid absent marker | CHALLENGE | M-M05 ✓ |
| Month nav controls | REDESIGN | M-M02 ✓ |
| DataPage Sticky Header | RETAIN | M-D04 ✓ |
| RC11 native date / month overlay | FREEZE | M-M03（+ contract §2）✓ |
| Conflict detection logic | FREEZE | contract §3/§5；本表 M-T02/M-M04 僅及表達層 ✓ |
| DataPage Excel contract | FREEZE | M-D07–D12 ✓ |
| DataPage row matching | FREEZE | M-D09 ✓ |
| DataPage export strategy | FREEZE | M-D11/D12 ✓ |
| Guarded bulk-remove backend health gate | FREEZE | M-M12 ✓ |
| MonthPage batch-generate preview / confirm | SEPARATE_PRODUCT_FEATURE | M-M09 ✓ |
| Desktop Sidebar vs BottomTabBar | CHALLENGE | M-G14 ✓ |
| Students Detail Sheet vs Detail Page vs Split View | CHALLENGE | M-S05/S06 ✓ |
| OS theme auto-follow | CHALLENGE | M-G19 ✓ |
| Open Design integration | DEFER | M-D13 ✓ |

---

## OPEN QUESTIONS FOR CLAUDE DESIGN

```text
Desktop 是否採 Sidebar？
窄螢幕是否保留 BottomTabBar？
Students Desktop 是否採 Split View？
Month Grid conflict marker 用 icon、shape 還是短文字？
Absent marker 是否保留 dot？
Holiday cell 是否保留 affected-count secondary info？
DataPage summary card 數量與 table density 如何平衡？
Students Detail Sheet 是否需要改為較短 Sheet 或 Detail Page？
OS theme 是否自動跟隨？
```

以上問題一律以 variants 形式提交中控裁決，不得由設計工具單方面定案。
