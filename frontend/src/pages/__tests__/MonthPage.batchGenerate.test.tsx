import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession } from "../../api/sessionsApi";
import type { SessionCreatePayload } from "../../api/sessionsApi";
import type {
  GlobalEvent,
  Session,
  StudentProfile,
  StudentScheduleRule,
} from "../../shared/appShared";
import MonthPage from "../MonthPage";

vi.mock("../../api/globalEventsApi", () => ({
  createGlobalEvent: vi.fn(),
  deleteGlobalEvent: vi.fn(),
  updateGlobalEvent: vi.fn(),
}));

vi.mock("../../api/sessionsApi", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  updateSession: vi.fn(),
}));

// selectedDate 2026-04-20 → viewDate 為 2026 年 4 月。
const SELECTED_DATE = "2026-04-20";

function makeStudents(): StudentProfile[] {
  return [
    { id: 1, name: "陳小明", birthday: "2012-03-08", school: "培正中學", status: "active" },
    {
      id: 2,
      name: "李小欣",
      birthday: "2011-11-21",
      school: "聖羅撒",
      status: "scheduled_deactivation",
      deactivateMode: "scheduled",
      deactivateOn: "2026-05-01",
    },
    {
      id: 3,
      name: "王家朗",
      birthday: "2012-03-08",
      school: "坊眾",
      status: "inactive",
      deactivateMode: "immediate",
    },
  ];
}

function makeRules(): StudentScheduleRule[] {
  return [
    { id: 101, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
    { id: 102, studentId: 1, weekday: 3, start: "17:00", durationMin: 45, isActive: true },
    { id: 103, studentId: 1, weekday: 5, start: "18:00", durationMin: 30, isActive: false },
  ];
}

// Builds the ApiSession a backend createSession call would resolve with.
function builtSession(
  payload: SessionCreatePayload,
  id: number
): Session & { scheduleRuleId?: number } {
  return {
    id,
    studentId: payload.studentId ?? undefined,
    student: { id: payload.studentId ?? 0, name: "陳小明" },
    dateISO: payload.dateISO,
    start: payload.start,
    durationMin: payload.durationMin ?? 60,
    status: "pending",
    kind: "regular",
    materialsProvided: false,
    materialsReasonCode: null,
    scheduleRuleId: payload.scheduleRuleId ?? undefined,
  };
}

type Snapshot = { sessions: Session[]; toasts: string[] };

function MonthHarness({
  initialStudents = makeStudents(),
  initialRules = makeRules(),
  initialSessions = [],
  isSessionsBackendAvailable = false,
  onSnapshot,
}: {
  initialStudents?: StudentProfile[];
  initialRules?: StudentScheduleRule[];
  initialSessions?: Session[];
  isSessionsBackendAvailable?: boolean;
  onSnapshot: (snapshot: Snapshot) => void;
}) {
  const [sessions, setSessions] = React.useState<Session[]>(initialSessions);
  const [globalEvents, setGlobalEvents] = React.useState<GlobalEvent[]>([]);
  const [toasts, setToasts] = React.useState<string[]>([]);

  const setToast: React.Dispatch<React.SetStateAction<string>> = (value) => {
    setToasts((current) => {
      const previous = current.length > 0 ? current[current.length - 1] : "";
      const next = typeof value === "function" ? value(previous) : value;
      return next ? [...current, next] : current;
    });
  };

  React.useEffect(() => {
    onSnapshot({ sessions, toasts });
  }, [sessions, toasts, onSnapshot]);

  return (
    <MonthPage
      setTheme={vi.fn()}
      selectedDate={SELECTED_DATE}
      setSelectedDate={vi.fn()}
      students={initialStudents}
      studentScheduleRules={initialRules}
      sessions={sessions}
      setSessions={setSessions}
      isSessionsBackendAvailable={isSessionsBackendAvailable}
      isGlobalEventsBackendAvailable={false}
      globalEvents={globalEvents}
      setGlobalEvents={setGlobalEvents}
      setToast={setToast}
    />
  );
}

function renderMonthPage(options: {
  initialStudents?: StudentProfile[];
  initialRules?: StudentScheduleRule[];
  initialSessions?: Session[];
  isSessionsBackendAvailable?: boolean;
} = {}) {
  let snapshot: Snapshot = { sessions: [], toasts: [] };
  const user = userEvent.setup();
  render(
    <MonthHarness
      {...options}
      onSnapshot={(next) => {
        Object.assign(snapshot, next);
      }}
    />
  );
  return {
    user,
    get snapshot() {
      return snapshot;
    },
  };
}

async function openBatchMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "批量操作" }));
}

