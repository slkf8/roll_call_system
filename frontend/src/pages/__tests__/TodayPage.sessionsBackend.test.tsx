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
import TodayPage from "../TodayPage";


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
  dateISO: "2026-06-01",
  start: "16:00",
  durationMin: 60,
  status: "pending",
  kind: "regular",
};

const linkedMakeupSession: Session = {
  id: 11,
  studentId: 1,
  student: { id: 1, name: "後端課次學生" },
  dateISO: "2026-06-01",
  start: "18:00",
  durationMin: 60,
  status: "pending",
  kind: "makeup",
  makeupOfDateISO: "2026-06-01",
  makeupOfSessionId: 10,
};


function TodayHarness({
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
    <TodayPage
      setTheme={vi.fn()}
      selectedDate="2026-06-01"
      setSelectedDate={vi.fn()}
      now={new Date("2026-06-01T12:00:00")}
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


afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});


describe("TodayPage backend session status updates", () => {
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
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("記錄已到"));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "present",
        reason: null,
        note: null,
      });
      expect(screen.getByText("已到")).toBeInTheDocument();
    });
  });

  it("does not update local session and shows an error when backend PATCH fails", async () => {
    const setToast = vi.fn();
    vi.mocked(updateSession).mockRejectedValueOnce(new Error("patch failed"));

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("記錄已到"));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "present",
        reason: null,
        note: null,
      });
      expect(setToast).toHaveBeenCalledWith("點名更新失敗，請確認後端是否正常");
    });
    expect(screen.getAllByText("待確認").length).toBeGreaterThan(0);
    expect(screen.queryByText("已到")).not.toBeInTheDocument();
  });

  it("keeps local attendance updates when sessions backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={false} />);

    await user.click(screen.getByLabelText("記錄已到"));

    expect(updateSession).not.toHaveBeenCalled();
    expect(await screen.findByText("已到")).toBeInTheDocument();
  });

  it("sends absent reason and note through backend PATCH", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "absent",
      reason: { id: 0, name: "生病", code: "BACKEND_REASON" },
      note: "已通知家長",
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("記錄缺席"));
    await user.type(screen.getByPlaceholderText("例如：已通知家長 / 交通延誤..."), "已通知家長");
    await user.click(screen.getByRole("button", { name: /生病/ }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "absent",
        reason: "生病",
        note: "已通知家長",
      });
      expect(screen.getByText("缺席")).toBeInTheDocument();
      expect(screen.getByText("生病")).toBeInTheDocument();
      expect(screen.getByText(/已通知家長/)).toBeInTheDocument();
    });
  });

  it("creates a single session through backend POST when sessions backend is available", async () => {
    vi.mocked(createSession).mockResolvedValueOnce({
      id: 99,
      studentId: 1,
      student: { id: 1, name: "後端課次學生" },
      dateISO: "2026-06-01",
      start: "09:30",
      durationMin: 60,
      status: "pending",
      reason: undefined,
      note: undefined,
      kind: "extra",
      makeupOfDateISO: undefined,
      makeupOfSessionId: undefined,
      scheduleRuleId: undefined,
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("新增課次"));
    await user.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        studentId: 1,
        dateISO: "2026-06-01",
        start: expect.any(String),
        durationMin: 60,
        status: "pending",
        reason: null,
        note: null,
        kind: "extra",
        makeupOfDateISO: null,
        makeupOfSessionId: null,
        scheduleRuleId: null,
      });
      expect(screen.getByText("09:30")).toBeInTheDocument();
    });
  });

  it("does not add a local session when backend create fails", async () => {
    const setToast = vi.fn();
    vi.mocked(createSession).mockRejectedValueOnce(new Error("create failed"));

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("新增課次"));
    await user.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("新增課次失敗，請確認後端是否正常");
    });
    expect(screen.getAllByLabelText("記錄已到")).toHaveLength(1);
    expect(screen.getByText("新增臨時課次")).toBeInTheDocument();
  });

  it("keeps local single session creation when sessions backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={false} />);

    await user.click(screen.getByLabelText("新增課次"));
    await user.click(screen.getByRole("button", { name: "新增" }));

    expect(createSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByLabelText("記錄已到")).toHaveLength(2);
    });
  });

  it("updates session start and duration through backend PATCH when sessions backend is available", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      start: "17:30",
      durationMin: 75,
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("編輯課次（時間 / 時長）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        dateISO: "2026-06-01",
        start: "16:00",
        durationMin: 60,
      });
      expect(document.body).toHaveTextContent("17:30");
      expect(document.body).toHaveTextContent("1小時15分鐘課程");
      expect(document.body).toHaveTextContent("18:45");
    });
  });

  it("does not update local session when backend edit PATCH fails", async () => {
    const setToast = vi.fn();
    vi.mocked(updateSession).mockRejectedValueOnce(new Error("edit failed"));

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("編輯課次（時間 / 時長）"));
    await user.click(screen.getByLabelText("增加"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        dateISO: "2026-06-01",
        start: "16:00",
        durationMin: 61,
      });
      expect(setToast).toHaveBeenCalledWith("編輯課次失敗，請確認後端是否正常");
    });
    expect(screen.getByText("編輯課次")).toBeInTheDocument();
    expect(document.body).toHaveTextContent("1小時課程");
    expect(document.body).toHaveTextContent("17:00");
  });

  it("keeps local edit flow when sessions backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={false} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("編輯課次（時間 / 時長）"));
    await user.click(screen.getByLabelText("增加"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(updateSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.body).toHaveTextContent("1小時1分鐘課程");
      expect(document.body).toHaveTextContent("17:01");
    });
  });

  it("deletes a session through backend DELETE and detaches linked makeup sessions", async () => {
    let latestSessions: Session[] = [];
    vi.mocked(deleteSession).mockResolvedValueOnce({
      ok: true,
      detachedMakeupCount: 1,
    });

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={true}
        initialSessions={[baseSession, linkedMakeupSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await user.click(screen.getAllByLabelText("更多")[0]);
    await user.click(screen.getByText("刪除此課次"));
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
      <TodayHarness
        isSessionsBackendAvailable={true}
        setToast={setToast}
        initialSessions={[baseSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("刪除此課次"));
    await user.click(screen.getByRole("button", { name: "刪除" }));

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith(10);
      expect(setToast).toHaveBeenCalledWith("刪除課次失敗，請確認後端是否正常");
    });
    expect(latestSessions.some((s) => s.id === 10)).toBe(true);
    expect(screen.getByText("刪除課次？")).toBeInTheDocument();
  });

  it("keeps local delete flow when sessions backend is unavailable", async () => {
    let latestSessions: Session[] = [];

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        initialSessions={[baseSession]}
        onSessionsChange={(next) => {
          latestSessions = next;
        }}
      />
    );

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("刪除此課次"));
    await user.click(screen.getByRole("button", { name: "刪除" }));

    expect(deleteSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestSessions.some((s) => s.id === 10)).toBe(false);
    });
  });

  it("creates a makeup session through backend POST with source link", async () => {
    vi.mocked(createSession).mockResolvedValueOnce({
      id: 88,
      studentId: 1,
      student: { id: 1, name: "後端課次學生" },
      dateISO: "2026-06-01",
      start: "17:00",
      durationMin: 60,
      status: "pending",
      reason: undefined,
      note: undefined,
      kind: "makeup",
      makeupOfDateISO: "2026-06-01",
      makeupOfSessionId: 10,
      scheduleRuleId: undefined,
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("安排補課（補回本堂）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        studentId: 1,
        dateISO: "2026-06-01",
        start: "17:00",
        durationMin: 60,
        status: "pending",
        reason: null,
        note: null,
        kind: "makeup",
        makeupOfDateISO: "2026-06-01",
        makeupOfSessionId: 10,
        scheduleRuleId: null,
      });
      expect(document.body).toHaveTextContent("補課（原 2026-06-01）");
    });
  });

  it("does not add a local makeup session when backend create fails", async () => {
    const setToast = vi.fn();
    vi.mocked(createSession).mockRejectedValueOnce(new Error("makeup create failed"));

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("安排補課（補回本堂）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("建立補課失敗，請確認後端是否正常");
    });
    expect(screen.getAllByLabelText("記錄已到")).toHaveLength(1);
    expect(screen.getByText("安排補課")).toBeInTheDocument();
  });

  it("keeps local makeup creation when sessions backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={false} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("安排補課（補回本堂）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(createSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByLabelText("記錄已到")).toHaveLength(2);
      expect(document.body).toHaveTextContent("補課（原 2026-06-01）");
    });
  });

  it("creates an extra session through backend POST without makeup link", async () => {
    vi.mocked(createSession).mockResolvedValueOnce({
      id: 89,
      studentId: 1,
      student: { id: 1, name: "後端課次學生" },
      dateISO: "2026-06-01",
      start: "17:00",
      durationMin: 60,
      status: "pending",
      reason: undefined,
      note: undefined,
      kind: "extra",
      makeupOfDateISO: undefined,
      makeupOfSessionId: undefined,
      scheduleRuleId: undefined,
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("額外加課（不抵扣缺席）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith({
        studentId: 1,
        dateISO: "2026-06-01",
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
      expect(screen.getAllByLabelText("記錄已到")).toHaveLength(2);
    });
  });

  it("does not add a local extra session when backend create fails", async () => {
    const setToast = vi.fn();
    vi.mocked(createSession).mockRejectedValueOnce(new Error("extra create failed"));

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("額外加課（不抵扣缺席）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("建立加課失敗，請確認後端是否正常");
    });
    expect(screen.getAllByLabelText("記錄已到")).toHaveLength(1);
    expect(screen.getByText("安排加課")).toBeInTheDocument();
  });

  it("keeps local extra creation when sessions backend is unavailable", async () => {
    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={false} />);

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByText("額外加課（不抵扣缺席）"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(createSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByLabelText("記錄已到")).toHaveLength(2);
    });
  });

  it("creates an all-day global event through backend when global events backend is available", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockResolvedValueOnce({
      id: 701,
      dateISO: "2026-06-01",
      mode: "allDay",
      label: "停課",
      leaveReason: "病假",
    });

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await user.click(screen.getByText("設定停課/假期"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledWith({
        dateISO: "2026-06-01",
        mode: "allDay",
        label: "停課",
        leaveReason: "病假",
        start: null,
        end: null,
        note: null,
      });
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({ id: 701, mode: "allDay", label: "停課" }),
      ]);
      expect(screen.getByText(/已設定：停課/)).toBeInTheDocument();
    });
  });

  it("does not create a local global event when backend create fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(createGlobalEvent).mockRejectedValueOnce(new Error("create failed"));

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await user.click(screen.getByText("設定停課/假期"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("建立停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([]);
    expect(screen.getByText("設定全局事件")).toBeInTheDocument();
  });

  it("keeps local global event creation when backend is unavailable", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={false}
        onGlobalEventsChange={(next) => {
          latestGlobalEvents = next;
        }}
      />
    );

    await user.click(screen.getByText("設定停課/假期"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(createGlobalEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({
          dateISO: "2026-06-01",
          mode: "allDay",
          label: "停課",
          leaveReason: "病假",
        }),
      ]);
    });
  });

  it("creates a time-range global event through backend", async () => {
    vi.mocked(createGlobalEvent).mockResolvedValueOnce({
      id: 702,
      dateISO: "2026-06-01",
      mode: "timeRange",
      label: "停課",
      leaveReason: "病假",
      start: "14:00",
      end: "18:00",
    });

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
      />
    );

    await user.click(screen.getByText("設定停課/假期"));
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "timeRange" } });
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(createGlobalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "timeRange",
          start: "14:00",
          end: "18:00",
        })
      );
    });
  });

  it("updates an existing global event through backend", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(updateGlobalEvent).mockResolvedValueOnce({
      id: 703,
      dateISO: "2026-06-01",
      mode: "allDay",
      label: "假期",
    });

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        initialGlobalEvents={[
          {
            id: 703,
            dateISO: "2026-06-01",
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

    await user.click(screen.getByText(/已設定：停課/));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateGlobalEvent).toHaveBeenCalledWith(703, {
        dateISO: "2026-06-01",
        mode: "allDay",
        label: "假期",
        leaveReason: null,
        start: null,
        end: null,
        note: null,
      });
      expect(latestGlobalEvents).toEqual([
        expect.objectContaining({ id: 703, label: "假期", mode: "allDay" }),
      ]);
      expect(latestGlobalEvents[0]?.leaveReason).toBeUndefined();
    });
  });

  it("does not update a local global event when backend update fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(updateGlobalEvent).mockRejectedValueOnce(new Error("update failed"));

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        initialGlobalEvents={[
          {
            id: 704,
            dateISO: "2026-06-01",
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

    await user.click(screen.getByText(/已設定：停課/));
    await user.click(screen.getByRole("button", { name: "假期" }));
    await user.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(updateGlobalEvent).toHaveBeenCalledOnce();
      expect(setToast).toHaveBeenCalledWith("更新停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([
      expect.objectContaining({ id: 704, label: "停課", leaveReason: "病假" }),
    ]);
  });

  it("deletes an existing global event through backend", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(deleteGlobalEvent).mockResolvedValueOnce({ ok: true });

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        initialGlobalEvents={[
          {
            id: 705,
            dateISO: "2026-06-01",
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

    await user.click(screen.getByText(/已設定：停課/));
    await user.click(screen.getByRole("button", { name: "取消此事件" }));

    await waitFor(() => {
      expect(deleteGlobalEvent).toHaveBeenCalledWith(705);
      expect(latestGlobalEvents).toEqual([]);
    });
  });

  it("does not delete a local global event when backend delete fails", async () => {
    const setToast = vi.fn();
    let latestGlobalEvents: GlobalEvent[] = [];
    vi.mocked(deleteGlobalEvent).mockRejectedValueOnce(new Error("delete failed"));

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={true}
        setToast={setToast}
        initialGlobalEvents={[
          {
            id: 706,
            dateISO: "2026-06-01",
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

    await user.click(screen.getByText(/已設定：停課/));
    await user.click(screen.getByRole("button", { name: "取消此事件" }));

    await waitFor(() => {
      expect(deleteGlobalEvent).toHaveBeenCalledWith(706);
      expect(setToast).toHaveBeenCalledWith("刪除停課 / 假期失敗，請確認後端是否正常");
    });
    expect(latestGlobalEvents).toEqual([
      expect.objectContaining({ id: 706, label: "停課" }),
    ]);
  });

  it("keeps local global event delete when backend is unavailable", async () => {
    let latestGlobalEvents: GlobalEvent[] = [];

    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={false}
        isGlobalEventsBackendAvailable={false}
        initialGlobalEvents={[
          {
            id: 707,
            dateISO: "2026-06-01",
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

    await user.click(screen.getByText(/已設定：停課/));
    await user.click(screen.getByRole("button", { name: "取消此事件" }));

    expect(deleteGlobalEvent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestGlobalEvents).toEqual([]);
    });
  });
});
