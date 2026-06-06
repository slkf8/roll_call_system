import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bulkDeleteSessions,
  checkSessionsBackendHealth,
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
        materialsProvided: false,
        materialsReasonCode: null,
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

  it("defaults materials fields and parses provided materials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          sessionResponse({ id: 1 }),
          sessionResponse({
            id: 2,
            status: "absent",
            reason: "生病",
            materialsProvided: true,
            materialsReasonCode: 4,
          }),
        ],
      }))
    );

    await expect(fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        materialsProvided: false,
        materialsReasonCode: null,
      }),
      expect.objectContaining({
        id: 2,
        materialsProvided: true,
        materialsReasonCode: 4,
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


function bulkDeleteResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    dryRun: true,
    removedCount: 12,
    detachedMakeupCount: 2,
    breakdown: {
      generatedRegular: 5,
      manualRegular: 2,
      makeup: 3,
      extra: 2,
      present: 4,
      absent: 2,
      pending: 5,
      cancelled: 1,
    },
    ...overrides,
  };
}


describe("bulkDeleteSessions", () => {
  it("posts a dryRun preview and parses the breakdown", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => bulkDeleteResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      bulkDeleteSessions(["2026-06-03", "2026-06-10"], true)
    ).resolves.toEqual({
      ok: true,
      dryRun: true,
      removedCount: 12,
      detachedMakeupCount: 2,
      breakdown: {
        generatedRegular: 5,
        manualRegular: 2,
        makeup: 3,
        extra: 2,
        present: 4,
        absent: 2,
        pending: 5,
        cancelled: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/bulk-delete",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: ["2026-06-03", "2026-06-10"], dryRun: true }),
      })
    );
  });

  it("posts a real delete with dryRun=false and parses counts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () =>
        bulkDeleteResponse({ dryRun: false, removedCount: 3, detachedMakeupCount: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await bulkDeleteSessions(["2026-06-03"], false);
    expect(result.dryRun).toBe(false);
    expect(result.removedCount).toBe(3);
    expect(result.detachedMakeupCount).toBe(1);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/bulk-delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dates: ["2026-06-03"], dryRun: false }),
      })
    );
  });

  it("sends an empty dates array as []", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () =>
        bulkDeleteResponse({ removedCount: 0, detachedMakeupCount: 0 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await bulkDeleteSessions([], true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/bulk-delete",
      expect.objectContaining({
        body: JSON.stringify({ dates: [], dryRun: true }),
      })
    );
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );

    await expect(bulkDeleteSessions(["2026-06-03"], false)).rejects.toThrow(
      "Failed to bulk delete sessions"
    );
  });

  it("throws when ok !== true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ ok: false }),
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("throws when dryRun is not a boolean", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ dryRun: "yes" }),
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("throws when removedCount / detachedMakeupCount are not numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ removedCount: "12" }),
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ detachedMakeupCount: null }),
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("throws when breakdown is missing", async () => {
    const { breakdown: _omit, ...withoutBreakdown } = bulkDeleteResponse();
    void _omit;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => withoutBreakdown,
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("throws when a breakdown field is missing", async () => {
    const response = bulkDeleteResponse();
    delete (response.breakdown as Record<string, unknown>).extra;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => response,
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("throws when a breakdown field is not a number", async () => {
    const response = bulkDeleteResponse();
    (response.breakdown as Record<string, unknown>).makeup = "3";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => response,
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });

  it("rejects top-level counts that are negative, fractional, NaN, or Infinity", async () => {
    const bad = [
      bulkDeleteResponse({ removedCount: -1 }),
      bulkDeleteResponse({ detachedMakeupCount: 1.5 }),
      bulkDeleteResponse({ removedCount: NaN }),
      bulkDeleteResponse({ detachedMakeupCount: Infinity }),
    ];
    for (const response of bad) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => response }))
      );
      await expect(bulkDeleteSessions([], true)).rejects.toThrow(
        "Invalid bulk delete session response"
      );
    }
  });

  it("rejects breakdown counts that are negative, fractional, NaN, or Infinity", async () => {
    const variants: Array<Record<string, unknown>> = [
      { generatedRegular: -1 },
      { makeup: 2.5 },
      { present: NaN },
      { cancelled: Infinity },
    ];
    for (const patch of variants) {
      const response = bulkDeleteResponse();
      Object.assign(response.breakdown as Record<string, unknown>, patch);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => response }))
      );
      await expect(bulkDeleteSessions([], true)).rejects.toThrow(
        "Invalid bulk delete session response"
      );
    }
  });

  it("rejects when response.dryRun does not echo the request dryRun", async () => {
    // request dryRun=true, response dryRun=false
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ dryRun: false }),
      }))
    );
    await expect(bulkDeleteSessions([], true)).rejects.toThrow(
      "Invalid bulk delete session response"
    );

    // request dryRun=false, response dryRun=true
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bulkDeleteResponse({ dryRun: true }),
      }))
    );
    await expect(bulkDeleteSessions([], false)).rejects.toThrow(
      "Invalid bulk delete session response"
    );
  });
});


describe("checkSessionsBackendHealth", () => {
  it("resolves when GET /health returns 200 + { ok: true }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, dataDirFingerprint: "abc123" }),
      }))
    );

    await expect(checkSessionsBackendHealth()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/health");
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ ok: true }),
      }))
    );

    await expect(checkSessionsBackendHealth()).rejects.toThrow(
      "Failed to check sessions backend health: 503"
    );
  });

  it("throws when payload is not an object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => "not-an-object",
      }))
    );

    await expect(checkSessionsBackendHealth()).rejects.toThrow(
      "Invalid sessions backend health response"
    );
  });

  it("throws when ok !== true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: false }),
      }))
    );

    await expect(checkSessionsBackendHealth()).rejects.toThrow(
      "Invalid sessions backend health response"
    );
  });

  it("propagates a network reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(checkSessionsBackendHealth()).rejects.toThrow("network down");
  });
});
