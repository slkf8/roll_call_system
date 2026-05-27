import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGlobalEvent,
  deleteGlobalEvent,
  fetchGlobalEvents,
  updateGlobalEvent,
} from "./globalEventsApi";


const allDayEvent = {
  id: 1,
  dateISO: "2026-06-01",
  mode: "allDay",
  label: "假期",
  leaveReason: "惡劣天氣",
  start: null,
  end: null,
  note: null,
  createdAt: "2026-05-25T10:00:00",
  updatedAt: "2026-05-25T10:00:00",
};

const timeRangeEvent = {
  id: 2,
  dateISO: "2026-06-01",
  mode: "timeRange",
  label: "停課",
  leaveReason: "病假",
  start: "15:00",
  end: "18:00",
  note: "下午停課",
  createdAt: "2026-05-25T10:00:00",
  updatedAt: "2026-05-25T10:00:00",
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


describe("globalEventsApi", () => {
  it("fetches global events successfully", async () => {
    mockJsonResponse([allDayEvent]);

    await expect(fetchGlobalEvents()).resolves.toEqual([
      {
        id: 1,
        dateISO: "2026-06-01",
        mode: "allDay",
        label: "假期",
        leaveReason: "惡劣天氣",
        start: undefined,
        end: undefined,
        note: undefined,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/global-events");
  });

  it("builds the from/to query string", async () => {
    mockJsonResponse([]);

    await fetchGlobalEvents({ from: "2026-06-01", to: "2026-06-30" });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/global-events?from=2026-06-01&to=2026-06-30"
    );
  });

  it("throws when fetch response is not an array", async () => {
    mockJsonResponse({ ok: true });

    await expect(fetchGlobalEvents()).rejects.toThrow("Invalid global events response");
  });

  it("throws when an event has an invalid shape", async () => {
    mockJsonResponse([{ ...allDayEvent, id: "bad" }]);

    await expect(fetchGlobalEvents()).rejects.toThrow("Invalid global event response");
  });

  it("creates a global event with POST body", async () => {
    mockJsonResponse(timeRangeEvent);
    const payload = {
      dateISO: "2026-06-01",
      mode: "timeRange" as const,
      label: "停課" as const,
      leaveReason: "病假",
      start: "15:00",
      end: "18:00",
      note: "下午停課",
    };

    await expect(createGlobalEvent(payload)).resolves.toEqual(
      expect.objectContaining({
        id: 2,
        mode: "timeRange",
        start: "15:00",
        end: "18:00",
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/global-events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  it("updates a global event with PATCH body", async () => {
    mockJsonResponse({ ...timeRangeEvent, note: "已更新" });
    const payload = { note: "已更新" };

    await expect(updateGlobalEvent(2, payload)).resolves.toEqual(
      expect.objectContaining({ id: 2, note: "已更新" })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/global-events/2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    );
  });

  it("deletes a global event", async () => {
    mockJsonResponse({ ok: true });

    await expect(deleteGlobalEvent(2)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/global-events/2",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws for non-2xx responses", async () => {
    mockJsonResponse({ detail: "failed" }, false, 500);

    await expect(fetchGlobalEvents()).rejects.toThrow("Failed to fetch global events");
  });

  it("keeps timeRange start and end", async () => {
    mockJsonResponse([timeRangeEvent]);

    await expect(fetchGlobalEvents()).resolves.toEqual([
      expect.objectContaining({
        mode: "timeRange",
        start: "15:00",
        end: "18:00",
      }),
    ]);
  });

  it("maps null leaveReason to undefined", async () => {
    mockJsonResponse([{ ...allDayEvent, leaveReason: null }]);

    await expect(fetchGlobalEvents()).resolves.toEqual([
      expect.objectContaining({
        leaveReason: undefined,
      }),
    ]);
  });

  it("throws for invalid mode", async () => {
    mockJsonResponse([{ ...allDayEvent, mode: "partial" }]);

    await expect(fetchGlobalEvents()).rejects.toThrow("Invalid global event response");
  });

  it("throws for invalid delete response", async () => {
    mockJsonResponse({ ok: false });

    await expect(deleteGlobalEvent(2)).rejects.toThrow("Invalid delete global event response");
  });
});
