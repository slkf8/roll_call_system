import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGlobalEvent,
  deleteGlobalEvent,
  updateGlobalEvent,
} from "../../api/globalEventsApi";
import { createSession, deleteSession, updateSession } from "../../api/sessionsApi";
import type { GlobalEvent, Session, StudentProfile } from "../../shared/appShared";
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


const SELECTED_DATE = "2026-06-23";

const student: StudentProfile = {
  id: 1,
  name: "後端課次學生",
  birthday: "2012-01-01",
  school: "測試學校",
  status: "active",
};

const baseSession: Session = {
  id: 10,
  studentId: 1,
  student: { id: 1, name: "後端課次學生" },
  dateISO: SELECTED_DATE,
  start: "16:00",
  durationMin: 60,
  status: "pending",
  kind: "regular",
  materialsProvided: false,
  materialsReasonCode: null,
};

const linkedMakeupSession: Session = {
  id: 11,
  studentId: 1,
  student: { id: 1, name: "後端課次學生" },
  dateISO: SELECTED_DATE,
  start: "18:00",
  durationMin: 60,
  status: "pending",
  kind: "makeup",
  makeupOfDateISO: SELECTED_DATE,
  makeupOfSessionId: 10,
  materialsProvided: false,
  materialsReasonCode: null,
};


function MonthHarness({
  isSessionsBackendAvailable,
  isGlobalEventsBackendAvailable = false,
  setToast = vi.fn(),
  initialSessions = [baseSession],
  initialGlobalEvents = [],
  onSessionsChange,
  onGlobalEventsChange,
}: {
  isSessionsBackendAvailable: boolean;
  isGlobalEventsBackendAvailable?: boolean;
  setToast?: React.Dispatch<React.SetStateAction<string>>;
  initialSessions?: Session[];
  initialGlobalEvents?: GlobalEvent[];
  onSessionsChange?: (sessions: Session[]) => void;
  onGlobalEventsChange?: (events: GlobalEvent[]) => void;
}) {
  const [sessions, setSessions] = React.useState<Session[]>(initialSessions);
  const [globalEvents, setGlobalEvents] = React.useState<GlobalEvent[]>(initialGlobalEvents);

  React.useEffect(() => {
    onSessionsChange?.(sessions);
  }, [onSessionsChange, sessions]);

  React.useEffect(() => {
    onGlobalEventsChange?.(globalEvents);
  }, [globalEvents, onGlobalEventsChange]);

  return (
    <MonthPage
      setTheme={vi.fn()}
      selectedDate={SELECTED_DATE}
      setSelectedDate={vi.fn()}
      students={[student]}
      sessions={sessions}
      setSessions={setSessions}
      isSessionsBackendAvailable={isSessionsBackendAvailable}
      isGlobalEventsBackendAvailable={isGlobalEventsBackendAvailable}
      globalEvents={globalEvents}
      setGlobalEvents={setGlobalEvents}
      setToast={setToast}
    />
  );
}


async function openDrawerForDay23(user: ReturnType<typeof userEvent.setup>) {
  // Day cell has no aria-label; clicking the day-number span bubbles to the cell's onClick.
  await user.click(screen.getByText("23"));
}


afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});


