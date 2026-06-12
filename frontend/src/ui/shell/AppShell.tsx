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
