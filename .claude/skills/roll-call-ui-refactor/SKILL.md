---
name: roll-call-ui-refactor
description: Apply roll_call_system UI-refactor governance when planning, designing, implementing, or reviewing frontend UI changes. Enforce the approved charter, interaction freeze, retain-redesign-challenge matrix, formal-data rules, and conflict-stop protocol. Use only for roll_call_system UI-refactor work.
user-invocable: true
---

# roll_call_system UI Refactor Governance

Use this skill only for `roll_call_system` UI-refactor work.

## Priority order

Follow this order. Lower layers must not override higher layers:

1. Formal-data safety and backend / DB / Excel / release contracts
2. `docs/ui-refactor/23_CHARTER_UI_REFACTOR.md`
3. `docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md`
4. `docs/ui-refactor/80_REGISTER_DECISIONS.md`
5. `docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md`
6. Approved `DESIGN.md`, when it exists
7. `docs/ui-refactor/28_RULES_TASTE_SKILL_ADAPTATION.md`
8. Tool suggestions

## Read the relevant governance files

Before planning or changing UI, read only the files needed for the current phase:

- Charter: `docs/ui-refactor/23_CHARTER_UI_REFACTOR.md`
- Frozen interactions: `docs/ui-refactor/24_CONTRACT_INTERACTION_FREEZE.md`
- Design matrix: `docs/ui-refactor/25_MATRIX_RETAIN_REDESIGN_CHALLENGE.md`
- Tool roles: `docs/ui-refactor/26_MATRIX_TOOL_RESPONSIBILITY.md`
- Stop protocol: `docs/ui-refactor/27_PROTOCOL_CONFLICT_STOP.md`
- Taste adaptation: `docs/ui-refactor/28_RULES_TASTE_SKILL_ADAPTATION.md`
- Decisions: `docs/ui-refactor/80_REGISTER_DECISIONS.md`

## Formal Data Zone

Treat `backend/data/` as `OPAQUE_PROTECTED_FORMAL_DATA_ZONE`.

For routine work, the only allowed query is:

```bash
test -d backend/data
```

Do not list, read, stat, hash, copy, archive, extract, or expose its contents. Use synthetic data only for UI audit, prototypes, screenshots, and Browser QA.

## UI-restyle scope

Allowed only when the current phase explicitly approves it:

- Design tokens
- Theme layer
- Typography, spacing, radius, and surfaces
- Button hierarchy and status semantics
- Shared UI primitives
- Page shell, navigation, layout, responsive behavior, and dark mode
- Empty, loading, inline error, Toast, Sheet, and Dialog presentation

Do not silently change product behavior.

## Frozen rules

Do not silently change:

- Backend API, DB schema, Excel mapping, template contract, or export strategy
- Attendance, absence, makeup, extra-lesson, or conflict-detection logic
- RC11 native date / month overlay behavior
- Guarded bulk-remove flow, backend health gate, authoritative preview, or danger confirmation
- DataPage row matching, preview / confirm, backend-primary export, or browser fallback
- Release scripts, package flow, runtime lock, or lifecycle lock

## Approved decisions

`DECISION-UI-001`: Month Grid conflict and absent markers must use distinct icon, shape, or short text. Do not distinguish them by color alone. Compare the concrete marker design during Claude Design review.

`DECISION-PF-001`: MonthPage batch-generate preview / confirm is approved only as a separate Product Feature Phase. Do not implement it during UI restyle. The future preview must show date range, student count, added count, skipped count, and conflict count.

## UI design rules

- Prefer an Apple-inspired productivity interface.
- Avoid excessive cards, pills, decorative dots, motion, and whitespace.
- Preserve desktop scan efficiency and DataPage table density.
- Use finite spacing and radius scales.
- Keep status semantics explicit; never rely on color alone.
- Keep iPad touch targets reasonable.
- Prevent horizontal overflow on narrow viewports.
- Do not use Toast as the only error channel.

Initial calibration:

```text
DESIGN_VARIANCE: 3 / 10
MOTION_INTENSITY: 2 / 10
VISUAL_DENSITY: 6 / 10
```

## Mandatory preflight

Before any write action:

1. Confirm the approved phase and write scope.
2. Confirm branch, HEAD, ahead / behind, worktree, and diff gates.
3. Apply the Formal Data Zone rule.
4. Confirm process boundaries when starting or stopping anything.
5. Stop if a new dependency, Product Feature, API, DB, Excel, release, or formal-data action is required.

## Stop rule

On conflict, fail closed. Use `docs/ui-refactor/27_PROTOCOL_CONFLICT_STOP.md`.

Do not guess, self-correct, or continue because a deviation looks benign.

## Prohibited without explicit phase approval

- New dependencies
- Product Features
- Backend changes
- DB schema changes
- Excel contract changes
- Formal-data access
- Live-process contact
- `killall`, `pkill`, or pattern-kill
- Push, tag, package, or artifact overwrite

## Handoff

Every execution report must include:

- Phase ID
- Allowed writes
- Git gate
- Formal-data gate
- Process gate, when relevant
- Changed files
- Tests / build / Browser QA, when relevant
- Stop condition or next allowed action
