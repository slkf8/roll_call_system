import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCHOOL_YEAR_OVERRIDE_KEY,
  readSchoolYearOverride,
  writeSchoolYearOverride,
  clearSchoolYearOverride,
} from "./schoolYearStorage";

// In-memory localStorage stub so the test does not depend on the jsdom
// storage implementation.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("schoolYearStorage", () => {
  it("returns null when nothing stored", () => {
    expect(readSchoolYearOverride()).toBeNull();
  });

  it("writes and reads a valid range", () => {
    expect(writeSchoolYearOverride({ startISO: "2025-09-01", endISO: "2026-08-31" })).toBe(true);
    expect(readSchoolYearOverride()).toEqual({
      startISO: "2025-09-01",
      endISO: "2026-08-31",
    });
  });

  it("rejects an inverted range and does not persist", () => {
    expect(writeSchoolYearOverride({ startISO: "2026-08-31", endISO: "2025-09-01" })).toBe(false);
    expect(localStorage.getItem(SCHOOL_YEAR_OVERRIDE_KEY)).toBeNull();
  });

  it("clear removes the override", () => {
    writeSchoolYearOverride({ startISO: "2025-09-01", endISO: "2026-08-31" });
    clearSchoolYearOverride();
    expect(readSchoolYearOverride()).toBeNull();
  });

  it("ignores corrupt stored values", () => {
    localStorage.setItem(SCHOOL_YEAR_OVERRIDE_KEY, "{not json");
    expect(readSchoolYearOverride()).toBeNull();
    localStorage.setItem(SCHOOL_YEAR_OVERRIDE_KEY, JSON.stringify({ startISO: "x", endISO: "y" }));
    expect(readSchoolYearOverride()).toBeNull();
  });
});
