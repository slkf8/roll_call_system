import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { STORAGE_KEY } from "../shared/appShared";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}

function setStoredAppData(data: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getValueNearLabel(label: string) {
  const labelNode = screen.getAllByText(label)[0];
  const container =
    labelNode.closest("button") ??
    (labelNode.parentElement?.textContent?.trim() === label
      ? labelNode.parentElement.parentElement
      : labelNode.parentElement);
  if (!container) throw new Error(`Container not found for ${label}`);
  return within(container);
}

function backendStudentResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    name: "後端學生",
    birthday: "2012-01-02",
    school: "後端學校",
    status: "active",
    deactivateMode: null,
    deactivateOn: null,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
    ...overrides,
  };
}

function backendSessionResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 7001,
    studentId: 501,
    student: {
      id: 501,
      name: "後端課次學生",
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
    scheduleRuleId: null,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
    ...overrides,
  };
}

function backendGlobalEventResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 8001,
    dateISO: "2026-06-01",
    mode: "allDay",
    label: "假期",
    leaveReason: "惡劣天氣",
    start: null,
    end: null,
    note: null,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
    ...overrides,
  };
}

beforeEach(() => {
  installMemoryLocalStorage();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("backend unavailable")))
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App empty data safety", () => {
  it("uses backend students when GET /api/students succeeds", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [backendStudentResponse()],
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 601,
          studentId: 501,
          weekday: 1,
          start: "16:00",
          durationMin: 60,
          isActive: true,
          createdAt: "2026-05-25T10:00:00",
          updatedAt: "2026-05-25T10:00:00",
        },
      ],
    } as Response);
    setStoredAppData({
      activeTab: "students",
      selectedDate: "2026-05-20",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("管理學生")).toBeInTheDocument();
    expect(await screen.findByText("後端學生")).toBeInTheDocument();
    expect(await screen.findByText("共 1 條規則")).toBeInTheDocument();
    expect(screen.queryByText("尚未建立任何學生")).not.toBeInTheDocument();
  });

  it("loads backend sessions after backend students succeed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendSessionResponse()],
      } as Response);
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [
        {
          id: 1,
          studentId: 1,
          student: { id: 1, name: "本地課次學生" },
          dateISO: "2026-06-01",
          start: "10:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("後端課次學生")).toBeInTheDocument();
    expect(screen.queryByText("本地課次學生")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/sessions");
    });
  });

  it("treats an empty backend sessions response as a valid empty source", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [
        {
          id: 1,
          studentId: 1,
          student: { id: 1, name: "本地課次學生" },
          dateISO: "2026-06-01",
          start: "10:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    expect(screen.queryByText("本地課次學生")).not.toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.sessions).toEqual([]);
    });
  });

  it("keeps fallback sessions when backend sessions loading fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockRejectedValueOnce(new Error("sessions unavailable"));
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [
        {
          id: 1,
          studentId: 1,
          student: { id: 1, name: "本地課次學生" },
          dateISO: "2026-06-01",
          start: "10:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("出席紀錄系統")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/sessions");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.sessions).toEqual([
        expect.objectContaining({
          id: 1,
          studentId: 1,
          dateISO: "2026-06-01",
          start: "10:00",
        }),
      ]);
    });
    expect(screen.queryByText("後端課次學生")).not.toBeInTheDocument();
  });

  it("loads backend global events after startup", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendGlobalEventResponse()],
      } as Response);
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("出席紀錄系統")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/global-events");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.globalEvents).toEqual([
        expect.objectContaining({
          id: 8001,
          dateISO: "2026-06-01",
          mode: "allDay",
          label: "假期",
          leaveReason: "惡劣天氣",
        }),
      ]);
    });
  });

  it("treats an empty backend global events response as a valid empty source", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [
        {
          id: 1,
          dateISO: "2026-06-01",
          mode: "allDay",
          label: "假期",
          leaveReason: "惡劣天氣",
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText("出席紀錄系統")).toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.globalEvents).toEqual([]);
    });
  });

  it("keeps fallback global events when backend global events loading fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [backendStudentResponse()],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockRejectedValueOnce(new Error("global events unavailable"));
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [
        {
          id: 1,
          dateISO: "2026-06-01",
          mode: "timeRange",
          label: "停課",
          leaveReason: "病假",
          start: "15:00",
          end: "18:00",
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText("出席紀錄系統")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/global-events");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.globalEvents).toEqual([
        expect.objectContaining({
          id: 1,
          dateISO: "2026-06-01",
          mode: "timeRange",
          label: "停課",
          leaveReason: "病假",
          start: "15:00",
          end: "18:00",
        }),
      ]);
    });
  });

  it("treats an empty backend students response as a valid empty source", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);
    setStoredAppData({
      activeTab: "students",
      selectedDate: "2026-05-20",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [],
      studentScheduleRules: [
        { id: 1, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
      ],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("管理學生")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("尚未建立任何學生")).toBeInTheDocument();
      expect(screen.queryByText("本地學生")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.studentScheduleRules).toEqual([]);
    });
  });

  it("keeps fallback schedule rules when backend rules loading fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: "本地學生",
            birthday: "2012-03-08",
            school: "本地學校",
            status: "active",
            deactivateMode: null,
            deactivateOn: null,
            createdAt: "2026-05-25T10:00:00",
            updatedAt: "2026-05-25T10:00:00",
          },
        ],
      } as Response)
      .mockRejectedValueOnce(new Error("rules unavailable"));
    setStoredAppData({
      activeTab: "students",
      selectedDate: "2026-05-20",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [],
      studentScheduleRules: [
        { id: 1, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
      ],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("本地學生")).toBeInTheDocument();
    expect(await screen.findByText("共 1 條規則")).toBeInTheDocument();
  });

  it("keeps local fallback students when backend students loading fails", async () => {
    setStoredAppData({
      activeTab: "students",
      selectedDate: "2026-05-20",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("本地學生")).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/students"));
    expect(screen.queryByText("尚未建立任何學生")).not.toBeInTheDocument();
  });

  it("keeps local fallback sessions when backend students loading fails", async () => {
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-06-01",
      students: [
        {
          id: 1,
          name: "本地學生",
          birthday: "2012-03-08",
          school: "本地學校",
          status: "active",
        },
      ],
      sessions: [
        {
          id: 1,
          studentId: 1,
          student: { id: 1, name: "本地課次學生" },
          dateISO: "2026-06-01",
          start: "10:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("出席紀錄系統")).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/students"));
    expect(fetch).not.toHaveBeenCalledWith("http://127.0.0.1:8000/api/sessions");
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.sessions).toEqual([
        expect.objectContaining({
          id: 1,
          studentId: 1,
          dateISO: "2026-06-01",
          start: "10:00",
        }),
      ]);
    });
  });

  it("respects persisted empty arrays without injecting demo sessions", async () => {
    setStoredAppData({
      activeTab: "data",
      selectedDate: "2026-05-01",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("數據與匯出")).toBeInTheDocument();
    expect(getValueNearLabel("老師服務總次數").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("0")).toBeInTheDocument();
    expect(screen.getByText("尚未建立學生資料。")).toBeInTheDocument();
  });

  it("falls back safely when localStorage contains partial or invalid fields", async () => {
    setStoredAppData({
      activeTab: "not-a-tab",
      selectedDate: "not-a-date",
      students: "bad",
      sessions: "bad",
      studentScheduleRules: "bad",
      globalEvents: "bad",
    });

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
  });

  it("does not name-match or create students for old sessions without studentId", async () => {
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-05-20",
      students: [
        {
          id: 1,
          name: "陳小明",
          birthday: "2012-03-08",
          school: "培正中學",
          status: "active",
        },
      ],
      sessions: [
        {
          id: 99,
          student: { id: 999, name: "陳小明" },
          dateISO: "2026-05-20",
          start: "10:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("陳小明")).toBeInTheDocument();

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.sessions[0].studentId).toBeUndefined();
      expect(saved.students).toHaveLength(1);
    });
  });

  it("shows a safe orphan student name for corrupt sessions", async () => {
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-05-20",
      students: [],
      sessions: [
        {
          id: 100,
          dateISO: "2026-05-20",
          start: "11:00",
          durationMin: 60,
          status: "pending",
          kind: "regular",
        },
      ],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("未關聯學生")).toBeInTheDocument();
  });

  it("keeps TodayPage safe when there are no students and no sessions", async () => {
    const user = userEvent.setup();
    setStoredAppData({
      activeTab: "today",
      selectedDate: "2026-05-20",
      students: [],
      sessions: [],
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("今日沒有課次")).toBeInTheDocument();
    await user.click(screen.getByLabelText("新增課次"));

    expect(await screen.findByText("請先新增學生")).toBeInTheDocument();
  });
});
