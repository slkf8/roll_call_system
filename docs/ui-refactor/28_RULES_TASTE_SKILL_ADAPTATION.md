---
title: "roll_call_system Taste Skill 適配規則"
project: "roll_call_system"
document_type: "Taste Skill adaptation rules"
phase: "PHASE UI-2E-1"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system Taste Skill 適配規則

## 0. 文件用途

```text
Taste Skill 是上游規則來源，不是產品決策者。
本專案只吸收適用規則，不直接整包套用。
專案治理文件、Interaction Contract Freeze、已批准決策與 DESIGN.md 優先級高於 Taste Skill。
```

優先級依 `26_MATRIX_TOOL_RESPONSIBILITY.md` §1 權限層級；衝突處理依 `27_PROTOCOL_CONFLICT_STOP.md`。

---

## 1. 整合策略

```text
UPSTREAM_ROLE:
REFERENCE_ONLY

DIRECT_INSTALL_IN_FORMAL_REPO:
DEFERRED

AUTO_UPDATE:
PROHIBITED

PROJECT_SPECIFIC_SKILL:
REQUIRED
```

理由：

```text
上游 Taste Skill 屬通用 frontend 規則
其中包含展示型網站、hero、landing-page、motion 與 GSAP 導向
roll_call_system 是桌面與 iPad 教學管理工具
需要較低 variance、較低 motion、較高 productivity density
外部規則更新不得自動覆蓋專案規格
```

---

## 2. 初步設計參數

```text
DESIGN_VARIANCE:
3 / 10

MOTION_INTENSITY:
2 / 10

VISUAL_DENSITY:
6 / 10
```

註明：

```text
這是 UI-2 初始校準值。
最終值可於 Claude Design 階段比較 variants 後調整。
任何調整需經中控裁決並寫入 DESIGN.md。
```

---

## 3. 必須吸收的原則

```text
Audit-first
Redesign existing project before coding
Color Consistency Lock
Shape Consistency Lock
Page Theme Lock
Spacing Consistency
Typography Hierarchy
Status Semantic Consistency
Loading / Empty / Error State
Accessibility
Reduced Motion
Design Drift Check
Strict Pre-flight
No silent route / navigation label / form-field change
Avoid generic AI-looking UI
Avoid decorative status dots without semantic meaning
```

以上原則與 Phase UI-1 實證發現高度對應（如 UI-F01–F03 的 theme / status / token drift、UIB2C-01 的裝飾性紅點問題），吸收後直接服務既有問題清單。

---

## 4. 需要專案化改寫的規則

| Upstream Rule | Project Adaptation | Reason |
|---|---|---|
| One accent color | 狀態色可以多於一種，但 accent 與 semantic status colors 必須分離 | 出席 / 缺席 / 待確認 / 停課 / 衝突需要穩定多色語義；accent（如 #007AFF 系）不得與狀態色混用 |
| One radius system | 採有限 radius scale，不要求所有元件完全相同 radius | 現況 2xl/[22]/[24]/[28] 混雜（M-G05）；收斂為 scale 而非單值 |
| Dark / light / auto page lock | 保留 Theme consistency；是否自動跟隨 OS 列為 CHALLENGE | M-G19 已列 CHALLENGE，待 Claude Design 比較 |
| Decorative status dots default zero | 保留；所有 dot 必須有 semantic 定義，Month Grid conflict / absent 必須分離 | DECISION-UI-001；UIB2C-01 實證 color-only 紅點問題 |
| Strong visual variance | 降低至 `3 / 10` | 教學管理工具求穩定可掃讀，非展示型網站 |
| Strong motion | 降低至 `2 / 10` | 動畫不得干擾高頻點名操作；Reduced Motion 友善 |
| Whitespace-heavy premium layout | Desktop 管理工具不可犧牲資訊密度 | UIB2B-04 已實證 1440px 兩側大量留白、一屏僅 4 卡 |
| Anti-slop card rules | 避免過度卡片化，但 table / grouped list 可保留 | DataPage 明細表與 grouped list 是工作主體（M-D02–D05） |
| Landing-page composition | 不適用於本專案 | 無行銷頁面 |
| Hero discipline | 不適用於本專案 | 無 hero 區塊 |

---

## 5. 不得直接照搬

```text
展示型 Landing Page Composition
Hero Discipline
大量 GSAP 動畫
Scroll Reveal
Sticky-stack 展示效果
Horizontal-pan 展示效果
高 Layout Variance
過量留白
每個區塊都改成大型 Card
為追求視覺效果而降低 Data Density
用裝飾性 Dot 代替清楚狀態語義
自由改 route
自由改 nav label
自由改 form field
自由新增 dependency
```

---

## 6. 本專案強制附加規則

```text
Apple-inspired Productivity Interface
Desktop 與 iPad 優先
Narrow viewport 可用
狀態不得只靠顏色
Month Grid conflict 與 absent 必須明確區分
Toast 不得作為唯一錯誤渠道
DataPage Table density 必須保留
DataPage Sticky Header 預設保留
RC11 native date / month overlay 行為凍結
Guarded bulk-remove backend health gate 凍結
Batch-generate preview / confirm 屬 Separate Product Feature Phase
正式資料不得進入 UI audit、prototype 或 screenshot
```

本節與 Taste Skill 任何規則衝突時，以本節為準。

---

## 7. 外部 Taste Skill 測試規則

```text
如日後需要測試外部 Taste Skill：
- 先在 throwaway lane 或 sandbox 測試
- 不直接安裝至 formal repo
- 不自動更新
- 不執行 npm / npx install，除非使用者另行批准
- 對照本文件逐條 review
- 有衝突立即 STOP_UI_TOOL_OUTPUT_CONFLICT
```

---

## 8. 更新規則

```text
Taste Skill 上游更新：
不得自動同步
不得默認覆蓋 project-specific SKILL.md
需人工 review
需記錄變更
需確認沒有改變 Freeze Contract
```

review 結論記錄於本文件（更新 `updated_at` 與變更說明），重大採納決策另記 `80_REGISTER_DECISIONS.md`。

---

## 9. 下一步

```text
下一步：
建立 Project-specific UI Skill Spec。
```
