import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "../../api/sessionsApi";
import type { Session, StudentProfile } from "../../shared/appShared";
import TodayPage from "../TodayPage";


vi.mock("../../api/sessionsApi", () => ({
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
});
