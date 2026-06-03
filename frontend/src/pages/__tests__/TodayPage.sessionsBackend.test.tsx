import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  materialsProvided: false,
  materialsReasonCode: null,
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
  materialsProvided: false,
  materialsReasonCode: null,
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
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

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
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    await waitFor(() => {
      // PATCH payload 仍保留 reason 與 note（送後端行為不變），並附帶清空的教材欄位。
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "absent",
        reason: "生病",
        note: "已通知家長",
        materialsProvided: false,
        materialsReasonCode: null,
      });
      // 卡片右上單一 badge：缺席 · 生病
      expect(screen.getByText("缺席 · 生病")).toBeInTheDocument();
    });
    // note 不再顯示於課次卡片任何位置。
    expect(screen.queryByText(/已通知家長/)).not.toBeInTheDocument();
  });

  it("shows the 天氣 (WEA) reason button and sends 天氣 through backend PATCH", async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      ...baseSession,
      status: "absent",
      reason: { id: 6, name: "天氣", code: "WEA" },
      note: undefined,
    });

    const user = userEvent.setup();
    render(<TodayHarness isSessionsBackendAvailable={true} />);

    await user.click(screen.getByLabelText("記錄缺席"));
    // 缺席 Bottom Sheet 出現「天氣 WEA」按鈕。
    const weatherButton = screen.getByRole("button", { name: /天氣/ });
    expect(weatherButton).toBeInTheDocument();
    expect(within(weatherButton).getByText("WEA")).toBeInTheDocument();

    await user.click(weatherButton);
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledWith(10, {
        status: "absent",
        reason: "天氣",
        note: null,
        materialsProvided: false,
        materialsReasonCode: null,
      });
      // 卡片右上單一 badge：缺席 · 天氣
      expect(screen.getByText("缺席 · 天氣")).toBeInTheDocument();
    });
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
    render(<TodayHarness isSessionsBackendAvailable={true} />);

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
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

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
    render(<TodayHarness isSessionsBackendAvailable={true} setToast={setToast} />);

    await user.click(screen.getByLabelText("記錄缺席"));
    await user.click(screen.getByRole("button", { name: "完成缺席紀錄" }));

    expect(setToast).toHaveBeenCalledWith("請先選擇學生的缺席原因");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("pre-selects the absence reason chip when reopening a backend-loaded absent session", async () => {
    const user = userEvent.setup();
    render(
      <TodayHarness
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

    await user.click(screen.getByLabelText("記錄缺席"));

    expect(screen.getByRole("button", { name: /生病\s*SICK/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("pre-selects no chip when the backend reason name is not a preset", async () => {
    const user = userEvent.setup();
    render(
      <TodayHarness
        isSessionsBackendAvailable={true}
        initialSessions={[
          {
            ...baseSession,
            status: "absent",
            reason: { id: 0, name: "未知原因", code: "BACKEND_REASON" },
          },
        ]}
      />
    );

    await user.click(screen.getByLabelText("記錄缺席"));

    // No preset chip is wrongly selected; safe fallback to none.
    expect(screen.getByRole("button", { name: /生病\s*SICK/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("shows only 缺席 on the card when the absent reason is not a preset", async () => {
    const absentCustom: Session = {
      ...baseSession,
      status: "absent",
      reason: { id: 0, name: "自訂原因文字", code: "BACKEND_REASON" },
      note: "私密備註",
    };
    render(<TodayHarness isSessionsBackendAvailable={true} initialSessions={[absentCustom]} />);

    // 非預設原因不附加到 badge；badge 只顯示「缺席」。
    expect(screen.getByText("缺席")).toBeInTheDocument();
    expect(screen.queryByText(/自訂原因文字/)).not.toBeInTheDocument();
    // note 不顯示於卡片。
    expect(screen.queryByText(/私密備註/)).not.toBeInTheDocument();
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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


// ------------------------------------------------------------
// 頂部日期選擇器（iPad 可點修復 — 互動層回歸測試）
// jsdom 無法驗證 iOS 原生 picker 是否彈出；此處只鎖定「input 具備真實可
// 互動條件」與既有箭嘴 / 回到今天行為，iPad 真機行為留待人工驗收。
// ------------------------------------------------------------
function DatePickerHarness({ initialDate = "2026-06-15" }: { initialDate?: string }) {
  const [selectedDate, setSelectedDate] = React.useState(initialDate);
  return (
    <TodayPage
      setTheme={vi.fn()}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      now={new Date("2026-06-15T12:00:00")}
      students={[student]}
      sessions={[]}
      setSessions={vi.fn()}
      isSessionsBackendAvailable={false}
      isGlobalEventsBackendAvailable={false}
      globalEvents={[]}
      setGlobalEvents={vi.fn()}
      setToast={vi.fn()}
    />
  );
}

describe("TodayPage top date picker (iPad fix)", () => {
  it("renders a tappable, overlaid date input (no hidden/zero-size/pointer-events-none)", () => {
    render(<DatePickerHarness />);
    const input = screen.getByLabelText("選擇日期") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("date");

    const cls = input.getAttribute("class") ?? "";
    expect(cls).toContain("inset-0");
    expect(cls).not.toContain("pointer-events-none");
    expect(cls).not.toContain("w-0");
    expect(cls).not.toContain("h-0");
    expect(cls).not.toContain("-z-10");
    // No longer disabled from the tab order.
    expect(input.getAttribute("tabindex")).not.toBe("-1");
  });

  it("updates the selected date when the overlay input changes", () => {
    render(<DatePickerHarness />);
    const input = screen.getByLabelText("選擇日期") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-07-04" } });
    expect((screen.getByLabelText("選擇日期") as HTMLInputElement).value).toBe("2026-07-04");
  });

  it("keeps the prev/next day arrows working", async () => {
    const user = userEvent.setup();
    render(<DatePickerHarness />);
    const getInput = () => screen.getByLabelText("選擇日期") as HTMLInputElement;

    await user.click(screen.getByRole("button", { name: "下一天" }));
    expect(getInput().value).toBe("2026-06-16");

    await user.click(screen.getByRole("button", { name: "上一天" }));
    await user.click(screen.getByRole("button", { name: "上一天" }));
    expect(getInput().value).toBe("2026-06-14");
  });

  it("keeps 回到今天 clickable and moves the date off the selected day", async () => {
    const user = userEvent.setup();
    render(<DatePickerHarness />);
    const back = screen.getByRole("button", { name: "回到今天" });
    expect(back).toBeInTheDocument();
    await user.click(back);
    expect((screen.getByLabelText("選擇日期") as HTMLInputElement).value).not.toBe("2026-06-15");
  });
});
