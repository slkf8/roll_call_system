/*
 * ThemeToggle primitive (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5 / §11
 *
 * Manual Light / Dark only — two-state toggle; no auto / OS-follow mode
 * (DEFERRED). Lives in the global shell from Phase UI-3B onward.
 * State is expressed by icon + text label, never color alone.
 */
import React from "react";
import { tokenVar } from "../tokens";
import { useTheme } from "../themeContext";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "切換至淺色模式" : "切換至深色模式"}
      aria-pressed={isDark}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center gap-3 px-3 outline-none focus-visible:ring-2"
      style={
        {
          minHeight: tokenVar("shell.touchTargetMin"),
          color: tokenVar("text.secondary"),
          background: hovered ? tokenVar("interactive.hover") : "transparent",
          borderRadius: "var(--rc-radius-md)",
          fontSize: "var(--rc-font-size-body-sm)",
          fontWeight: 500,
          transition: `background var(--rc-motion-fast) ease`,
          "--tw-ring-color": tokenVar("focus.ring"),
        } as React.CSSProperties
      }
    >
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
        {isDark ? "☀" : "☾"}
      </span>
      <span>{isDark ? "淺色模式" : "深色模式"}</span>
    </button>
  );
}
