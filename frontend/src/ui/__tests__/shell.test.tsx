import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme";
import { AppShell } from "../shell/AppShell";
import { BottomTabBar } from "../shell/BottomTabBar";
import { DesktopSidebar } from "../shell/DesktopSidebar";
import type { ShellNavItem } from "../shell/navigation";
import { DESKTOP_MEDIA_QUERY } from "../useViewport";

const NAV_ITEMS: ShellNavItem[] = [
  { key: "today", label: "今天" },
  { key: "month", label: "月份" },
  { key: "students", label: "學生" },
  { key: "data", label: "數據" },
];

function installMatchMedia(desktopMatches: boolean) {
  const mql = {
    matches: desktopMatches,
    media: DESKTOP_MEDIA_QUERY,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  const matchMedia = vi.fn((query: string) => ({ ...mql, media: query }));
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });
  return matchMedia;
}

function renderShell() {
  const onSelect = vi.fn();
  render(
    <ThemeProvider initialTheme="light">
      <AppShell items={NAV_ITEMS} activeKey="today" onSelect={onSelect} title="點名系統">
        <div data-testid="page-content">content</div>
      </AppShell>
    </ThemeProvider>
  );
  return { onSelect };
}

describe("AppShell breakpoint contract (36_SPEC §5)", () => {
  beforeEach(() => {
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders DesktopSidebar (no BottomTabBar, no utility bar) at ≥1024px", () => {
    installMatchMedia(true);
    renderShell();

    expect(screen.getByTestId("rc-desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("rc-bottom-tab-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rc-mobile-utility-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders BottomTabBar (no DesktopSidebar) below 1024px", () => {
    installMatchMedia(false);
    renderShell();

    expect(screen.getByTestId("rc-bottom-tab-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("rc-desktop-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("hosts the global ThemeToggle in a sticky utility bar below 1024px", async () => {
    const user = userEvent.setup();
    installMatchMedia(false);
    renderShell();

    const utilityBar = screen.getByTestId("rc-mobile-utility-bar");
    expect(utilityBar.className).toContain("sticky");
    expect(utilityBar.className).toContain("top-0");
    expect(utilityBar.className).toContain("justify-end");

    const toggle = within(utilityBar).getByRole("button", { name: "切換至深色模式" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(
      within(utilityBar).getByRole("button", { name: "切換至淺色模式" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the BottomTabBar to the four navigation tabs (no theme action)", () => {
    installMatchMedia(false);
    renderShell();

    const tabBar = screen.getByTestId("rc-bottom-tab-bar");
    expect(within(tabBar).getAllByRole("button")).toHaveLength(NAV_ITEMS.length);
    expect(
      within(tabBar).queryByRole("button", { name: /切換至/ })
    ).not.toBeInTheDocument();
  });

  it("queries the approved 1024px breakpoint", () => {
    const matchMedia = installMatchMedia(true);
    renderShell();
    expect(matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
  });

  it("keeps all four primary entries reachable in both shells", () => {
    installMatchMedia(true);
    renderShell();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
    }
    cleanup();

    installMatchMedia(false);
    renderShell();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
    }
  });
});

describe("DesktopSidebar primitive", () => {
  afterEach(cleanup);

  it("marks the active item with aria-current and fires onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DesktopSidebar items={NAV_ITEMS} activeKey="month" onSelect={onSelect} />
    );

    expect(screen.getByRole("button", { name: "月份" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "今天" })).not.toHaveAttribute(
      "aria-current"
    );

    await user.click(screen.getByRole("button", { name: "學生" }));
    expect(onSelect).toHaveBeenCalledWith("students");
  });

  it("uses the sidebar width token", () => {
    render(<DesktopSidebar items={NAV_ITEMS} activeKey="today" onSelect={() => {}} />);
    expect(screen.getByTestId("rc-desktop-sidebar")).toHaveStyle({
      width: "var(--rc-shell-sidebar-width)",
    });
  });

  it("keeps a viewport-height floor and pushes the footer slot to the bottom", () => {
    render(
      <DesktopSidebar
        items={NAV_ITEMS}
        activeKey="today"
        onSelect={() => {}}
        footer={<div data-testid="sidebar-footer-slot" />}
      />
    );

    const sidebar = screen.getByTestId("rc-desktop-sidebar");
    // h-full collapses to content height inside the indefinite-height flex
    // parent; the viewport-height contract relies on min-h-screen instead.
    expect(sidebar.className).toContain("min-h-screen");
    expect(sidebar.className).not.toContain("h-full");
    expect(sidebar.className).toContain("flex-col");

    const footer = screen.getByTestId("sidebar-footer-slot");
    const lastChild = sidebar.lastElementChild as HTMLElement;
    expect(lastChild).toContainElement(footer);
    // The flex-1 spacer ahead of the footer is what pushes it to the bottom.
    expect(lastChild.previousElementSibling?.className).toContain("flex-1");
  });
});

describe("BottomTabBar primitive", () => {
  afterEach(cleanup);

  it("marks the active item, fires onSelect, and keeps a safe-area spacer", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomTabBar items={NAV_ITEMS} activeKey="data" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: "數據" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("rc-tabbar-safe-area")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "今天" }));
    expect(onSelect).toHaveBeenCalledWith("today");
  });
});
