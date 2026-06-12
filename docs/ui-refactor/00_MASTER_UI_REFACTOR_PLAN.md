---
title: "roll_call_system UI 重構總體規劃與文件命名規範"
project: "roll_call_system"
document_type: "UI refactor master plan"
language: "繁體中文"
updated_at: "2026-06-10"
status: "PLANNING_APPROVED_READY_FOR_PHASE_UI_1"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構總體規劃與文件命名規範

## 0. 文件用途

本文件作為 `roll_call_system` UI 重構工作的總綱，供後續 ChatGPT、Claude Code、Claude Design、Codex、Stitch 與其他輔助工具接手使用。

本文件記錄：

1. 為甚麼需要全面 UI 重構；
2. UI 重構的邊界；
3. 已確定的四階段工作安排；
4. 各工具的角色與權限；
5. 設計衝突時的停止規則；
6. 文件命名與排序規範；
7. 下一步應如何開始。

本文件是 UI 重構工作的主索引文件。後續所有細分文件均應依照本文件規則建立。

---

# 1. 當前專案基準

## 1.1 唯一基準版本

UI 重構必須以 RC11 完成狀態為唯一基準。

```text
PROJECT:
roll_call_system

BASELINE:
RC11_COMPLETE

LOCAL_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

TRACKING_ORIGIN_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

REMOTE_MAIN:
cb68c7d9121d508e890c7eb87f1f5e4c2a9559b9

AHEAD_BEHIND:
0 / 0

WORKTREE:
clean
```

RC11 tag：

```text
portable-release-candidate-11
→ 38846dc67591494d3a00ee9cfc45f7da0a181b51
```

RC11 artifact：

```text
release/RollCall_Portable_macOS_RC11.zip
```

SHA256：

```text
5aceca9e173cd5a483c390d979fb840e5ea6e473ed9034942d1f120dda483300
```

## 1.2 不得沿用的舊基準

早期 UI 重構文件曾以 RC8 作為凍結基準。該狀態已經過時。

後續不得再將：

```text
RC8
```

視為 UI 重構起點。

如舊文件中出現 RC8、舊 DataPage 狀態或舊驗收條件，必須先以 RC11 接手文件重新校正。

---

# 2. 為甚麼需要 UI 重構

目前 UI 的主要問題不是單一頁面不好看，而是缺乏由一開始就建立的全域設計系統。

專案早期採取邊想邊做、逐步增加功能的方式。不同階段曾使用 ChatGPT、Claude、Codex 等工具，導致部分介面規則在不同時期形成。

可能存在的問題包括：

```text
視覺規則不一致
字級層級不一致
間距尺度不一致
圓角與卡片規則不一致
按鈕層級不一致
相似操作使用不同互動方式
桌面、iPad 與窄螢幕策略不完全一致
Dark Mode 處理方式不完全一致
新增功能逐步疊加後，頁面資訊層級不足
相同概念由不同頁面各自實作
```

因此，UI 重構有合理必要性。

但重構目標不是：

```text
刪除現有前端
讓單一 AI 工具重新生成全站
直接覆蓋正式 repo
再慢慢修復功能倒退
```

正確目標是：

```text
保留已驗收功能與資料契約
        ↓
全面盤點現有 UI
        ↓
建立統一設計系統
        ↓
建立可回退的逐頁遷移流程
        ↓
逐步替換舊 UI 表達
        ↓
進行全站整合驗收
```

---

# 3. UI 重構的核心原則

## 3.1 重構的是 UI Layer，不是業務核心

允許大幅重構：

```text
設計語言
App Shell
導航
頁面 Layout
視覺層級
共用 UI 元件
Tokens
Spacing
Typography
Radius
Surface
Button Hierarchy
Status Badge
Sheet
Dialog
Form Layout
Responsive
Dark Mode
Loading
Empty
Error
```

原則上凍結：

