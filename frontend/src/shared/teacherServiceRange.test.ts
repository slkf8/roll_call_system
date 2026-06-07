import { describe, expect, it } from "vitest";
import {
  computeDefaultSchoolYear,
  type Session,
} from "./appShared";
import {
  calculateTeacherServiceStatsByMonthRange,
  validateMonthRange,
} from "./teacherServiceRange";

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: 1,
    studentId: 1,
    student: { id: 1, name: "學生" },
    dateISO: "2026-01-15",
    start: "16:00",
    durationMin: 60,
    status: "present",
    kind: "regular",
    materialsProvided: false,
    materialsReasonCode: null,
    ...overrides,
  };
}

function defaultMonthRange(dateISO: string) {
  const range = computeDefaultSchoolYear(dateISO);
  return {
    startMonth: range.startISO.slice(0, 7),
    endMonth: range.endISO.slice(0, 7),
  };
}

describe("teacher service default month ranges", () => {
  it("derives Sep-Aug for a January selected month", () => {
    expect(defaultMonthRange("2026-01-15")).toEqual({
      startMonth: "2025-09",
      endMonth: "2026-08",
    });
  });

  it("derives the next Sep-Aug year for a September selected month", () => {
    expect(defaultMonthRange("2026-09-15")).toEqual({
      startMonth: "2026-09",
      endMonth: "2027-08",
    });
  });
});

describe("calculateTeacherServiceStatsByMonthRange", () => {
  it("aggregates present and materials service sessions across Dec-Jan", () => {
    const sessions: Session[] = [
      makeSession({ id: 1, dateISO: "2025-12-20", status: "present", kind: "regular" }),
      makeSession({ id: 2, dateISO: "2026-01-05", status: "present", kind: "makeup" }),
      makeSession({ id: 3, dateISO: "2026-01-12", status: "present", kind: "extra" }),
      makeSession({
        id: 4,
        dateISO: "2026-01-20",
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: 4,
      }),
      makeSession({ id: 5, dateISO: "2025-11-30", status: "present", kind: "regular" }),
      makeSession({ id: 6, dateISO: "2026-02-01", status: "present", kind: "regular" }),
    ];

    expect(
      calculateTeacherServiceStatsByMonthRange(sessions, "2025-12", "2026-01")
    ).toEqual({
      presentCount: 3,
      materialsCount: 1,
      teacherServiceTotal: 4,
    });
  });

  it("counts materials only for absent sessions with provided materials and reason code 1-6", () => {
    const sessions: Session[] = [
      makeSession({
        id: 1,
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: 1,
      }),
      makeSession({
        id: 2,
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: 6,
      }),
      makeSession({
        id: 3,
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: null,
      }),
      makeSession({
        id: 4,
        status: "absent",
        materialsProvided: false,
        materialsReasonCode: 4,
      }),
      makeSession({
        id: 5,
        status: "present",
        materialsProvided: true,
        materialsReasonCode: 4,
      }),
      makeSession({
        id: 6,
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: 0,
      } as unknown as Partial<Session>),
      makeSession({
        id: 7,
        status: "absent",
        materialsProvided: true,
        materialsReasonCode: 7,
      } as unknown as Partial<Session>),
    ];

    expect(
      calculateTeacherServiceStatsByMonthRange(sessions, "2026-01", "2026-01")
    ).toEqual({
      presentCount: 1,
      materialsCount: 2,
      teacherServiceTotal: 3,
    });
  });

  it("returns zero totals for invalid ranges", () => {
    expect(
      calculateTeacherServiceStatsByMonthRange(
        [makeSession({ id: 1 })],
        "2026-02",
        "2026-01"
      )
    ).toEqual({
      presentCount: 0,
      materialsCount: 0,
      teacherServiceTotal: 0,
    });
  });
});

describe("validateMonthRange", () => {
  it("blocks start months after end months", () => {
    expect(validateMonthRange("2026-02", "2026-01")).toEqual({
      isValid: false,
      message: "開始月份不可晚於結束月份",
    });
  });

  it("blocks ranges longer than 12 months", () => {
    expect(validateMonthRange("2025-09", "2026-09")).toEqual({
      isValid: false,
      message: "月份範圍最多 12 個月",
    });
  });

  it("allows exactly 12 inclusive months", () => {
    expect(validateMonthRange("2025-09", "2026-08")).toEqual({
      isValid: true,
      monthCount: 12,
    });
  });

  it("blocks malformed month tokens", () => {
    expect(validateMonthRange("2026-1", "2026-08")).toEqual({
      isValid: false,
      message: "請選擇有效月份",
    });
  });

  it("blocks empty month tokens", () => {
    expect(validateMonthRange("", "2026-08")).toEqual({
      isValid: false,
      message: "請選擇有效月份",
    });
    expect(validateMonthRange("2026-01", "")).toEqual({
      isValid: false,
      message: "請選擇有效月份",
    });
  });
});
