import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMonthlyStatistics } from "./statisticsApi";


const monthlyStatisticsResponse = {
  month: "2026-06",
  from: "2026-06-01",
  to: "2026-06-30",
  summary: {
    teacherServiceTotal: 3,
    monthlySessionCount: 6,
    presentCount: 4,
    absentCount: 1,
    pendingCount: 1,
    cancelledCount: 0,
    scheduleRuleCount: 2,
    globalEventCount: 1,
  },
  students: [
    {
      studentId: 1,
      studentName: "陳小明",
      birthday: "2012-03-08",
      school: "培正中學",
      status: "active",
      regularPresentCount: 1,
      makeupPresentCount: 1,
      extraPresentCount: 1,
      totalPresentCount: 3,
    },
  ],
  warnings: [
    {
      code: "ORPHAN_PRESENT_SESSIONS_NOT_IN_TEACHER_TOTAL",
      message: "Some present sessions have no studentId and are counted in presentCount but not teacherServiceTotal.",
      count: 1,
    },
  ],
};


function mockJsonResponse(data: unknown, ok = true, status = ok ? 200 : 500) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => data,
    }))
  );
}


afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});


describe("statisticsApi", () => {
  it("fetches monthly statistics successfully", async () => {
    mockJsonResponse(monthlyStatisticsResponse);

    await expect(fetchMonthlyStatistics("2026-06")).resolves.toEqual(monthlyStatisticsResponse);
  });

  it("builds the month query string", async () => {
    mockJsonResponse(monthlyStatisticsResponse);

    await fetchMonthlyStatistics("2026-06");

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/statistics/monthly?month=2026-06"
    );
  });

  it("throws on non-2xx responses", async () => {
    mockJsonResponse({ detail: "failed" }, false, 500);

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Failed to fetch monthly statistics"
    );
  });

  it("throws when response is not an object", async () => {
    mockJsonResponse([]);

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics response"
    );
  });

  it("throws when summary is missing or invalid", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      summary: {
        ...monthlyStatisticsResponse.summary,
        presentCount: "4",
      },
    });

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics response"
    );
  });

  it("throws when students is not an array", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      students: {},
    });

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics students response"
    );
  });

  it("throws when a student row is invalid", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      students: [
        {
          ...monthlyStatisticsResponse.students[0],
          totalPresentCount: "3",
        },
      ],
    });

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics response"
    );
  });

  it("throws when warnings is not an array", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      warnings: {},
    });

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics warnings response"
    );
  });

  it("throws when a warning is invalid", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      warnings: [
        {
          ...monthlyStatisticsResponse.warnings[0],
          count: "1",
        },
      ],
    });

    await expect(fetchMonthlyStatistics("2026-06")).rejects.toThrow(
      "Invalid monthly statistics response"
    );
  });

  it("keeps cancelled, schedule rule, and global event counts", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      summary: {
        ...monthlyStatisticsResponse.summary,
        cancelledCount: 2,
        scheduleRuleCount: 7,
        globalEventCount: 4,
      },
    });

    await expect(fetchMonthlyStatistics("2026-06")).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          cancelledCount: 2,
          scheduleRuleCount: 7,
          globalEventCount: 4,
        }),
      })
    );
  });

  it("keeps orphan warnings", async () => {
    mockJsonResponse(monthlyStatisticsResponse);

    await expect(fetchMonthlyStatistics("2026-06")).resolves.toEqual(
      expect.objectContaining({
        warnings: [
          {
            code: "ORPHAN_PRESENT_SESSIONS_NOT_IN_TEACHER_TOTAL",
            message:
              "Some present sessions have no studentId and are counted in presentCount but not teacherServiceTotal.",
            count: 1,
          },
        ],
      })
    );
  });

  it("accepts empty students and warnings", async () => {
    mockJsonResponse({
      ...monthlyStatisticsResponse,
      students: [],
      warnings: [],
    });

    await expect(fetchMonthlyStatistics("2026-06")).resolves.toEqual(
      expect.objectContaining({
        students: [],
        warnings: [],
      })
    );
  });
});