describe("MonthPage backend session operations", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("updates attendance through backend PATCH when sessions backend is available", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "present",
      reason: undefined,
      note: undefined,
    });

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄已到"));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "present",
        reason: null,
        note: null,
        materialsProvided: false,
        materialsReasonCode: null,
      });
      expect(screen.getByText("已到")).toBeInTheDocument();
    });
  });

  it("does not update local session and shows an error when backend PATCH fails", async () => {
    const setToast = vi.fn();
    vi.mocked(updateSession).mockRejectedValueOnce(new Error("patch failed"));

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄已到"));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "present",
        reason: null,
        note: null,
        materialsProvided: false,
        materialsReasonCode: null,
      });
      expect(setToast).toHaveBeenCalledWith("點名更新失敗，請確認後端是否正常");
    });
    expect(screen.queryByText("已到")).not.toBeInTheDocument();
  });

  it("updates session date/start/duration through backend PATCH when sessions backend is available", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      start: "17:30",
      durationMin: 75,
    });

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("編輯課次"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        dateISO: SELECTED_DATE,
        start: "16:00",
        durationMin: 60,
      });
    });
  });

  it("does not update local session when backend edit PATCH fails", async () => {
    const setToast = vi.fn();
    vi.mocked(updateSession).mockRejectedValueOnce(new Error("edit failed"));

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("編輯課次"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        dateISO: SELECTED_DATE,
        start: "16:00",
        durationMin: 60,
      });
      expect(setToast).toHaveBeenCalledWith("編輯課次失敗，請確認後端是否正常");
    });
    // Edit sheet should still be open (no fake success)
    expect(screen.getAllByText("編輯課次").length).toBeGreaterThan(0);
  });

  it("creates a makeup session through backend POST with source link", async () => {
    vi.mocked(createSession).mockResolvedValueOnce({
      id: 88,
      studentId: 1,
      student: { id: 1, name: "後端課次學生" },
      dateISO: SELECTED_DATE,
      start: "17:00",
      durationMin: 60,
      status: "pending",
      reason: undefined,
      note: undefined,
      kind: "makeup",
      makeupOfDateISO: SELECTED_DATE,
      makeupOfSessionId: 10,
      scheduleRuleId: undefined,
      materialsProvided: false,
      materialsReasonCode: null,
    });

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("安排補課（補回本堂）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        studentId: 1,
        dateISO: SELECTED_DATE,
        start: "17:00",
        durationMin: 60,
        status: "pending",
        reason: null,
        note: null,
        kind: "makeup",
        makeupOfDateISO: SELECTED_DATE,
        makeupOfSessionId: 10,
        scheduleRuleId: null,
      });
    });
  });

  it("creates an extra session through backend POST without makeup link", async () => {
    vi.mocked(createSession).mockResolvedValueOnce({
      id: 89,
      studentId: 1,
      student: { id: 1, name: "後端課次學生" },
      dateISO: SELECTED_DATE,
      start: "17:00",
      durationMin: 60,
      status: "pending",
      reason: undefined,
      note: undefined,
      kind: "extra",
      makeupOfDateISO: undefined,
      makeupOfSessionId: undefined,
      scheduleRuleId: undefined,
      materialsProvided: false,
      materialsReasonCode: null,
    });

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("額外加課（不抵扣缺席）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        studentId: 1,
        dateISO: SELECTED_DATE,
        start: "17:00",
        durationMin: 60,
        status: "pending",
        reason: null,
        note: null,
        kind: "extra",
        makeupOfDateISO: null,
        makeupOfSessionId: null,
        scheduleRuleId: null,
      });
    });
  });

  it("does not add a local makeup session when backend create fails", async () => {
    const setToast = vi.fn();
    let latestSessions: Session[] = [];
    vi.mocked(createSession).mockRejectedValueOnce(new Error("makeup create failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        setToast={setToast}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("安排補課（補回本堂）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("建立補課失敗，請確認後端是否正常");
    });
    // No new session appended locally
    expect(latestSessions).toHaveLength(1);
    expect(latestSessions[0].id).toBe(10);
  });

  it("deletes a session through backend DELETE and detaches linked makeup sessions", async () => {
    let latestSessions: Session[] = [];
    vi.mocked(deleteSession).mockResolvedValueOnce({
      ok: true,
      detachedMakeupCount: 1,
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        initialSessions={[baseSession, linkedMakeupSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getAllByLabelText("更多")[0]);
    await user.click(screen.getByText("刪除課次"));
    await user.click(screen.getByRole("button", { name: "刪除" }));

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith(10);
      expect(latestSessions.some((s) => s.id === 10)).toBe(false);
      expect(latestSessions.find((s) => s.id === 11)?.makeupOfSessionId).toBeUndefined();
    });
  });

  it("does not delete a local session when backend DELETE fails", async () => {
    const setToast = vi.fn();
    let latestSessions: Session[] = [];
    vi.mocked(deleteSession).mockRejectedValueOnce(new Error("delete failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        setToast={setToast}
        initialSessions={[baseSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("刪除課次"));
    await user.click(screen.getByRole("button", { name: "刪除" }));

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith(10);
      expect(setToast).toHaveBeenCalledWith("刪除課次失敗，請確認後端是否正常");
    });
    expect(latestSessions.some((s) => s.id === 10)).toBe(true);
  });

  it("keeps local delete flow when sessions backend is unavailable", async () => {
    let latestSessions: Session[] = [];

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        initialSessions={[baseSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("刪除課次"));
    await user.click(screen.getByRole("button", { name: "刪除" }));

    expect(deleteSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestSessions.some((s) => s.id === 10)).toBe(false);
    });
  });

  it("creates an all-day global event through backend when global events backend is available", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockResolvedValueOnce({
      id: 801,
      dateISO: SELECTED_DATE,
      mode: "allDay",
      label: "停課",
      leaveReason: "病假",
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "設定事件" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledWith({
        dateISO: SELECTED_DATE,
        mode: "allDay",
        label: "停課",
        leaveReason: "病假",
        start: null,
        end: null,
        note: null,
      });
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({ id: 801, mode: "allDay", label: "停課" }),
      ]);
    });
  });

  it("does not create a local global event when backend create fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockRejectedValueOnce(new Error("create failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "設定事件" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("建立停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([]);
    expect(screen.getByText("設定當日事件")).toBeInTheDocument();
  });

  it("keeps local global event creation when backend is unavailable", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={false}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "設定事件" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(createGlobalEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({
          dateISO: SELECTED_DATE,
          mode: "allDay",
          label: "停課",
          leaveReason: "病假",
        }),
      ]);
    });
  });

  it("creates a time-range global event through backend", async () => {
    vi.mocked(createGlobalEvent).mockResolvedValueOnce({
      id: 802,
      dateISO: SELECTED_DATE,
      mode: "timeRange",
      label: "停課",
      leaveReason: "病假",
      start: "14:00",
      end: "18:00",
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "設定事件" }));
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "timeRange" } });
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          dateISO: SELECTED_DATE,
          mode: "timeRange",
          start: "14:00",
          end: "18:00",
        })
      );
    });
  });

  it("updates an existing global event through backend", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(updateGlobalEvent).mockResolvedValueOnce({
      id: 803,
      dateISO: SELECTED_DATE,
      mode: "allDay",
      label: "假期",
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        initialGlobalEvents={[
          {
            id: 803,
            dateISO: SELECTED_DATE,
            mode: "allDay",
            label: "停課",
            leaveReason: "病假",
          },
        ]}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "編輯事件" }));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateGlobalEvent).toHaveBeenCalledWith(803, {
        dateISO: SELECTED_DATE,
        mode: "allDay",
        label: "假期",
        leaveReason: null,
        start: null,
        end: null,
        note: null,
      });
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({ id: 803, label: "假期", mode: "allDay" }),
      ]);
    });
  });

  it("does not update a local global event when backend update fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(updateGlobalEvent).mockRejectedValueOnce(new Error("update failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        initialGlobalEvents={[
          {
            id: 804,
            dateISO: SELECTED_DATE,
            mode: "allDay",
            label: "停課",
            leaveReason: "病假",
          },
        ]}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "編輯事件" }));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateGlobalEvent).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("更新停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([
      expect.objectContaining({ id: 804, label: "停課", leaveReason: "病假" }),
    ]);
  });

  it("deletes an existing global event through backend", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(deleteGlobalEvent).mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        initialGlobalEvents={[
          {
            id: 805,
            dateISO: SELECTED_DATE,
            mode: "allDay",
            label: "停課",
            leaveReason: "病假",
          },
        ]}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "清除此日" }));

    await waitFor(() => {
      expect(deleteGlobalEvent).toHaveBeenCalledWith(805);
      expect(latestGlobalEvents).toEqual([]);
    });
  });

  it("does not delete a local global event when backend delete fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(deleteGlobalEvent).mockRejectedValueOnce(new Error("delete failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        initialGlobalEvents={[
          {
            id: 806,
            dateISO: SELECTED_DATE,
            mode: "allDay",
            label: "停課",
            leaveReason: "病假",
          },
        ]}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "清除此日" }));

    await waitFor(() => {
      expect(deleteGlobalEvent).toHaveBeenCalledWith(806);
      expect(setToast).toHaveBeenCalledWith("刪除停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([
      expect.objectContaining({ id: 806, label: "停課" }),
    ]);
  });

  it("keeps local global event delete when backend is unavailable", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={false}
        initialGlobalEvents={[
          {
            id: 807,
            dateISO: SELECTED_DATE,
            mode: "allDay",
            label: "停課",
            leaveReason: "病假",
          },
        ]}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "清除此日" }));

    expect(deleteGlobalEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestGlobalEvents).toEqual([]);
    });
  });

  it("batch creates global events through backend after all requests succeed", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockResolvedValueOnce({
      id: 808,
      dateISO: SELECTED_DATE,
      mode: "allDay",
      label: "假期",
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "批量模式" }));
    await user.click(screen.getByRole("button", { name: "標記停課 / 假期" }));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledWith({
        dateISO: SELECTED_DATE,
        mode: "allDay",
        label: "假期",
        leaveReason: null,
        start: null,
        end: null,
        note: null,
      });
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({ id: 808, label: "假期" }),
      ]);
    });
  });

  it("does not update local events when batch backend request fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockRejectedValueOnce(new Error("batch failed"));

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByRole("button", { name: "批量模式" }));
    await user.click(screen.getByRole("button", { name: "標記停課 / 假期" }));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("批量設定停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([]);
  });

  it("sends materials through backend PATCH when 教材 + reason code selected", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "absent",
      reason: { id: 1, name: "生病", code: "BACKEND_REASON" },
      materialsProvided: true,
      materialsReasonCode: 4,
    });

    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄缺席"));
    await user.click(screen.getByRole("button", { name: /生病\s*SICK/ }));
    await user.click(screen.getByRole("button", { name: "教材" }));
    await user.click(screen.getByRole("button", { name: "4 生病" }));
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "absent",
        reason: "生病",
        note: null,
        materialsProvided: true,
        materialsReasonCode: 4,
      });
    });
  });

  it("blocks submit and toasts when 教材 toggled without a reason code", async () => {
    const setToast = vi.fn();
    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄缺席"));
    await user.click(screen.getByRole("button", { name: /生病\s*SICK/ }));
    await user.click(screen.getByRole("button", { name: "教材" }));
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    expect(setToast).toHaveBeenCalledWith("請選擇教材服務的申報原因");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("blocks submit and toasts when no absence reason selected", async () => {
    const setToast = vi.fn();
    const user = userEvent.setup();
    render(<MonthHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄缺席"));
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    expect(setToast).toHaveBeenCalledWith("請先選擇學生的缺席原因");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("warns when reason 6 exceeds the per-school-year limit on save", async () => {
    const setToast = vi.fn();
    const reason6 = (id: number, dateISO: string): Session => ({
      ...baseSession,
      id,
      dateISO,
      status: "absent",
      materialsProvided: true,
      materialsReasonCode: 6,
    });
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "absent",
      reason: { id: 1, name: "生病", code: "BACKEND_REASON" },
      materialsProvided: true,
      materialsReasonCode: 6,
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        setToast={setToast}
        initialSessions={[
          baseSession,
          reason6(101, "2025-10-01"),
          reason6(102, "2025-11-01"),
          reason6(103, "2026-01-01"),
        ]}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄缺席"));
    await user.click(screen.getByRole("button", { name: /生病\s*SICK/ }));
    await user.click(screen.getByRole("button", { name: "教材" }));
    await user.click(screen.getByRole("button", { name: "6 其他" }));
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    await waitFor(() => {
      expect(setToast).toHaveBeenCalledWith(
        expect.stringContaining("原因 6 已超過每學年度 3 次上限")
      );
    });
  });

  it("clears materials when switching an absent+materials session to present", async () => {
    const absentMaterials: Session = {
      ...baseSession,
      status: "absent",
      reason: { id: 4, name: "生病", code: "BACKEND_REASON" },
      materialsProvided: true,
      materialsReasonCode: 4,
    };
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "present",
      materialsProvided: false,
      materialsReasonCode: null,
    });

    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        initialSessions={[absentMaterials]}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄已到"));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "present",
        reason: null,
        note: null,
        materialsProvided: false,
        materialsReasonCode: null,
      });
    });
  });

  it("pre-selects the absence reason chip when reopening a backend-loaded absent session", async () => {
    const user = userEvent.setup();
    render(
      <MonthHarness
        isSessionsBackendAvailable={true}
        initialSessions={[
          {
            ...baseSession,
            status: "absent",
            reason: { id: 0, name: "生病", code: "BACKEND_REASON" },
          },
        ]}
      />
    );

    await openDrawerForDay23(user);
    await user.click(screen.getByLabelText("記錄缺席"));

    expect(screen.getByRole("button", { name: /生病\s*SICK/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
