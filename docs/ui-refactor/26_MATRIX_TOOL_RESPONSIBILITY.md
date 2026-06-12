---
title: "roll_call_system UI 重構工具責任矩陣"
project: "roll_call_system"
document_type: "tool responsibility matrix"
phase: "PHASE UI-2D"
language: "繁體中文"
updated_at: "2026-06-10"
status: "APPROVED"
baseline: "RC11 COMPLETE"
---

# roll_call_system UI 重構工具責任矩陣

## 0. 文件用途

```text
本文件以能力角色而非固定模型名稱分工。
工具輸出是候選方案，不是自動批准的正式規格。
任何工具不得越過功能契約、正式資料規則與中控裁決。
```

本文件是 `23_CHARTER_UI_REFACTOR.md` §8（工具角色）的展開版，定義各角色的允許範圍、禁止事項、交接要求與權限矩陣。

---

## 1. 權限層級

```text
第一層：
正式資料安全、Backend Contract、DB Schema、Excel Contract、Release Safety

第二層：
已批准的 Interaction Contract Freeze

第三層：
已批准產品決策與 DESIGN.md

第四層：
Page-level Prototype 與 Migration Plan

第五層：
工具生成的建議、Variant 與視覺探索
```

規則：

```text
下層不得推翻上層。
有衝突必須停止。
```

---

## 2. 能力角色總覽

| Capability Role | Preferred Tool | Fallback Tool | Allowed Work | Forbidden Work | Required Handoff |
|---|---|---|---|---|---|
| 中控、產品判斷、衝突裁決 | ChatGPT | 使用者最終裁決 | 分析、裁決、Phase 管理、提示詞 | 默認批准爭議方案、偷渡 feature | Phase 提示詞（§11 格式） |
| Repo inventory、文件建立、實作、測試 | Claude / Claude Code | Codex | 唯讀盤點、批准文件、批准實作、測試 | 自改設計方向、自增 dependency、push/tag/package | 最終回報 + Changed Files Gate |
| Browser QA、截圖、responsive、dark mode、overflow | Claude | Codex | 隔離 lane synthetic QA、screenshot、evidence | 接觸正式資料、操作 live process | manifest + audit findings |
| 對抗式 Diff Review、scope creep 檢查 | Codex | Claude | diff review、scope 檢查、測試缺口 review | 自行擴大 scope、推翻 DESIGN.md | review findings |
| 主要視覺探索、prototype、design handoff | Claude Design | Stitch | variants、prototype、handoff | 修改 repo、決定 product feature | variants + 設計說明 |
| 局部 layout 第二意見、flow 壓力測試 | Stitch | Claude Design | 指定局部 variants、壓力測試 | 重新生成全站、覆蓋 repo | 局部 variants |
| Anti-slop、design drift 規則來源 | Taste Skill | 專案專屬 Skill | 規則吸收（見 §8） | 產品決策 | 規則清單 |
| 後期 sandbox、local-first design experiment | Open Design | 不設強制備援 | DEFER（見 §9） | 作為 UI-2 阻塞條件 | — |

---

## 3. ChatGPT 中控角色

允許：

```text
分析需求
拒絕不合理建議
拆分 Phase
維護 scope
判斷是否停下
提出 Product Decision
撰寫執行提示詞
整合重要節點文件
決定何時進入 Claude Design
決定何時允許 commit / push / tag / package
```

禁止：

```text
把使用者偏好直接視為正確答案
繞過正式資料規則
默認批准有爭議方案
把 Product Feature 偷渡進 UI restyle
```

---

## 4. Claude / Claude Code

允許：

```text
唯讀 inventory
建立批准文件
建立 throwaway lane
Synthetic Seed Browser QA
截圖
Evidence 整理
依批准規格修改 source
執行 targeted tests
執行 full regression
執行 build
建立本機 commit（只在中控批准後）
```

禁止：

```text
自行改設計方向
自行新增 Product Feature
自行新增 dependency
自行接觸正式資料
自行 push
自行 tag
自行 package
自行覆蓋 artifact
自行操作 live process
使用 killall / pkill / 模糊 grep kill
```

---

## 5. Codex

定位：

```text
可選額外 QA 層
不是 Browser QA 的強制前置條件
```

允許：

```text
對抗式 Diff Review
scope creep 檢查
Browser QA 備援
responsive / dark mode / overflow 檢查
測試缺口 review
工程風險 review
```

禁止：

```text
因額度可用而自行擴大 scope
自行修改正式資料
自行 push / tag / package
推翻已批准 DESIGN.md
```

---

## 6. Claude Design

允許：

