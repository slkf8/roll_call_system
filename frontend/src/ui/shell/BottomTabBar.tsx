/*
 * BottomTabBar primitive (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5
 *
 * <1024px shell navigation. Contract: 貼底、實底、上緣 hairline、
 * safe-area spacer、不得遮擋內容 (content padding is AppShell's duty).
 */
import { tokenVar } from "../tokens";
import { NavItemButton } from "./navigation";
import type { ShellNavItem } from "./navigation";

type BottomTabBarProps = {
  items: ShellNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function BottomTabBar({ items, activeKey, onSelect }: BottomTabBarProps) {
  return (
    <nav
      data-testid="rc-bottom-tab-bar"
      aria-label="主導航"
      className="fixed inset-x-0 bottom-0 z-40"
      style={{
        // 實底 (solid surface, no translucency) + 上緣 hairline
        background: tokenVar("surface.card"),
        borderTop: `1px solid ${tokenVar("border.subtle")}`,
      }}
    >
      <div className="flex" style={{ height: tokenVar("shell.tabbarHeight") }}>
        {items.map((item) => (
          <NavItemButton
            key={item.key}
            item={item}
            active={item.key === activeKey}
            onSelect={onSelect}
            variant="tabbar"
          />
        ))}
      </div>
      {/* safe-area spacer */}
      <div
        data-testid="rc-tabbar-safe-area"
        aria-hidden="true"
        style={{ height: "env(safe-area-inset-bottom)" }}
      />
    </nav>
  );
}
