/*
 * Viewport / breakpoint contract (Phase UI-3A)
 * Authority: docs/ui-refactor/36_SPEC_UI_DESIGN_APPROVED.md §5
 *
 * ≥1024px → DesktopSidebar; <1024px → BottomTabBar. Icon Rail not adopted.
 */
import { useSyncExternalStore } from "react";
import { DESKTOP_MIN_WIDTH_PX } from "./tokens";

export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // Fail toward the touch-friendly layout when the environment cannot
    // report viewport width.
    return false;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
