import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeContext as LegacyIsDarkContext } from "../../shared/appShared";
import { ThemeProvider } from "../theme";
import { readStoredTheme, useTheme } from "../themeContext";
import { ThemeToggle } from "../shell/ThemeToggle";
import { THEME_STORAGE_KEY } from "../tokens";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });

  return { store, memoryStorage };
}

function ThemeProbe() {
  const { theme, isDark } = useTheme();
  const legacyIsDark = React.useContext(LegacyIsDarkContext);
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="legacy-is-dark">{String(legacyIsDark)}</span>
    </div>
  );
}

describe("ThemeProvider (manual Light / Dark foundation)", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light when nothing is persisted", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("restores a persisted dark theme from the frozen rollcall-theme key", () => {
    const { store } = installMemoryLocalStorage();
    store.set(THEME_STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("falls back to light for invalid persisted values (matches App.tsx behavior)", () => {
    const { store } = installMemoryLocalStorage();
    store.set(THEME_STORAGE_KEY, "auto");
    expect(readStoredTheme()).toBe("light");
  });

  it("toggles between exactly two modes and persists to rollcall-theme", async () => {
    const user = userEvent.setup();
    const { store } = installMemoryLocalStorage();

    render(
      <ThemeProvider>
        <ThemeProbe />
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggle = screen.getByRole("button", { name: "切換至深色模式" });
    await user.click(toggle);

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "切換至淺色模式" }));
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("bridges the legacy boolean isDark ThemeContext for unmigrated pages", () => {
    render(
      <ThemeProvider initialTheme="dark">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("legacy-is-dark")).toHaveTextContent("true");
  });

  it("removes the data-theme attribute on unmount", () => {
    const { unmount } = render(
      <ThemeProvider initialTheme="dark">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("useTheme outside ThemeProvider fails fast", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
    spy.mockRestore();
  });
});
