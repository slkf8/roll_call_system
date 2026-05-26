import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  deleteSession,
  fetchSessions,
  updateSession,
} from "./sessionsApi";


function sessionResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    studentId: 10,
    student: {
      id: 10,
      name: "Session API 驗收學生",
    },
    dateISO: "2026-06-01",
    start: "16:00",
    durationMin: 60,
    status: "pending",
    reason: null,
    note: null,
    kind: "regular",
    makeupOfDateISO: null,
    makeupOfSessionId: null,
    scheduleRuleId: 101,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
    ...overrides,
  };
}


afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});


describe("sessionsApi", () => {
  it("fetches sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [sessionResponse()],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      {
        id: 1,
        studentId: 10,
        student: {
          id: 10,
          name: "Session API 驗收學生",
        },
        dateISO: "2026-06-01",
        start: "16:00",
        durationMin: 60,
        status: "pending",
        reason: undefined,
        note: undefined,
        kind: "regular",
        makeupOfDateISO: undefined,
        makeupOfSessionId: undefined,
        scheduleRuleId: 101,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/sessions");
  });

  it("fetches sessions with from, to, and studentId query params", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [],
      }))
    );

    await fetchSessions({ from: "2026-06-01", to: "2026-06-30", studentId: 10 });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions?from=2026-06-01&to=2026-06-30&studentId=10"
    );
  });

  it("throws when fetchSessions response is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => sessionResponse(),
      }))
    );

    await expect(fetchSessions()).rejects.toThrow("Invalid sessions response");
  });

  it("throws when a session item has invalid shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [sessionResponse({ status: "done" })],
      }))
    );

    await expect(fetchSessions()).rejects.toThrow("Invalid session response");
  });

  it("creates a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => sessionResponse({ id: 2, kind: "extra", scheduleRuleId: null }),
      }))
    );

    await expect(
      createSession({
        studentId: 10,
        dateISO: "2026-06-05",
        start: "18:00",
        durationMin: 60,
        status: "pending",
        reason: null,
        note: "臨時加課",
        kind: "extra",
        makeupOfDateISO: null,
        makeupOfSessionId: null,
        scheduleRuleId: null,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        kind: "extra",
        scheduleRuleId: undefined,
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          studentId: 10,
          dateISO: "2026-06-05",
          start: "18:00",
          durationMin: 60,
          status: "pending",
          reason: null,
          note: "臨時加課",
          kind: "extra",
          makeupOfDateISO: null,
          makeupOfSessionId: null,
          scheduleRuleId: null,
        }),
      })
    );
  });

  it("updates a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => sessionResponse({ status: "present", reason: "出席確認" }),
      }))
    );

    await expect(updateSession(1, { status: "present", reason: "出席確認" })).resolves.toEqual(
      expect.objectContaining({
        id: 1,
        status: "present",
        reason: {
          id: 0,
          name: "出席確認",
          code: "BACKEND_REASON",
        },
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "present", reason: "出席確認" }),
      })
    );
  });

  it("deletes a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, detachedMakeupCount: 1 }),
      }))
    );

    await expect(deleteSession(1)).resolves.toEqual({
      ok: true,
      detachedMakeupCount: 1,
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/1",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("throws on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );

    await expect(fetchSessions()).rejects.toThrow("Failed to fetch sessions");
  });

  it("throws on invalid delete response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      }))
    );

    await expect(deleteSession(1)).rejects.toThrow("Invalid delete session response");
  });

  it("adapts orphan session student=null to fallback student snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          sessionResponse({
            studentId: null,
            student: null,
            kind: "extra",
            scheduleRuleId: null,
          }),
        ],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        studentId: undefined,
        student: {
          id: 0,
          name: "未關聯學生",
        },
        kind: "extra",
      }),
    ]);
  });

  it("preserves backend student snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          sessionResponse({
            student: {
              id: 12,
              name: "後端學生 snapshot",
            },
          }),
        ],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        student: {
          id: 12,
          name: "後端學生 snapshot",
        },
      }),
    ]);
  });

  it("maps reason string and null safely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          sessionResponse({ id: 1, reason: "生病" }),
          sessionResponse({ id: 2, reason: null }),
        ],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        reason: {
          id: 0,
          name: "生病",
          code: "BACKEND_REASON",
        },
      }),
      expect.objectContaining({
        reason: undefined,
      }),
    ]);
  });

  it("maps scheduleRuleId when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [sessionResponse({ scheduleRuleId: 456 })],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        scheduleRuleId: 456,
      }),
    ]);
  });
});