async function openBatchGenerateSheet(user: ReturnType<typeof userEvent.setup>) {
  await openBatchMenu(user);
  await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
}

// The month header has a hidden `input[type=date]` month picker; exclude it so
// indices map to the batch generate sheet's visible from/to inputs.
function sheetDateInputs() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="date"]')
  ).filter((input) => !input.className.includes("opacity-0"));
}

function uniqueRegularKeys(sessions: Session[]) {
  return new Set(
    sessions
      .filter((s) => s.kind === "regular")
      .map((s) => `${s.studentId}|${s.dateISO}|${s.start}|${s.kind}`)
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MonthPage 批量操作 入口與 Menu", () => {
  it("renders the 批量操作 button instead of 批量停課", () => {
    renderMonthPage();
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量停課" })).not.toBeInTheDocument();
  });

  it("opens a Menu listing 批量生成固定課次 / 批量停課 / 收起", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    expect(screen.getByRole("button", { name: "批量生成固定課次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "批量停課" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起" })).toBeInTheDocument();
  });

  it("closes the Menu and opens the generate sheet when picking 批量生成固定課次", async () => {
    const { user } = renderMonthPage();
    await openBatchGenerateSheet(user);

    // Sheet open (unique subtitle), Menu item gone.
    expect(
      screen.getByText(/在指定日期範圍內，依固定課表補齊課次/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收起" })).not.toBeInTheDocument();
  });

  it("closes the Menu and enters stop-class batch mode when picking 批量停課", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量停課" }));

    expect(screen.getByText(/已選取 0 天/)).toBeInTheDocument();
    // Header batch entry replaced by the batch-mode bar.
    expect(screen.queryByRole("button", { name: "批量操作" })).not.toBeInTheDocument();
  });

  it("still enters batch mode from the day drawer 批量模式 entry", async () => {
    const { user } = renderMonthPage();
    await user.click(screen.getByText("15"));
    await user.click(screen.getByRole("button", { name: "批量模式" }));
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();
  });
});

