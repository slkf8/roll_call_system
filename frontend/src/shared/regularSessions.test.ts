import { describe, expect, it } from "vitest";
import type { Session, StudentProfile, StudentScheduleRule } from "./appShared";
import {
  buildRegularSessionsInDates,
  getDatesInRange,
  getMonthEndISO,
  getMonthRemainingDates,
  getMonthStartISO,
  isWithinMonthRemaining,
} from "./regularSessions";

function makeStudent(over: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 1,
    name: "陳小明",
    birthday: "2012-03-08",
    school: "培正中學",
    status: "active",
    ...over,
  };
}

function makeRule(over: Partial<StudentScheduleRule> = {}): StudentScheduleRule {
  return {
    id: 10,
    studentId: 1,
    weekday: 1, // Monday
    start: "16:00",
    durationMin: 60,
    isActive: true,
    ...over,
  };
}

function makeSession(
  over: Partial<Session> & Pick<Session, "id" | "dateISO" | "start">
): Session {
  return {
    studentId: 1,
    student: { id: 1, name: "陳小明" },
    durationMin: 60,
    status: "pending",
    kind: "regular",
    materialsProvided: false,
    materialsReasonCode: null,
    ...over,
  };
}

describe("getDatesInRange", () => {
  it("expands an inclusive range in order", () => {
    const result = getDatesInRange("2026-06-01", "2026-06-03").map((d) => d.dateISO);
    expect(result).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("returns the single day when from === to", () => {
    const result = getDatesInRange("2026-06-10", "2026-06-10").map((d) => d.dateISO);
    expect(result).toEqual(["2026-06-10"]);
  });

  it("returns empty when from is after to", () => {
    expect(getDatesInRange("2026-06-10", "2026-06-01")).toEqual([]);
  });

  it("returns empty on malformed input", () => {
    expect(getDatesInRange("", "2026-06-01")).toEqual([]);
  });
});

describe("getMonthStartISO / getMonthEndISO", () => {
  it("computes month start", () => {
    expect(getMonthStartISO("2026-06-15")).toBe("2026-06-01");
  });

  it("computes month end for a 30-day month", () => {
    expect(getMonthEndISO("2026-06-15")).toBe("2026-06-30");
  });

  it("computes month end for February (non-leap 2026)", () => {
    expect(getMonthEndISO("2026-02-10")).toBe("2026-02-28");
  });

  it("returns empty string on malformed anchor", () => {
    expect(getMonthStartISO("bad")).toBe("");
    expect(getMonthEndISO("bad")).toBe("");
  });
});

describe("getMonthRemainingDates", () => {
  it("returns the anchor day through end of month, staying in-month", () => {
    const result = getMonthRemainingDates("2026-06-28").map((d) => d.dateISO);
    expect(result).toEqual(["2026-06-28", "2026-06-29", "2026-06-30"]);
  });

  it("returns empty on malformed anchor", () => {
    expect(getMonthRemainingDates("2026-06")).toEqual([]);
  });
});

describe("isWithinMonthRemaining", () => {
  it("is true for a later day in the same month", () => {
    expect(isWithinMonthRemaining("2026-06-29", "2026-06-28")).toBe(true);
  });

  it("is false before the anchor", () => {
    expect(isWithinMonthRemaining("2026-06-27", "2026-06-28")).toBe(false);
  });

  it("is false in the next month", () => {
    expect(isWithinMonthRemaining("2026-07-01", "2026-06-28")).toBe(false);
  });
});

describe("buildRegularSessionsInDates", () => {
  it("only generates on dates matching the rule weekday", () => {
    const student = makeStudent();
    const rule = makeRule({ weekday: 1, start: "16:00" }); // Mondays
    const dates = getDatesInRange("2026-06-01", "2026-06-14");

    const { generatedSessions, skippedCount } = buildRegularSessionsInDates(
      student,
      [rule],
      [],
      dates
    );

    // June 2026: Mondays in 1..14 are the 1st and 8th.
    expect(generatedSessions.map((c) => c.session.dateISO)).toEqual([
      "2026-06-01",
      "2026-06-08",
    ]);
    expect(skippedCount).toBe(0);
  });

  it("dedups against an existing regular session at the same slot", () => {
    const student = makeStudent();
    const rule = makeRule({ weekday: 1, start: "16:00" });
    const base = [makeSession({ id: 5, dateISO: "2026-06-01", start: "16:00" })];
    const dates = getDatesInRange("2026-06-01", "2026-06-08");

    const { generatedSessions, skippedCount } = buildRegularSessionsInDates(
      student,
      [rule],
      base,
      dates
    );

    // 2026-06-01 is a duplicate (same student/date/start/regular) → skipped.
    expect(skippedCount).toBe(1);
    expect(generatedSessions.map((c) => c.session.dateISO)).toEqual(["2026-06-08"]);
  });

  it("does not dedup against a different kind at the same slot", () => {
    const student = makeStudent();
    const rule = makeRule({ weekday: 1, start: "16:00" });
    // A makeup occupies the same slot; it must NOT block regular generation.
    const base = [
      makeSession({ id: 5, dateISO: "2026-06-01", start: "16:00", kind: "makeup" }),
    ];
    const dates = getDatesInRange("2026-06-01", "2026-06-08");

    const { generatedSessions, skippedCount } = buildRegularSessionsInDates(
      student,
      [rule],
      base,
      dates
    );

    expect(skippedCount).toBe(0);
    expect(generatedSessions.map((c) => c.session.dateISO)).toEqual([
      "2026-06-01",
      "2026-06-08",
    ]);
  });

  it("preserves scheduleRuleId on each candidate", () => {
    const student = makeStudent();
    const rule = makeRule({ id: 42, weekday: 1, start: "16:00" });
    const dates = getDatesInRange("2026-06-01", "2026-06-01");

    const { generatedSessions } = buildRegularSessionsInDates(
      student,
      [rule],
      [],
      dates
    );

    expect(generatedSessions).toHaveLength(1);
    expect(generatedSessions[0].scheduleRuleId).toBe(42);
  });

  it("keeps generated field semantics and increments ids from base", () => {
    const student = makeStudent({ id: 7, name: "李小欣" });
    const rule = makeRule({ id: 3, studentId: 7, weekday: 1, start: "09:30", durationMin: 90 });
    const base = [makeSession({ id: 5, dateISO: "2026-05-01", start: "16:00" })];
    const dates = getDatesInRange("2026-06-01", "2026-06-01");

    const { generatedSessions } = buildRegularSessionsInDates(
      student,
      [rule],
      base,
      dates
    );

    expect(generatedSessions).toHaveLength(1);
    const { session } = generatedSessions[0];
    expect(session.id).toBe(6); // getNextSessionId([id:5]) === 6
    expect(session.studentId).toBe(7);
    expect(session.student).toEqual({ id: 7, name: "李小欣" });
    expect(session.dateISO).toBe("2026-06-01");
    expect(session.start).toBe("09:30");
    expect(session.durationMin).toBe(90);
    expect(session.status).toBe("pending");
    expect(session.kind).toBe("regular");
    expect(session.materialsProvided).toBe(false);
    expect(session.materialsReasonCode).toBeNull();
  });
});