```text
Backend API Contract
SQLite Schema
正式資料流程
Excel Mapping
Excel Template Contract
Export Endpoint
Backup
Lifecycle Lock
Runtime Lock Hygiene
Attendance Logic
Absence Logic
Makeup Logic
Extra Lesson Logic
Conflict Detection
MonthPage 批量生成
MonthPage Guarded 批量移除
MonthPage Dry-run Preview
MonthPage 二次確認
DataPage Row Matching
DataPage Preview / Confirm
DataPage Backend-primary Export
DataPage Browser Fallback
RC11 Native Date Overlay 行為
Release Scripts
Package Flow
```

## 3.2 設計工具不是決策者

所有工具輸出均屬於：

```text
候選方案
參考
Prototype
設計建議
```

不是自動批准的正式規格。

最終設計決策必須經過：

```text
ChatGPT 中控分析
        ↓
產品合理性判斷
        ↓
風險判斷
        ↓
使用者裁決
        ↓
寫入 DESIGN.md
```

## 3.3 不迎合原則

任何意見，不論來自使用者、ChatGPT、Claude Design、Stitch、Taste Skill、Open Design、Claude Code 或 Codex，都必須接受相同標準檢查。

評估標準：

```text
任務效率
防錯能力
資訊層級
跨頁一致性
桌面與 iPad 適配
窄螢幕可用性
Dark Mode
Accessibility
維護成本
實作風險
是否破壞已驗收功能
是否造成 Scope Creep
```

如某方案更漂亮，但增加高頻操作步驟、降低掃讀速度或破壞觸控可用性，應明確拒絕。

---

# 4. 設計方向

## 4.1 產品定位

不採用：

```text
完全模仿 iPhone App
```

採用：

```text
Apple-inspired Productivity Interface
```

中文定義：

> 具有 Apple 介面語彙，但針對桌面與 iPad 教學管理工作流優化的工具型介面。

核心特徵：

```text
低噪音
層級清晰
操作克制
狀態容易辨認
高頻操作步驟少
危險操作明確隔離
桌面版保持效率
iPad 觸控友善
窄螢幕仍可使用
Dark Mode 完整
動畫不干擾工作
```

避免：

```text
過度玻璃特效
大面積漸層
大量裝飾性動畫
過度卡片化
過度 Pill 化
裝飾性統計圖
不必要 Emoji
展示型網站式 Composition
只追求視覺效果而犧牲操作效率
```

---

# 5. 整體工作階段

UI 重構拆分為四個主階段。

```text
Phase UI-1
現有 UI 全面盤點、分析與評估

Phase UI-2
環境、文件、工具與工作流配置

Phase UI-3
統一設計系統建立與受控 UI 遷移

Phase UI-4
全站整合驗收、集中 Push 與新 RC 決策
```

每個主階段均有明確停止點。

---

# 6. Phase UI-1：現有 UI 全面盤點、分析與評估

## 6.1 目標

先理解目前 UI 的完整情況，不急於提出新設計，不修改程式碼。

此階段必須回答：

```text
目前有哪些頁面？
目前有哪些 Shared Components？
目前有哪些 Page-specific Components？
目前哪些規則已經一致？
目前哪些規則不一致？
哪些 UI 問題是真正需要修正？
哪些只是審美偏好？
哪些既有操作其實合理？
哪些地方必須保留？
哪些地方需要重新設計？
哪些地方涉及產品功能，不能混入 UI 重構？
```

## 6.2 唯讀 repo 盤點

Claude Code 應唯讀檢查：

```text
pwd
branch
HEAD
origin/main
remote main
ahead / behind
git status
git diff --check
listener inventory
backend/data 只允許 test -d
```

並盤點：

```text
routes
pages
layouts
shared components
page-specific components
CSS files
Tailwind usage
theme variables
dark mode rules
responsive breakpoints
sheets
dialogs
forms
tables
toasts
empty states
loading states
error states
existing frontend tests
```

## 6.3 畫面盤點

使用隔離 Synthetic Seed 保存核心狀態截圖。

### TodayPage

