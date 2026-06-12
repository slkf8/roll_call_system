/*
 * Navigation item primitives (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5 / §12
 *
 * Shared by DesktopSidebar and BottomTabBar. Active state is expressed by
 * aria-current + weight + accent, never by color alone.
 */
import React from "react";
import { tokenVar } from "../tokens";

export type ShellNavItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

type NavItemButtonProps = {
  item: ShellNavItem;
  active: boolean;
  onSelect: (key: string) => void;
  variant: "sidebar" | "tabbar";
};

export function NavItemButton({ item, active, onSelect, variant }: NavItemButtonProps) {
  const [hovered, setHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    minHeight: tokenVar("shell.touchTargetMin"),
    color: active ? tokenVar("accent") : tokenVar("text.secondary"),
    background: hovered ? tokenVar("interactive.hover") : "transparent",
    borderRadius: "var(--rc-radius-md)",
    fontSize: "var(--rc-font-size-body-sm)",
    fontWeight: active ? 600 : 500,
    transition: `background var(--rc-motion-fast) ease`,
  };

  const layoutClass =
    variant === "sidebar"
      ? "flex w-full items-center gap-3 px-3 text-left"
      : "flex flex-1 flex-col items-center justify-center gap-0.5";

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${layoutClass} outline-none focus-visible:ring-2`}
      style={
        {
          ...baseStyle,
          "--tw-ring-color": tokenVar("focus.ring"),
        } as React.CSSProperties
      }
    >
      {item.icon ? (
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
          {item.icon}
        </span>
      ) : null}
      <span>{item.label}</span>
    </button>
  );
}
