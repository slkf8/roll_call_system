/*
 * AppShell foundation (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5
 *
 * Responsive shell contract:
 *   ≥1024px → DesktopSidebar (220px) + content
 *   <1024px → content + BottomTabBar (with safe-area spacer; AppShell pads
 *              the content area so the tab bar never covers it)
 *
 * Phase UI-3A builds the primitive only; wiring the existing App into this
 * shell happens in Phase UI-3B (shell migration).
 */
import React from "react";
import { tokenVar } from "../tokens";
import { useIsDesktop } from "../useViewport";
import { BottomTabBar } from "./BottomTabBar";
import { DesktopSidebar } from "./DesktopSidebar";
import { ThemeToggle } from "./ThemeToggle";
import type { ShellNavItem } from "./navigation";

type AppShellProps = {
  items: ShellNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Sidebar brand/title area (desktop only). */
  title?: React.ReactNode;
  /** Sidebar footer slot, e.g. the global ThemeToggle (desktop only). */
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({
  items,
  activeKey,
  onSelect,
  title,
  sidebarFooter,
  children,
}: AppShellProps) {
  const isDesktop = useIsDesktop();

  const pageStyle: React.CSSProperties = {
    background: tokenVar("surface.page"),
    color: tokenVar("text.primary"),
  };

  if (isDesktop) {
    return (
      <div data-testid="rc-app-shell" className="flex min-h-screen" style={pageStyle}>
        <DesktopSidebar
          items={items}
          activeKey={activeKey}
          onSelect={onSelect}
          header={title}
          footer={sidebarFooter}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div data-testid="rc-app-shell" className="min-h-screen" style={pageStyle}>
      {/* Shell-level compact utility bar (<1024px only): hosts the global
          ThemeToggle. Sticky in normal flow (occupies space, never covers
          content); z-30 stays below Sheet z-50 and Toast z-[60]. */}
      <header
        data-testid="rc-mobile-utility-bar"
        className="sticky top-0 z-30 flex justify-end"
        style={{
          background: tokenVar("surface.card"),
          borderBottom: `1px solid ${tokenVar("border.subtle")}`,
          padding: `calc(env(safe-area-inset-top) + var(--rc-space-1)) var(--rc-space-3) var(--rc-space-1)`,
        }}
      >
        {/* Wrapper keeps the w-full ThemeToggle content-sized so the bar
            content right-aligns with an empty left side (no page title). */}
        <div>
          <ThemeToggle />
        </div>
      </header>
      <main
        style={{
          // 不得遮擋內容: reserve space for the tab bar + safe area.
          paddingBottom: `calc(${tokenVar("shell.tabbarHeight")} + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>
      <BottomTabBar items={items} activeKey={activeKey} onSelect={onSelect} />
    </div>
  );
}
