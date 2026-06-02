import { describe, expect, it } from "vitest";
import {
  computeDefaultSchoolYear,
  resolveSchoolYearRange,
  isWithinSchoolYear,
  countReason6ForStudent,
  applySessionToList,
  formatMaterialsBadge,
  materialsReasonOptions,
  type Session,
} from "./appShared";

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: 1,
    studentId: 1,
    student: { id: 1, name: "學生" },
    dateISO: "2025-10-01",
    start: "16:00",
    durationMin: 60,
    status: "absent",
    kind: "regular",
    materialsProvided: true,
    materialsReasonCode: 6,
    ...overrides,
  };
}

describe("school year helpers", () => {
  it("computes Sep–Aug default for autumn and spring dates", () => {
    expect(computeDefaultSchoolYear("2025-10-01")).toEqual({
      startISO: "2025-09-01",
      endISO: "2026-08-31",
    });
    expect(computeDefaultSchoolYear("2026-03-15")).toEqual({
      startISO: "2025-09-01",
      endISO: "2026-08-31",
    });
    expect(computeDefaultSchoolYear("2025-09-01")).toEqual({
      startISO: "2025-09-01",
      endISO: "2026-08-31",
    });
  });

  it("uses override only when the date falls inside it", () => {
    const override = { startISO: "2025-01-01", endISO: "2025-12-31" };
    expect(resolveSchoolYearRange("2025-06-01", override)).toEqual(override);
    // Outside the override -> default Sep–Aug for that date.
    expect(resolveSchoolYearRange("2026-06-01", override)).toEqual({
      startISO: "2025-09-01",
      endISO: "2026-08-31",
    });
  });

  it("isWithinSchoolYear is inclusive of bounds", () => {
    const r = { startISO: "2025-09-01", endISO: "2026-08-31" };
    expect(isWithinSchoolYear("2025-09-01", r)).toBe(true);
    expect(isWithinSchoolYear("2026-08-31", r)).toBe(true);
    expect(isWithinSchoolYear("2026-09-01", r)).toBe(false);
  });
});

describe("countReason6ForStudent", () => {
  const range = { startISO: "2025-09-01", endISO: "2026-08-31" };

  it("counts only absent + provided + code 6 + in range for the student", () => {
    const sessions: Session[] = [
      makeSession({ id: 1, dateISO: "2025-10-01" }),
      makeSession({ id: 2, dateISO: "2025-11-01" }),
      // wrong code
      makeSession({ id: 3, dateISO: "2025-12-01", materialsReasonCode: 4 }),
      // not provided
      makeSession({ id: 4, dateISO: "2026-01-01", materialsProvided: false, materialsReasonCode: null }),
      // not absent
      makeSession({ id: 5, dateISO: "2026-02-01", status: "present", materialsProvided: false, materialsReasonCode: null }),
      // out of range
      makeSession({ id: 6, dateISO: "2026-09-15" }),
      // other student
      makeSession({ id: 7, dateISO: "2026-03-01", studentId: 2, student: { id: 2, name: "別人" } }),
    ];
    expect(countReason6ForStudent(sessions, 1, range)).toBe(2);
  });
});

describe("applySessionToList", () => {
  it("replaces by id and appends new", () => {
    const a = makeSession({ id: 1 });
    const b = makeSession({ id: 2 });
    const updatedA = makeSession({ id: 1, materialsReasonCode: 4 });
    const replaced = applySessionToList([a, b], updatedA);
    expect(replaced.find((s) => s.id === 1)?.materialsReasonCode).toBe(4);
    expect(replaced).toHaveLength(2);

    const appended = applySessionToList([a], b);
    expect(appended).toHaveLength(2);
  });
});

describe("formatMaterialsBadge", () => {
  it("renders 教材 · code label for all six options", () => {
    expect(formatMaterialsBadge(4)).toBe("教材 · 4 生病");
    expect(materialsReasonOptions).toHaveLength(6);
    expect(formatMaterialsBadge(1)).toBe("教材 · 1 政府措施");
    expect(formatMaterialsBadge(6)).toBe("教材 · 6 其他");
  });
});
