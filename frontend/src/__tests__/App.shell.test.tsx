import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { STORAGE_KEY } from "../shared/appShared";
import { THEME_STORAGE_KEY } from "../ui/tokens";
import { DESKTOP_MEDIA_QUERY } from "../ui/useViewport";

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

function installMatchMedia(desktopMatches: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY ? desktopMatches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });
  return matchMedia;
}

function setStoredAppData(data: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function emptyAppData(activeTab: string = "today") {
  return {
    activeTab,
    selectedDate: "2026-06-01",
    students: [],
    sessions: [],
    studentScheduleRules: [],
    globalEvents: [],
  };
}

const NAV_LABELS = ["今日", "月份", "學生", "數據"] as const;

beforeEach(() => {
  installMemoryLocalStorage();
  document.documentElement.removeAttribute("data-theme");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("backend unavailable")))
  );
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App shell migration (Phase UI-3B)", () => {
  it("renders DesktopSidebar with all four entries and no tab bar at ≥1024px", async () => {
    installMatchMedia(true);
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    const sidebar = screen.getByTestId("rc-desktop-sidebar");
    for (const label of NAV_LABELS) {
      expect(within(sidebar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByTestId("rc-bottom-tab-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rc-mobile-utility-bar")).not.toBeInTheDocument();
  });

  it("renders BottomTabBar with all four entries and no sidebar below 1024px", async () => {
    installMatchMedia(false);
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    const tabBar = screen.getByTestId("rc-bottom-tab-bar");
    for (const label of NAV_LABELS) {
      expect(within(tabBar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(tabBar).getAllByRole("button")).toHaveLength(NAV_LABELS.length);
    expect(
      within(tabBar).queryByRole("button", { name: /切換至/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rc-desktop-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("rc-tabbar-safe-area")).toBeInTheDocument();

    const utilityBar = screen.getByTestId("rc-mobile-utility-bar");
    expect(
      within(utilityBar).getByRole("button", { name: "切換至深色模式" })
    ).toBeInTheDocument();
  });

  it("provides the shell-level ThemeToggle on StudentsPage below 1024px", async () => {
    installMatchMedia(false);
    setStoredAppData(emptyAppData("students"));

    render(<App />);

    expect(await screen.findByText("管理學生")).toBeInTheDocument();
    const utilityBar = screen.getByTestId("rc-mobile-utility-bar");
    expect(
      within(utilityBar).getByRole("button", { name: "切換至深色模式" })
    ).toBeInTheDocument();
  });

  it("toggles theme from the mobile utility bar and persists rollcall-theme", async () => {
    const user = userEvent.setup();
    installMatchMedia(false);
    const { store } = installMemoryLocalStorage();
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    const utilityBar = screen.getByTestId("rc-mobile-utility-bar");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(
      within(utilityBar).getByRole("button", { name: "切換至深色模式" })
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(
      within(utilityBar).getByRole("button", { name: "切換至淺色模式" })
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");
  });

  it("fails toward the touch layout when matchMedia is unavailable", async () => {
    // jsdom default: no matchMedia installed.
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    expect(screen.getByTestId("rc-bottom-tab-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("rc-desktop-sidebar")).not.toBeInTheDocument();
  });

  it("marks the active entry with aria-current and switches tabs with persistence", async () => {
    const user = userEvent.setup();
    installMatchMedia(true);
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    const sidebar = screen.getByTestId("rc-desktop-sidebar");
    expect(within(sidebar).getByRole("button", { name: "今日" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(within(sidebar).getByRole("button", { name: "學生" }));

    expect(await screen.findByText("管理學生")).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "學生" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(sidebar).getByRole("button", { name: "今日" })).not.toHaveAttribute(
      "aria-current"
    );
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.activeTab).toBe("students");
    });
  });

  it("toggles theme from the global shell ThemeToggle and persists rollcall-theme", async () => {
    const user = userEvent.setup();
    installMatchMedia(true);
    const { store } = installMemoryLocalStorage();
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    const sidebar = screen.getByTestId("rc-desktop-sidebar");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(within(sidebar).getByRole("button", { name: "切換至深色模式" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(within(sidebar).getByRole("button", { name: "切換至淺色模式" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");
  });

  it("keeps the ThemeProvider as the single rollcall-theme writer", async () => {
    installMatchMedia(true);
    const { memoryStorage } = installMemoryLocalStorage();
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    await waitFor(() => {
      const themeWrites = memoryStorage.setItem.mock.calls.filter(
        ([key]) => key === THEME_STORAGE_KEY
      );
      // Exactly one writer: the provider's mount persistence effect.
      expect(themeWrites).toHaveLength(1);
    });
  });

  it("restores a persisted dark theme through the provider", async () => {
    installMatchMedia(true);
    const { store } = installMemoryLocalStorage();
    store.set(THEME_STORAGE_KEY, "dark");
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("keeps the unmigrated page-header theme toggle working via the provider bridge", async () => {
    const user = userEvent.setup();
    installMatchMedia(true);
    const { store } = installMemoryLocalStorage();
    setStoredAppData(emptyAppData());

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();

    // Legacy segmented toggle rendered by TodayPage's HeaderBar.
    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "切換為深色模式" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
