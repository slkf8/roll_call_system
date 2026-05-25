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
  const container = labelNode.parentElement;
  if (!container) throw new Error(`Container not found for ${label}`);
  return within(container);
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
      json: async () => [
        {
          id: 501,
          name: "後端學生",
          birthday: "2012-01-02",
          school: "後端學校",
          status: "active",
          deactivateMode: null,
          deactivateOn: null,
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
    expect(screen.queryByText("尚未建立任何學生")).not.toBeInTheDocument();
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
      studentScheduleRules: [],
      globalEvents: [],
    });

    render(<App />);

    expect(await screen.findByText("管理學生")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("尚未建立任何學生")).toBeInTheDocument();
      expect(screen.queryByText("本地學生")).not.toBeInTheDocument();
    });
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