```text
有課堂
無課堂
未點名
已點名
缺席
補課
加課
停課
衝突
Toast
Undo
Sheet 開啟
Dark Mode
窄螢幕
iPad
```

### Students

```text
學生列表
空狀態
搜尋
篩選
學生詳情
固定課表
近期課堂
新增學生
編輯學生
Dark Mode
窄螢幕
```

### MonthPage

```text
一般月份
假期
停課
補課
衝突
月份切換
Native Date Picker 入口
批量生成
Dry-run Preview
批量移除
二次確認
iPad
Dark Mode
```

### Statistics / DataPage

```text
月份統計
教師服務範圍統計
學生表格
Sticky Header
月份選擇器
匯出入口
模板上傳
欄位辨識
Row Matching
Preview
Confirm
Error
Fallback Toast
Dark Mode
窄螢幕
```

### Settings / Maintenance

```text
備份
復原
維護操作
危險操作確認
錯誤狀態
```

## 6.4 Phase UI-1 產出

```text
UI 現況 Inventory
Page Map
Component Map
State Matrix
問題清單
Interaction Contract Freeze
Retain / Redesign / Challenge Matrix
Synthetic Seed Screenshot Archive
```

## 6.5 停止點

```text
只讀取
只盤點
只建立截圖與分析文件
不得修改 Source
不得 Commit
不得 Push
不得 Tag
不得 Package
不得操作正式 backend/data
```

---

# 7. Phase UI-2：環境、文件、工具與工作流配置

## 7.1 目標

建立後續 UI 重構所需的設計治理規則、工具分工、測試環境、文件架構與停止條件。

此階段確保：

```text
設計不漂移
工具不互相打架
正式資料不外洩
修改可回退
每頁可獨立驗收
所有重要決策有紀錄
```

## 7.2 必須配置

```text
ChatGPT 中控流程
Claude Code 執行規則
Codex Browser QA 規則
Claude Design 正式輸入格式
Synthetic Seed Lane
Screenshot Archive 結構
DESIGN.draft.md 骨架
衝突停止協議
專案專屬 UI Skill
```

## 7.3 Taste Skill 使用原則

Taste Skill 只作為規則來源，不作為產品決策者。

可吸收：

```text
Audit-first
Anti-slop
Design Drift Check
Spacing Consistency
Shape Consistency
Color Consistency
Theme Consistency
Loading / Empty / Error State
Strict Pre-flight
Accessibility
Reduced Motion
避免過度卡片化
避免過度 Pill 化
```

不直接照搬：

```text
展示型 Landing Page 規則
品牌網站式 Composition
自由提高 Layout Variance
大量 GSAP 動畫
裝飾型 Motion
自由更換資訊架構
自由重寫元件
```

建議建立：

```text
.claude/skills/roll-call-ui-refactor/SKILL.md
```

## 7.4 DESIGN.draft.md 骨架

建立：

```text
docs/ui-refactor/20_DESIGN_DRAFT.md
```

初期只建立章節，不預設具體答案。

章節包括：

```text
Product Language
Color Tokens
Typography Tokens
Spacing Tokens
Radius Tokens
Surface Hierarchy
Button Hierarchy
Status Semantics
Navigation
Sheet
Dialog
Toast
Empty State
Loading State
Error State
Responsive Rules
Dark Mode
Accessibility
Reduced Motion
Data Density
```

## 7.5 停止點

```text
可以建立治理文件
可以建立專屬 Skill
可以建立 Synthetic Seed Lane
可以建立 Screenshot Archive 結構
不得開始全站 UI 替換
不得改 Backend
不得改 DB
不得改 Excel Contract
不得 Push
不得 Tag
不得 Package
```

---

# 8. Phase UI-3：統一設計系統建立與受控 UI 遷移

Phase UI-3 不是單一步驟，必須拆分。

```text
UI-3A
Claude Design 視覺探索

UI-3B
中控分析與設計裁決

UI-3C
Stitch 局部壓力測試

UI-3D
批准 DESIGN.md 與專屬 Skill

UI-3E
Foundation 實作

UI-3F
逐頁遷移

UI-3G
高風險頁面獨立處理
```

