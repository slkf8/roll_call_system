// Persisted manual override for the "原因 6 每學年度最多 3 次" school-year
// range. Stored under its own key so it never touches the main attendance
// payload (STORAGE_KEY). The override is a plain {startISO, endISO} range; it
// is only applied to dates that fall inside it (see resolveSchoolYearRange in
// appShared) — outside the range the default Sep–Aug school year is used.

export const SCHOOL_YEAR_OVERRIDE_KEY = "rollcall-reason6-schoolyear";

export type SchoolYearRange = {
  startISO: string;
  endISO: string;
};

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts;
  return y.length === 4 && m.length === 2 && d.length === 2 && !Number.isNaN(Date.parse(value));
}

export function readSchoolYearOverride(): SchoolYearRange | null {
  try {
    const raw = localStorage.getItem(SCHOOL_YEAR_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      isValidDateISO(parsed.startISO) &&
      isValidDateISO(parsed.endISO) &&
      parsed.startISO <= parsed.endISO
    ) {
      return { startISO: parsed.startISO, endISO: parsed.endISO };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSchoolYearOverride(range: SchoolYearRange): boolean {
  if (
    !isValidDateISO(range.startISO) ||
    !isValidDateISO(range.endISO) ||
    range.startISO > range.endISO
  ) {
    return false;
  }
  try {
    localStorage.setItem(SCHOOL_YEAR_OVERRIDE_KEY, JSON.stringify(range));
    return true;
  } catch {
    return false;
  }
}

export function clearSchoolYearOverride(): void {
  try {
    localStorage.removeItem(SCHOOL_YEAR_OVERRIDE_KEY);
  } catch {
    // ignore storage failures; caller falls back to the default school year.
  }
}
