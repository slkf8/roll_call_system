/*
 * Theme foundation provider (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5 / §11
 *
 * Manual Light / Dark only. OS auto-follow is DEFERRED (DECISION register) —
 * do not add an "auto" mode here.
 *
 * Persistence FREEZE (24_CONTRACT §2): reuses the existing `rollcall-theme`
 * localStorage key via readStoredTheme (themeContext.ts).
 */
import React from "react";
import { ThemeContext as LegacyIsDarkContext } from "../shared/appShared";
import { RcThemeContext, readStoredTheme } from "./themeContext";
import type { RcThemeContextValue, ThemeMode } from "./themeContext";
import { THEME_STORAGE_KEY } from "./tokens";

type ThemeProviderProps = {
  children: React.ReactNode;
  /** Test/bootstrap override; defaults to the persisted theme. */
  initialTheme?: ThemeMode;
};

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<ThemeMode>(
    () => initialTheme ?? readStoredTheme()
  );

  React.useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.error("Save theme failed", e);
    }
  }, [theme]);

  // Dark mode remaps the semantic token layer only (tokens.css
  // [data-theme="dark"]); the attribute is the single switch.
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    return () => {
      root.removeAttribute("data-theme");
    };
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo<RcThemeContextValue>(
    () => ({ theme, isDark: theme === "dark", setTheme, toggleTheme }),
    [theme, toggleTheme]
  );

  return (
    <RcThemeContext.Provider value={value}>
      {/* Bridge for not-yet-migrated pages that consume the legacy
          boolean isDark ThemeContext (appShared). Pages stay untouched. */}
      <LegacyIsDarkContext.Provider value={theme === "dark"}>
        {children}
      </LegacyIsDarkContext.Provider>
    </RcThemeContext.Provider>
  );
}