---

## 8.1 UI-3A：Claude Design 視覺探索

Claude Design 作為主要設計工作台。

第一輪只探索代表畫面：

```text
Today Dashboard
Students List + Student Detail
Monthly Overview
```

這三組畫面足以驗證：

```text
視覺層級
列表
卡片
Grouped Section
Status Badge
Sheet
桌面密度
iPad 密度
窄螢幕
Calendar Grid
Dark Mode
```

每個畫面只建立少量 variants，例如：

```text
Variant A
保守整理：
保留結構，只整理 Hierarchy、Spacing、Surface

Variant B
中度重構：
重組資訊層級，提高掃讀效率

Variant C
較高密度：
針對 Desktop Productivity 優化
```

Claude Design 第一輪只接收：

```text
去識別化畫面
Synthetic Seed 截圖
頁面任務
既有功能流程
不得改變的互動規則
DESIGN.draft.md
```

不得提供：

```text
backend/data/
正式 SQLite
真實學生資料
正式 Excel 模板
release artifact
.env
```

---

## 8.2 UI-3B：中控分析與設計裁決

Claude Design 產出後，不立即實作。

必須回到 ChatGPT 中控審核：

```text
高頻操作步驟
資訊密度
掃讀速度
錯誤風險
Desktop
iPad
窄螢幕
Dark Mode
Accessibility
維護成本
元件重用
是否偏離功能契約
是否出現 Scope Creep
```

只選擇一套 Design Family。

不得將多套 Variant 的所有優點無限制拼接。

---

## 8.3 UI-3C：Stitch 局部壓力測試

Stitch 只作為第二意見與局部 Prototype 工具。

適合交給 Stitch：

```text
Sidebar vs Bottom Tab
Students Split View
Statistics Inline Expand vs Bottom Sheet vs Detail Page
MonthPage iPad 橫向
DataPage Confirm Flow
TodayPage 中密度 vs 高密度
```

不得讓 Stitch：

```text
重新生成全站
直接覆蓋正式 repo
修改 Backend
修改 DB
修改 Excel Contract
新增未批准功能
```

---

## 8.4 UI-3D：批准正式 DESIGN.md

主要方向確定後：

```text
docs/ui-refactor/20_DESIGN_DRAFT.md
```

升級為：

```text
docs/ui-refactor/30_DESIGN_APPROVED.md
```

如需要供工具直接讀取，可另建立固定入口：

```text
DESIGN.md
```

`DESIGN.md` 是 UI 層的 Single Source of Truth，但仍然低於：

```text
資料安全
功能契約
產品效率
```

---

## 8.5 UI-3E：Foundation 實作

先處理：

```text
Tokens
Theme
App Shell
Surface Hierarchy
Typography
Spacing
Radius
Button
Status Badge
List Row
Sheet
Dialog
Toast
Empty State
Loading State
Error State
```

不得一開始直接改 TodayPage、MonthPage 或 DataPage。

---

## 8.6 UI-3F：逐頁遷移

建議正式實作順序：

```text
1. Students List
2. Student Detail
3. Today Dashboard
4. Attendance Sheets
5. Session Add / Edit
6. MonthPage
7. Statistics
8. DataPage
9. Settings / Maintenance
```

### Students 先做的原因

Students 足以驗證：

```text
Page Shell
Search
List Row
Card
Status Badge
Grouped Section
Form
Sheet
Empty State
Responsive
Dark Mode
```

但風險低於 TodayPage、MonthPage 與 DataPage。

### DataPage 最後處理的原因

DataPage 涉及：

```text
官方模板
欄位 Gate
Row Matching
Preview
Confirm
Download
Backend-primary Export
Browser Fallback
Sticky Header
```

它不應成為新設計系統的試驗場。

---

## 8.7 UI-3G：頁面 Gate

每頁均必須依序執行：