```text
視覺語言探索
Prototype
少量有差異的 Variants
Month Grid marker 比較
Desktop navigation 比較
Students detail layout 比較
Responsive variants
Dark Mode variants
Design handoff
```

輸入只允許：

```text
Synthetic screenshots
去識別化資料
Interaction Contract Freeze
Retain / Redesign / Challenge Matrix
DESIGN.draft.md
```

禁止提供：

```text
backend/data/
正式 DB
真實學生資料
正式 Excel 模板
.env
release artifact
```

禁止：

```text
自行修改 repo
自行決定 Product Feature
推翻 Freeze Contract
```

---

## 7. Stitch

定位：

```text
局部第二意見
不是全站主設計者
```

允許：

```text
Sidebar vs BottomTabBar 比較
Students Split View 比較
Month Grid marker 壓力測試
iPad layout variants
Statistics drilldown variants
```

禁止：

```text
重新生成全站
直接覆蓋 repo
自由新增功能
推翻 Claude Design 已批准 design family
```

---

## 8. Taste Skill

定位：

```text
規則來源
不是產品決策者
```

可吸收：

```text
Audit-first
Anti-slop
Spacing consistency
Shape consistency
Color consistency
Theme consistency
Loading / Empty / Error
Accessibility
Reduced motion
Design drift check
```

不可直接照搬：

```text
展示型 Landing Page composition
大量 GSAP 動畫
高 motion intensity
自由提高 layout variance
自由更改資訊架構
```

---

## 9. Open Design

定位：

```text
DEFER
```

只於以下條件成立後再評估：

```text
DESIGN.md 已穩定
第一批頁面遷移完成
需要 local-first sandbox
需要 design skill / plugin 實驗
```

不得作為：

```text
Phase UI-2 阻塞條件
第一輪設計必要工具
正式資料入口
```

---

## 10. 權限矩陣

說明：ALLOWED = 可自主執行；ALLOWED_WITH_APPROVAL = 需中控／使用者明確批准後執行；READ_ONLY = 只可唯讀；PROHIBITED = 禁止；DEFERRED = 現階段不適用。

| Action | ChatGPT | Claude / Claude Code | Codex | Claude Design | Stitch | Taste Skill | Open Design |
|---|---|---|---|---|---|---|---|
| Read repo source | READ_ONLY | ALLOWED | READ_ONLY | PROHIBITED | PROHIBITED | PROHIBITED | DEFERRED |
| Write governance docs | ALLOWED_WITH_APPROVAL | ALLOWED_WITH_APPROVAL | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | DEFERRED |
| Modify frontend source | PROHIBITED | ALLOWED_WITH_APPROVAL | ALLOWED_WITH_APPROVAL | PROHIBITED | PROHIBITED | PROHIBITED | DEFERRED |
| Modify backend source | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Read backend/data | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Use synthetic screenshots | ALLOWED | ALLOWED | ALLOWED | ALLOWED | ALLOWED | ALLOWED | DEFERRED |
| Create prototype | PROHIBITED | ALLOWED_WITH_APPROVAL | PROHIBITED | ALLOWED | ALLOWED | PROHIBITED | DEFERRED |
| Approve DESIGN.md | ALLOWED_WITH_APPROVAL | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Create commit | PROHIBITED | ALLOWED_WITH_APPROVAL | ALLOWED_WITH_APPROVAL | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Push | ALLOWED_WITH_APPROVAL（決策） | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Tag | ALLOWED_WITH_APPROVAL（決策） | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Package | ALLOWED_WITH_APPROVAL（決策） | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Add dependency | ALLOWED_WITH_APPROVAL（決策） | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Change API | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Change DB schema | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |
| Change Excel contract | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |

注：「ALLOWED_WITH_APPROVAL（決策）」指 ChatGPT 中控可提出並起草該決策，但執行前仍需使用者最終裁決；實際操作由獲授權的執行工具完成。Change API / DB schema / Excel contract 在 UI 重構期間對所有角色一律 PROHIBITED——如確有必要，必須先停止（見 `27_PROTOCOL_CONFLICT_STOP.md`）並由使用者裁決拆出獨立 Phase。

---

## 11. 工具交接規則

```text
每次交接必須包含：
- Phase ID
- 允許範圍
- 禁止事項
- Git baseline
- Formal Data rule
- Process baseline
- Expected writes
- Stop conditions
- 最終回報格式
```

缺少任一項時，執行工具應要求補齊或以最嚴格解讀執行；對基準的任何觀察偏差，依 `27_PROTOCOL_CONFLICT_STOP.md` 停止回報。

---

## 12. 下一步

```text
下一步：
建立 Conflict Stop Protocol。
```
