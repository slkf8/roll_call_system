import { describe, expect, it } from "vitest";
import type { Session } from "./appShared";
import { applyBulkRemovalToSessions } from "./bulkRemove";

function makeSession(
  over: Partial<Session> & Pick<Session, "id" | "dateISO">
): Session {
  return {
    studentId: 1,
    student: { id: 1, name: "陳小明" },
    start: "16:00",
    durationMin: 60,
    status: "pending",
    kind: "regular",
    materialsProvided: false,
    materialsReasonCode: null,
    ...over,
  };
}

describe("applyBulkRemovalToSessions", () => {
  it("returns the same content when dates is empty", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }),
      makeSession({ id: 2, dateISO: "2026-06-10" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, []);
    expect(result).toEqual(sessions);
  });

  it("removes all sessions on a single selected date", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03", start: "09:00" }),
      makeSession({ id: 2, dateISO: "2026-06-03", start: "10:00" }),
      makeSession({ id: 3, dateISO: "2026-06-10" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result.map((s) => s.id)).toEqual([3]);
  });

  it("removes sessions across multiple selected dates", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }),
      makeSession({ id: 2, dateISO: "2026-06-10" }),
      makeSession({ id: 3, dateISO: "2026-06-17" }),
      makeSession({ id: 4, dateISO: "2026-06-24" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, [
      "2026-06-03",
      "2026-06-17",
    ]);
    expect(result.map((s) => s.id)).toEqual([2, 4]);
  });

  it("is stable when dates contains duplicates", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }),
      makeSession({ id: 2, dateISO: "2026-06-10" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, [
      "2026-06-03",
      "2026-06-03",
      "2026-06-03",
    ]);
    expect(result.map((s) => s.id)).toEqual([2]);
  });

  it("removes any kind (regular / makeup / extra)", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03", kind: "regular" }),
      makeSession({ id: 2, dateISO: "2026-06-03", kind: "makeup" }),
      makeSession({ id: 3, dateISO: "2026-06-03", kind: "extra" }),
      makeSession({ id: 4, dateISO: "2026-06-10", kind: "regular" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result.map((s) => s.id)).toEqual([4]);
  });

  it("removes any status (pending / present / absent / cancelled)", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03", status: "pending" }),
      makeSession({ id: 2, dateISO: "2026-06-03", status: "present" }),
      makeSession({ id: 3, dateISO: "2026-06-03", status: "absent" }),
      makeSession({ id: 4, dateISO: "2026-06-03", status: "cancelled" }),
      makeSession({ id: 5, dateISO: "2026-06-10", status: "present" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result.map((s) => s.id)).toEqual([5]);
  });

  it("keeps sessions on unselected dates untouched", () => {
    const kept = makeSession({ id: 2, dateISO: "2026-06-10", note: "保留" });
    const sessions = [makeSession({ id: 1, dateISO: "2026-06-03" }), kept];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(kept); // same reference, unchanged
  });

  it("detaches a surviving cross-range makeup that referenced a removed source", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }), // source, removed
      makeSession({
        id: 2,
        dateISO: "2026-07-10", // survives (different month)
        kind: "makeup",
        makeupOfSessionId: 1,
        makeupOfDateISO: "2026-06-03",
      }),
    ];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result.map((s) => s.id)).toEqual([2]);
    expect(result[0].makeupOfSessionId).toBeUndefined();
  });

  it("preserves makeupOfDateISO after detach", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }),
      makeSession({
        id: 2,
        dateISO: "2026-07-10",
        kind: "makeup",
        makeupOfSessionId: 1,
        makeupOfDateISO: "2026-06-03",
      }),
    ];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result[0].makeupOfDateISO).toBe("2026-06-03");
  });

  it("leaves an unrelated makeup (referencing a kept source) unchanged", () => {
    const makeup = makeSession({
      id: 2,
      dateISO: "2026-07-10",
      kind: "makeup",
      makeupOfSessionId: 99, // points at a session not being removed
      makeupOfDateISO: "2026-05-01",
    });
    const sessions = [makeSession({ id: 1, dateISO: "2026-06-03" }), makeup];
    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(makeup); // unchanged reference
    expect(result[0].makeupOfSessionId).toBe(99);
  });

  it("removes both source and makeup when both fall on selected dates", () => {
    const sessions = [
      makeSession({ id: 1, dateISO: "2026-06-03" }), // source
      makeSession({
        id: 2,
        dateISO: "2026-06-04",
        kind: "makeup",
        makeupOfSessionId: 1,
        makeupOfDateISO: "2026-06-03",
      }),
      makeSession({ id: 3, dateISO: "2026-06-10" }),
    ];
    const result = applyBulkRemovalToSessions(sessions, [
      "2026-06-03",
      "2026-06-04",
    ]);
    expect(result.map((s) => s.id)).toEqual([3]);
  });

  it("is pure: no mutation of input array or objects, survivor order preserved", () => {
    const source = makeSession({ id: 1, dateISO: "2026-06-03" });
    const makeup = makeSession({
      id: 2,
      dateISO: "2026-07-10",
      kind: "makeup",
      makeupOfSessionId: 1,
      makeupOfDateISO: "2026-06-03",
    });
    const other = makeSession({ id: 3, dateISO: "2026-06-25" });
    const sessions = [source, makeup, other];
    const snapshot = sessions.map((s) => ({ ...s }));

    const result = applyBulkRemovalToSessions(sessions, ["2026-06-03"]);

    // input array length + element identity unchanged
    expect(sessions).toHaveLength(3);
    expect(sessions[0]).toBe(source);
    expect(sessions[1]).toBe(makeup);
    expect(sessions[2]).toBe(other);
    // input objects unchanged field-by-field
    sessions.forEach((s, i) => expect(s).toEqual(snapshot[i]));
    // makeup object itself not mutated (detach produced a new object)
    expect(makeup.makeupOfSessionId).toBe(1);

    // result is a new array; survivor order = [makeup(detached), other]
    expect(result).not.toBe(sessions);
    expect(result.map((s) => s.id)).toEqual([2, 3]);
    expect(result[0]).not.toBe(makeup); // detached copy
    expect(result[1]).toBe(other); // untouched survivor keeps identity
  });
});