```text
Read-only Preflight
        ↓
提出修改清單
        ↓
明確批准
        ↓
Claude Code 實作
        ↓
Targeted Tests
        ↓
Full Regression
        ↓
Frontend Build
        ↓
Synthetic Seed
        ↓
Codex Browser QA
        ↓
Diff QA
        ↓
本機 Commit
```

不得每個小 Phase 都 Push。

---

# 9. Phase UI-4：全站整合驗收、集中 Push 與新 RC 決策

## 9.1 目標

所有頁面完成遷移後，進行跨頁整合驗收。

## 9.2 必驗項目

```text
全站 Desktop QA
iPad QA
窄螢幕 QA
Dark Mode QA
Keyboard QA
Touch Target QA
Overflow QA
Loading / Empty / Error QA
Toast / Undo QA
Conflict Warning QA
功能回歸
Formal-data Safety Gate
Release Scripts Safety Gate
Diff QA
```

## 9.3 Git 與 Release

完成整合驗收後，才討論：

```text
Single Push Main
Tag
Package
新的 Portable Release Candidate
```

UI 重構期間：

```text
允許本機 Commit 作為安全節點
不在每個小 Phase 立即 Push
```

---

# 10. 工具分工

| 工具 | 角色 | 進場時間 | 不得自行執行 |
|---|---|---|---|
| ChatGPT | 中控、分析、裁決、Phase 管理、衝突停止、提示詞 | 全程 | 不直接替使用者批准有爭議方案 |
| Claude Code | Read-only Inventory、正式實作、測試、Synthetic Seed、本機 Commit | UI-1 起 | 不得自行改設計方向、Push、Tag、Package |
| Codex | 現況 Browser Audit、Browser QA、Diff QA、工程 Review、備援實作 | UI-1 起 | 不得自行改正式資料、Push、Tag、Package |
| Claude Design | 主設計工作台、Variants、Prototype、Handoff | UI-3A | 不得接觸正式資料，不得直接覆蓋 repo |
| Taste Skill | Anti-slop 與 QA 規則來源 | UI-2 | 不得成為產品決策者 |
| Stitch | 局部第二意見、Responsive Variants、Flow Prototype | UI-3C | 不得重新生成全站，不得直接覆蓋 repo |
| Open Design | 後期 Local-first Sandbox 與設計實驗室 | 第一批遷移穩定後 | 不得成為 UI-2 阻塞條件，不得接觸正式資料 |

---

# 11. 預設沿用、重新設計與待討論範圍

## 11.1 預設沿用

| 項目 | 判斷 |
|---|---|
| Apple-inspired Productivity UI | 沿用 |
| iOS Grouped 的低噪音語言 | 沿用 |
| Light / Dark Mode | 沿用 |
| Bottom Sheet | 沿用，但只用於範圍清楚的任務 |
| Action Sheet | 沿用，用於狀態操作 |
| Confirmation Dialog | 沿用，用於危險操作 |
| Toast + Undo | 沿用，但 Toast 不能承擔唯一錯誤資訊 |
| 非阻斷 Conflict Warning | 沿用 |
| 狀態不得只靠顏色辨認 | 沿用 |
| DataPage Sticky Header | 沿用 |
| MonthPage Calendar Grid | 沿用 |
| RC11 Native Date Overlay | 沿用，行為凍結 |
| Touch-friendly Interaction | 沿用 |
| Synthetic Seed 驗收 | 沿用 |

## 11.2 必須重新設計

```text
Tokens
字體層級
Spacing Scale
Radius Scale
Surface Hierarchy
Border
Shadow
Page Shell
Navigation
Page Header
Section Header
Button Hierarchy
Card 規則
List Row 規則
Status Badge
Empty State
Loading State
Error State
Sheet 結構
Form Field
Responsive Breakpoint
Desktop Density
iPad Density
Dark Mode 對應值
```

## 11.3 必須討論，不預設答案

