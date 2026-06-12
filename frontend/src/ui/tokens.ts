/*
 * roll_call_system UI foundation token contract (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §2–§5
 *
 * TypeScript mirror of frontend/src/ui/tokens.css.
 * Components must consume semantic tokens (via tokenVar) only;
 * primitives are internal to tokens.css.
 */

/** Theme persistence key. FREEZE: must stay `rollcall-theme` (24_CONTRACT §2). */
export const THEME_STORAGE_KEY = "rollcall-theme";

/** Shell breakpoint contract (36_SPEC §5): ≥1024px Sidebar, <1024px BottomTabBar. */
export const DESKTOP_MIN_WIDTH_PX = 1024;

/** Sidebar width contract: 220px initial, 200–240px allowed range. */
export const SIDEBAR_WIDTH_PX = 220;
export const SIDEBAR_WIDTH_MIN_PX = 200;
export const SIDEBAR_WIDTH_MAX_PX = 240;

/** BottomTabBar content height (excludes safe-area spacer). */
export const TABBAR_HEIGHT_PX = 56;

/** Minimum touch target (36_SPEC §12). */
export const TOUCH_TARGET_MIN_PX = 44;

/** Typography floor: general user-facing text minimum (36_SPEC §4). */
export const FONT_SIZE_MIN_PX = 12;
/** 11px is restricted to low-priority metadata only. */
export const FONT_SIZE_CAPTION_PX = 11;

/** Finite spacing scale (px). */
export const SPACING_SCALE_PX = [4, 8, 12, 16, 20, 24, 32, 40] as const;

/** Finite radius scale (px). */
export const RADIUS_SCALE_PX = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Semantic token registry: semantic name → CSS custom property.
 * Covers every token required by 36_SPEC §3 plus interaction / focus /
 * shadow / layout semantics needed by shell primitives.
 */
export const semanticTokens = {
  accent: "--rc-accent",
  "accent.contrast": "--rc-accent-contrast",

  "surface.page": "--rc-surface-page",
  "surface.sidebar": "--rc-surface-sidebar",
  "surface.card": "--rc-surface-card",
  "surface.inset": "--rc-surface-inset",

  "text.primary": "--rc-text-primary",
  "text.secondary": "--rc-text-secondary",
  "text.tertiary": "--rc-text-tertiary",

  "border.subtle": "--rc-border-subtle",
  separator: "--rc-separator",

  "interactive.hover": "--rc-interactive-hover",
  "interactive.pressed": "--rc-interactive-pressed",
  "focus.ring": "--rc-focus-ring",

  "status.present.fg": "--rc-status-present-fg",
  "status.present.bg": "--rc-status-present-bg",
  "status.absent.fg": "--rc-status-absent-fg",
  "status.absent.bg": "--rc-status-absent-bg",
  "status.pending.fg": "--rc-status-pending-fg",
  "status.pending.bg": "--rc-status-pending-bg",
  "status.conflict.fg": "--rc-status-conflict-fg",
  "status.conflict.bg": "--rc-status-conflict-bg",
  "status.holiday.fg": "--rc-status-holiday-fg",
  "status.holiday.bg": "--rc-status-holiday-bg",
  "status.makeup.fg": "--rc-status-makeup-fg",
  "status.makeup.bg": "--rc-status-makeup-bg",

  "shadow.card": "--rc-shadow-card",
  "shadow.overlay": "--rc-shadow-overlay",

  "shell.sidebarWidth": "--rc-shell-sidebar-width",
  "shell.tabbarHeight": "--rc-shell-tabbar-height",
  "shell.touchTargetMin": "--rc-shell-touch-target-min",

  "motion.fast": "--rc-motion-fast",
  "motion.standard": "--rc-motion-standard",
} as const;

export type SemanticTokenName = keyof typeof semanticTokens;

/** Returns a CSS `var()` reference for a semantic token. */
export function tokenVar(name: SemanticTokenName): string {
  return `var(${semanticTokens[name]})`;
}