describe("MonthPage 批量生成 Sheet 預設錨點 (viewDate)", () => {
  it("defaults the range and chip year to the viewDate month", async () => {
    const { user } = renderMonthPage();
    await openBatchGenerateSheet(user);
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-30")).toBeInTheDocument();
    expect(screen.getByText("2026 年")).toBeInTheDocument();
  });

  it("anchors on the displayed month (viewDate), not selectedDate, after navigating months", async () => {
    const { user } = renderMonthPage();
    // selectedDate stays 2026-04-20, but advance the displayed month to May.
    await user.click(screen.getByRole("button", { name: "下一個月" }));
    await openBatchGenerateSheet(user);
    expect(screen.getByDisplayValue("2026-05-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument();
  });
});

describe("MonthPage 批量生成 流程", () => {
  it("generates regular sessions for active students with active rules and dedups", async () => {
    const { user, snapshot } = renderMonthPage();
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // Student 1 active: weekday 1 (4 Mondays) + weekday 3 (5 Wednesdays) in April = 9.
    // Inactive weekday-5 rule skipped; students 2/3 not active.
    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    expect(snapshot.sessions.every((s) => s.studentId === 1)).toBe(true);
    expect(snapshot.sessions.every((s) => s.kind === "regular")).toBe(true);
    expect(uniqueRegularKeys(snapshot.sessions).size).toBe(9);
    expect(snapshot.toasts.some((t) => t.startsWith("已批量生成 9 堂"))).toBe(true);
  });

  it("reports skipped duplicates on a second run", async () => {
    const { user, snapshot } = renderMonthPage();
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));
    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));

    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() =>
      expect(
        snapshot.toasts.some(
          (t) =>
            t.includes("範圍內沒有可新增的 regular 課次") && t.includes("略過 9 堂已存在課次")
        )
      ).toBe(true)
    );
    expect(snapshot.sessions).toHaveLength(9);
  });

  it("appends a no-rule notice when an active student lacks any rule", async () => {
    const { user, snapshot } = renderMonthPage({
      initialStudents: [
        { id: 1, name: "甲", birthday: "2012-01-01", school: "A", status: "active" },
        { id: 2, name: "乙", birthday: "2012-01-01", school: "B", status: "active" },
      ],
      initialRules: [
        { id: 11, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
      ],
    });
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions).toHaveLength(4));
    expect(
      snapshot.toasts.some(
        (t) => t.includes("已批量生成 4 堂") && t.includes("1 位學生沒有固定課表")
      )
    ).toBe(true);
  });

  it("honors a restricted date range", async () => {
    const { user, snapshot } = renderMonthPage();
    await openBatchGenerateSheet(user);
    const inputs = sheetDateInputs();
    fireEvent.change(inputs[0], { target: { value: "2026-04-15" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-30" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // Mondays 20,27 (2) + Wednesdays 15,22,29 (3) = 5.
    await waitFor(() => expect(snapshot.sessions).toHaveLength(5));
    expect(
      snapshot.sessions.every((s) => s.dateISO >= "2026-04-15" && s.dateISO <= "2026-04-30")
    ).toBe(true);
  });

  it("shows an inline error when from date is later than to date", async () => {
    const { user, snapshot } = renderMonthPage();
    await openBatchGenerateSheet(user);
    const inputs = sheetDateInputs();
    fireEvent.change(inputs[0], { target: { value: "2026-04-20" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-10" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    expect(screen.getByText(/結束日期需晚於或等於開始日期/)).toBeInTheDocument();
    expect(snapshot.sessions).toEqual([]);
  });

  it("posts each session through the backend in backend mode", async () => {
    const created: Session[] = [];
    vi.mocked(createSession).mockImplementation(async (payload) => {
      const record = builtSession(payload, 900 + created.length + 1);
      created.push(record);
      return record;
    });

    const { user, snapshot } = renderMonthPage({ isSessionsBackendAvailable: true });
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    expect(vi.mocked(createSession)).toHaveBeenCalledTimes(9);
    const payloads = vi.mocked(createSession).mock.calls.map((c) => c[0]);
    expect(payloads.every((p) => p.kind === "regular")).toBe(true);
    expect(payloads.every((p) => p.studentId === 1)).toBe(true);
    expect(payloads.every((p) => p.makeupOfSessionId === null)).toBe(true);
  });

  it("surfaces a toast when backend session creation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(createSession).mockRejectedValue(new Error("boom"));

    const { user, snapshot } = renderMonthPage({ isSessionsBackendAvailable: true });
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("批量生成 regular 失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions).toEqual([]);
  });

  it("reports no active students when none are active", async () => {
    const { user, snapshot } = renderMonthPage({
      initialStudents: [
        {
          id: 1,
          name: "甲",
          birthday: "2012-01-01",
          school: "A",
          status: "inactive",
          deactivateMode: "immediate",
        },
      ],
      initialRules: [],
    });
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.toasts).toContain("沒有可批量生成的啟用中學生"));
    expect(snapshot.sessions).toEqual([]);
  });

  it("never touches makeup or extra sessions during batch generation", async () => {
    const makeup: Session = {
      id: 5001,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "09:00",
      durationMin: 60,
      status: "pending",
      kind: "makeup",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const extra: Session = {
      id: 5002,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-21",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "extra",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderMonthPage({ initialSessions: [makeup, extra] });
    await openBatchGenerateSheet(user);
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions.length).toBeGreaterThan(2));
    expect(snapshot.sessions.find((s) => s.id === 5001)).toEqual(makeup);
    expect(snapshot.sessions.find((s) => s.id === 5002)).toEqual(extra);
    const added = snapshot.sessions.filter((s) => s.id !== 5001 && s.id !== 5002);
    expect(added.every((s) => s.kind === "regular")).toBe(true);
  });
});
