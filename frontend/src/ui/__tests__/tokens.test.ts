import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_MIN_WIDTH_PX,
  FONT_SIZE_CAPTION_PX,
  FONT_SIZE_MIN_PX,
  RADIUS_SCALE_PX,
  SIDEBAR_WIDTH_MAX_PX,
  SIDEBAR_WIDTH_MIN_PX,
  SIDEBAR_WIDTH_PX,
  SPACING_SCALE_PX,
  THEME_STORAGE_KEY,
  TOUCH_TARGET_MIN_PX,
  semanticTokens,
  tokenVar,
} from "../tokens";

const tokensCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../tokens.css"),
  "utf-8"
);

// 36_SPEC_UI_DESIGN_APPROVED.md §3 required semantic tokens.
const REQUIRED_SPEC_TOKENS = [
  "accent",
  "surface.page",
  "surface.sidebar",
  "surface.card",
  "surface.inset",
  "text.primary",
  "text.secondary",
  "text.tertiary",
  "border.subtle",
  "status.present.fg",
  "status.present.bg",
  "status.absent.fg",
  "status.absent.bg",
  "status.pending.fg",
  "status.pending.bg",
  "status.conflict.fg",
  "status.conflict.bg",
  "status.holiday.fg",
  "status.holiday.bg",
  "status.makeup.fg",
  "status.makeup.bg",
] as const;

describe("semantic token contract (36_SPEC §3)", () => {
  it("registers every token required by the approved design contract", () => {
    for (const name of REQUIRED_SPEC_TOKENS) {
      expect(semanticTokens, `missing semantic token: ${name}`).toHaveProperty([name]);
    }
  });

  it("defines every registered semantic custom property in tokens.css", () => {
    for (const cssVarName of Object.values(semanticTokens)) {
      expect(tokensCss, `missing CSS definition: ${cssVarName}`).toContain(
        `${cssVarName}:`
      );
    }
  });

  it("remaps theme-dependent semantic tokens in the dark block", () => {
    const darkBlock = tokensCss.split('[data-theme="dark"]')[1] ?? "";
    const themeDependent = REQUIRED_SPEC_TOKENS.map((name) => semanticTokens[name]);
    for (const cssVarName of themeDependent) {
      expect(darkBlock, `dark remap missing: ${cssVarName}`).toContain(
        `${cssVarName}:`
      );
    }
  });

  it("tokenVar returns a css var() reference", () => {
    expect(tokenVar("surface.page")).toBe("var(--rc-surface-page)");
    expect(tokenVar("status.conflict.fg")).toBe("var(--rc-status-conflict-fg)");
  });
});

describe("shell + typography constants (36_SPEC §4–§5)", () => {
  it("keeps the desktop breakpoint at 1024px", () => {
    expect(DESKTOP_MIN_WIDTH_PX).toBe(1024);
  });

  it("keeps sidebar width at 220px within the approved 200–240 range", () => {
    expect(SIDEBAR_WIDTH_PX).toBe(220);
    expect(SIDEBAR_WIDTH_PX).toBeGreaterThanOrEqual(SIDEBAR_WIDTH_MIN_PX);
    expect(SIDEBAR_WIDTH_PX).toBeLessThanOrEqual(SIDEBAR_WIDTH_MAX_PX);
    expect(tokensCss).toContain("--rc-shell-sidebar-width: 220px");
  });

  it("keeps the general text floor at 12px with 11px caption metadata only", () => {
    expect(FONT_SIZE_MIN_PX).toBe(12);
    expect(FONT_SIZE_CAPTION_PX).toBe(11);
  });

  it("keeps the minimum touch target at 44px", () => {
    expect(TOUCH_TARGET_MIN_PX).toBe(44);
    expect(tokensCss).toContain("--rc-shell-touch-target-min: 44px");
  });

  it("uses finite spacing and radius scales", () => {
    expect(SPACING_SCALE_PX.length).toBeGreaterThan(0);
    expect([...SPACING_SCALE_PX]).toEqual([...SPACING_SCALE_PX].sort((a, b) => a - b));
    expect(RADIUS_SCALE_PX.full).toBe(9999);
  });

  it("preserves the frozen rollcall-theme persistence key", () => {
    expect(THEME_STORAGE_KEY).toBe("rollcall-theme");
  });
});
