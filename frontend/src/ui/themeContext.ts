/*
 * Theme context contract (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5 / §11
 *
 * Manual Light / Dark only. OS auto-follow is DEFERRED — no "auto" mode.
 * Split from theme.tsx so that component files export components only.
 */
import { createContext, useContext } from "react";
import { THEME_STORAGE_KEY } from "./tokens";

export type ThemeMode = "light" | "dark";

export type RcThemeContextValue = {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

export const RcThemeContext = createContext<RcThemeContextValue | null>(null);

/**
 * Mirrors the existing App.tsx getInitialTheme behavior exactly.
 * Persistence FREEZE (24_CONTRACT §2): same `rollcall-theme` key, same
 * value set ("light" | "dark"), same default ("light").
 */
export function readStoredTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : "light";
  } catch {
    return "light";
  }
}

export function useTheme(): RcThemeContextValue {
  const ctx = useContext(RcThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
