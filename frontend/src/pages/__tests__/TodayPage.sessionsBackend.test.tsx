import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, updateSession } from "../../api/sessionsApi";
import type { Session, StudentProfile } from "../../shared/appShared";
import TodayPage from "../TodayPage";


vi.mock("../../api/sessionsApi", () => ({
  createSession: vi.fn(),
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


function TodayHarness({
  isSessionsBackendAvailable,
  setToast = vi.fn(),
}: {
  isSessionsBackendAvailable: boolean;
  setToast?: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [sessions, setSessions] = React.useState<Session[]>([baseSession]);

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
      globalEvents={[]}
      setGlobalEvents={vi.fn()}
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
});