| 問題 | 需討論原因 |
|---|---|
| Desktop 是否採 Sidebar | 可能提高效率，但會改變全域 Layout |
| 窄螢幕是否保留 Bottom Tab Bar | 需要與 Desktop 導航形成一致規則 |
| Students 是否採 Split View | Desktop 效率較高，但 iPad 直向需要不同策略 |
| TodayPage 卡片密度 | 太鬆降低掃讀速度，太密降低 Touch Usability |
| MonthPage 工具入口 | 必須避免破壞已驗收流程 |
| Statistics 明細展示 | Inline Expand、Sheet、Detail Page 各有取捨 |
| DataPage 摘要卡數量 | 過度卡片化會降低資料頁效率 |
| Accent Color | 必須與 Status Color 有足夠區分 |
| Motion Scale | 必須服務操作，不可作為裝飾 |

---

# 12. 正式資料安全規則

正式資料區：

```text
backend/data/
=
OPAQUE_PROTECTED_FORMAL_DATA_ZONE
```

常規盤點只允許：

```bash
test -d backend/data
```

禁止：

```text
列出 backend/data 內容
遍歷 backend/data
讀取正式 SQLite
stat 正式 DB
hash 正式 DB
複製正式 DB
將正式資料寫入 evidence
將正式資料推上 GitHub
將正式資料交給 Claude Design
將正式資料交給 Stitch
將正式資料交給 Open Design
```

所有截圖、Prototype、Browser QA 與 Flow Demo 均應使用 Synthetic Seed。

---

# 13. 衝突停止協議

## 13.1 必須停止的情況

```text
設計建議改變 API
設計建議改變 DB Schema
設計建議改變 Excel Contract
設計建議改變 Attendance 邏輯
設計建議改變 MonthPage 已驗收流程
設計建議改變 RC11 Native Date Overlay 行為
設計工具要求接觸真實學生資料
設計工具輸出與批准版 DESIGN.md 衝突
Claude Design 與 Stitch 提出互斥方案
更漂亮的方案明顯增加高頻操作步驟
iPad 與 Desktop 最佳方案無法同時成立
新 Dependency 收益不足以抵消維護成本
UI 重構開始混入功能新增
發現 Git refs、Tag、Artifact Hash、Listener 或 Evidence 與 RC11 handoff 不符
```

## 13.2 停止後回報格式

```text
CONFLICT_ID:
衝突名稱

CURRENT_CONTRACT:
目前規則

PROPOSAL:
新方案

BENEFIT:
收益

RISK:
風險

OPTIONS:
可選方案

RECOMMENDATION:
中控判斷

REQUIRED_DECISION:
需要使用者裁決的事項
```

如某方案不合理，必須明確標記：

```text
NOT RECOMMENDED
```

---

# 14. 文件命名與排序規劃

## 14.1 文件資料夾

所有 UI 重構文件建議集中放置：

```text
docs/ui-refactor/
```

## 14.2 命名規則

採用：

```text
NN_CATEGORY_TOPIC_STATUS.md
```

其中：

| 欄位 | 規則 |
|---|---|
| `NN` | 兩位數排序編號，依工作順序排列 |
| `CATEGORY` | 文件類型，例如 `MASTER`、`AUDIT`、`DESIGN`、`QA`、`PHASE` |
| `TOPIC` | 文件主題 |
| `STATUS` | 可選，例如 `DRAFT`、`APPROVED`、`COMPLETE` |

檔名使用：

```text
全大寫英文
底線分隔
避免空格
避免中文檔名
避免日期放入長期規劃文件名稱
```

日期、更新時間與狀態寫入 YAML frontmatter，不放入核心檔名。

## 14.3 編號區段

| 編號範圍 | 用途 |
|---:|---|
| `00–09` | 總綱、基準、治理規則 |
| `10–19` | Phase UI-1 現況盤點 |
| `20–29` | Phase UI-2 環境、工具與工作流 |
| `30–39` | Design System 與 Claude Design |
| `40–49` | 頁面遷移計劃 |
| `50–59` | Browser QA、驗收與 Diff QA |
| `60–69` | DataPage 獨立 Gate |
| `70–79` | 整合驗收、Push、Release |
| `80–89` | 決策紀錄、衝突紀錄、變更紀錄 |
| `90–99` | 接手文件、封存索引 |

