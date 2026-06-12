/*
 * DesktopSidebar primitive (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5
 *
 * Desktop ≥1024px shell navigation. Fixed 220px (200–240 allowed range,
 * driven by --rc-shell-sidebar-width). Not collapsible. Icon Rail not adopted.
 */
import React from "react";
import { tokenVar } from "../tokens";
import { NavItemButton } from "./navigation";
import type { ShellNavItem } from "./navigation";

type DesktopSidebarProps = {
  items: ShellNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** App title / brand area at the top of the sidebar. */
  header?: React.ReactNode;
  /** Bottom slot, e.g. the global ThemeToggle. */
  footer?: React.ReactNode;
};

export function DesktopSidebar({
  items,
  activeKey,
  onSelect,
  header,
  footer,
}: DesktopSidebarProps) {
  // min-h-screen (not h-full): height:100% resolves to auto inside the
  // indefinite-height flex parent and opts out of align-items:stretch,
  // collapsing the sidebar to content height. min-height keeps the
  // viewport-height floor while stretch still tracks taller content.
  return (
    <nav
      data-testid="rc-desktop-sidebar"
      aria-label="主導航"
      className="flex min-h-screen shrink-0 flex-col"
      style={{
        width: tokenVar("shell.sidebarWidth"),
        background: tokenVar("surface.sidebar"),
        borderRight: `1px solid ${tokenVar("border.subtle")}`,
        padding: "var(--rc-space-4) var(--rc-space-3)",
      }}
    >
      {header ? (
        <div
          className="px-3 pb-4"
          style={{
            color: tokenVar("text.primary"),
            fontSize: "var(--rc-font-size-title)",
            fontWeight: 700,
          }}
        >
          {header}
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavItemButton
            key={item.key}
            item={item}
            active={item.key === activeKey}
            onSelect={onSelect}
            variant="sidebar"
          />
        ))}
      </div>

      <div className="flex-1" />

      {footer ? <div className="px-1 pt-3">{footer}</div> : null}
    </nav>
  );
}
