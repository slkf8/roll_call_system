import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createScheduleRule,
  deleteScheduleRule,
  fetchScheduleRules,
  updateScheduleRule,
} from "./scheduleRulesApi";


function ruleResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    studentId: 10,
    weekday: 1,
    start: "16:00",
    durationMin: 60,
    isActive: true,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
    ...overrides,
  };
}


afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});


describe("scheduleRulesApi", () => {
  it("fetches schedule rules", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [ruleResponse()],
      }))
    );

    await expect(fetchScheduleRules(10)).resolves.toEqual([
      {
        id: 1,
        studentId: 10,
        weekday: 1,
        start: "16:00",
        durationMin: 60,
        isActive: true,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/students/10/schedule-rules");
  });

  it("creates a schedule rule", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ruleResponse({ id: 2, weekday: 5, start: "18:30" }),
      }))
    );

    await expect(
      createScheduleRule(10, { weekday: 5, start: "18:30", durationMin: 45, isActive: true })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        studentId: 10,
        weekday: 5,
        start: "18:30",
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/10/schedule-rules",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekday: 5,
          start: "18:30",
          durationMin: 45,
          isActive: true,
        }),
      })
    );
  });

  it("updates a schedule rule", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ruleResponse({ id: 3, isActive: false }),
      }))
    );

    await expect(updateScheduleRule(3, { isActive: false })).resolves.toEqual(
      expect.objectContaining({
        id: 3,
        isActive: false,
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/schedule-rules/3",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      })
    );
  });

  it("deletes a schedule rule", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      }))
    );

    await expect(deleteScheduleRule(3)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/schedule-rules/3",
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

    await expect(fetchScheduleRules(10)).rejects.toThrow("Failed to fetch schedule rules");
  });

  it("throws on invalid response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [ruleResponse({ weekday: 8 })],
      }))
    );

    await expect(fetchScheduleRules(10)).rejects.toThrow("Invalid schedule rule response");
  });
});