## 14.4 建議文件清單

```text
docs/ui-refactor/
├── 00_MASTER_UI_REFACTOR_PLAN.md
├── 01_BASELINE_RC11_FREEZE.md
├── 02_UI_REFACTOR_CHARTER.md
├── 03_TOOL_RESPONSIBILITY_MATRIX.md
├── 04_CONFLICT_STOP_PROTOCOL.md
│
├── 10_CURRENT_UI_INVENTORY.md
├── 11_PAGE_MAP.md
├── 12_COMPONENT_MAP.md
├── 13_STATE_MATRIX.md
├── 14_CURRENT_UI_PROBLEM_REGISTER.md
├── 15_INTERACTION_CONTRACT_FREEZE.md
├── 16_RETAIN_REDESIGN_CHALLENGE_MATRIX.md
├── 17_SYNTHETIC_SEED_SCREENSHOT_INDEX.md
├── 18_PHASE_UI_1_ACCEPTANCE.md
│
├── 20_ENVIRONMENT_AND_WORKFLOW_SETUP.md
├── 21_SYNTHETIC_SEED_LANE_SPEC.md
├── 22_SCREENSHOT_ARCHIVE_RULES.md
├── 23_CLAUDE_CODE_EXECUTION_RULES.md
├── 24_CODEX_BROWSER_QA_RULES.md
├── 25_TASTE_SKILL_ADAPTATION.md
├── 26_ROLL_CALL_UI_SKILL_SPEC.md
├── 27_CLAUDE_DESIGN_INPUT_RULES.md
├── 28_STITCH_USAGE_RULES.md
├── 29_OPEN_DESIGN_EVALUATION.md
│
├── 30_DESIGN_DRAFT.md
├── 31_CLAUDE_DESIGN_BRIEF.md
├── 32_DESIGN_VARIANT_REVIEW.md
├── 33_STITCH_PRESSURE_TEST_REGISTER.md
├── 34_DESIGN_DECISION_LOG.md
├── 35_DESIGN_APPROVED.md
│
├── 40_FOUNDATION_MIGRATION_PLAN.md
├── 41_STUDENTS_LIST_MIGRATION.md
├── 42_STUDENT_DETAIL_MIGRATION.md
├── 43_TODAY_DASHBOARD_MIGRATION.md
├── 44_ATTENDANCE_SHEETS_MIGRATION.md
├── 45_SESSION_ADD_EDIT_MIGRATION.md
├── 46_MONTHPAGE_MIGRATION.md
├── 47_STATISTICS_MIGRATION.md
├── 48_DATAPAGE_MIGRATION.md
├── 49_SETTINGS_MAINTENANCE_MIGRATION.md
│
├── 50_SCREEN_ACCEPTANCE_MATRIX.md
├── 51_BROWSER_QA_REGISTER.md
├── 52_DIFF_QA_REGISTER.md
├── 53_REGRESSION_TEST_REGISTER.md
├── 54_ACCESSIBILITY_QA.md
├── 55_RESPONSIVE_DARK_MODE_QA.md
│
├── 60_DATAPAGE_SEPARATE_GATE.md
├── 61_DATAPAGE_EXPORT_CONTRACT_FREEZE.md
├── 62_DATAPAGE_ACCEPTANCE_REGISTER.md
│
├── 70_INTEGRATED_ACCEPTANCE_PLAN.md
├── 71_PRE_PUSH_GATE.md
├── 72_PUSH_AND_RELEASE_DECISION.md
├── 73_NEW_RC_ACCEPTANCE.md
│
├── 80_DECISION_LOG.md
├── 81_CONFLICT_REGISTER.md
├── 82_CHANGELOG_UI_REFACTOR.md
│
├── 90_UI_REFACTOR_HANDOFF.md
└── 91_ARCHIVE_INDEX.md
```

## 14.5 文件建立原則

不是一次建立全部文件。

只在進入對應 Phase 時建立必要文件。

例如：

```text
開始 UI-1
→ 建立 10–18

開始 UI-2
→ 建立 20–29

開始 UI-3
→ 建立 30–49

開始 UI-4
→ 建立 50–73

有決策或衝突
→ 持續更新 80–82

需要交接
→ 更新 90–91
```

## 14.6 文件狀態

每份文件 frontmatter 建議包含：

```yaml
---
title: ""
project: "roll_call_system"
document_type: ""
phase: ""
language: "繁體中文"
updated_at: "YYYY-MM-DD"
status: "DRAFT | APPROVED | COMPLETE | SUPERSEDED"
baseline: "RC11 COMPLETE"
---
```

如文件被新版本取代，不刪除舊文件，改為：

```yaml
status: "SUPERSEDED"
superseded_by: "XX_NEW_FILE.md"
```

---

# 15. Screenshot Archive 命名規劃

截圖不直接放在文件根目錄。

建議：

```text
docs/ui-refactor/screenshots/
├── ui-1-baseline/
├── ui-3-design-review/
├── ui-3-page-migration/
└── ui-4-integrated-acceptance/
```

截圖命名：

```text
NN_PAGE_STATE_VIEWPORT_THEME_SEQUENCE.png
```

例如：

```text
01_TODAY_NORMAL_DESKTOP_LIGHT_01.png
02_TODAY_CONFLICT_IPAD_DARK_01.png
03_STUDENTS_EMPTY_MOBILE_LIGHT_01.png
04_MONTHPAGE_BATCH_PREVIEW_DESKTOP_LIGHT_01.png
05_DATAPAGE_STICKY_HEADER_DESKTOP_DARK_01.png
```

Viewport 使用固定詞彙：

```text
DESKTOP
IPAD_LANDSCAPE
IPAD_PORTRAIT
MOBILE
NARROW
```

Theme 使用：

```text
LIGHT
DARK
```

---

# 16. Evidence Archive 規劃

UI 重構驗收 evidence 不應與正式 release artifact 混放。

建議：

```text
<EXTERNAL_EVIDENCE_ARCHIVE_ROOT>/
```

新增：

```text
UIRefactor_PhaseUI1_Audit_YYYY-MM-DD_<random>/
UIRefactor_PhaseUI2_Setup_YYYY-MM-DD_<random>/
UIRefactor_<PageName>_Migration_YYYY-MM-DD_<random>/
UIRefactor_IntegratedAcceptance_YYYY-MM-DD_<random>/
```

Evidence 只能包含：

```text
Synthetic Seed 截圖
測試結果
Build 結果
Diff QA
Browser QA
文件副本
```

不得包含：

```text
正式 DB
正式學生資料
backend/data 內容
真實模板敏感資訊
```

---

# 17. 下一步

目前應開始：

```text
Phase UI-1：
現有 UI 全面盤點、分析與評估
```

下一個執行動作：

```text
撰寫給 Claude Code 的
Phase UI-1 Read-only Inventory Prompt
```

Claude Code 首輪只允許：

```text
唯讀 repo inventory
唯讀 Git gate
唯讀 listener inventory
backend/data 只做 test -d
Synthetic Seed 規劃
現有畫面盤點規劃
建立 UI Audit 所需輸入
```

不得：

```text
修改 Source
修改 Docs
新增 Dependency
啟動全站重構
Commit
Push
Tag
Package
操作正式資料
```

---

# 18. 最終狀態

```text
CURRENT_UI_REFACTOR_STATUS:
PLANNING_APPROVED_READY_FOR_PHASE_UI_1

BASELINE:
RC11_COMPLETE

NEXT_PHASE:
PHASE_UI_1_CURRENT_UI_AUDIT

NEXT_REQUIRED_ARTIFACT:
PHASE_UI_1_READONLY_INVENTORY_PROMPT

NEXT_WRITE_ACTION:
無
```
