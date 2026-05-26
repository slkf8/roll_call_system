import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudentsPage from "../StudentsPage";
import type { Session, StudentProfile, StudentScheduleRule } from "../../shared/appShared";

type Snapshot = {
  rules: StudentScheduleRule[];
  sessions: Session[];
  students: StudentProfile[];
  toasts: string[];
};

const selectedDate = "2026-04-20";

function makeStudents(): StudentProfile[] {
  return [
    {
      id: 1,
      name: "陳小明",
      birthday: "2012-03-08",
      school: "培正中學",
      status: "active",
    },
    {
      id: 2,
      name: "李小欣",
      birthday: "2011-11-21",
      school: "聖羅撒女子中學",
      status: "scheduled_deactivation",
      deactivateMode: "scheduled",
      deactivateOn: "2026-05-01",
    },
    {
      id: 3,
      name: "王家朗",
      birthday: "2012-03-08",
      school: "澳門坊眾學校",
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

function makeSessions(): Session[] {
  return [
    {
      id: 201,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "16:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    },
    {
      id: 202,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-21",
      start: "19:00",
      durationMin: 60,
      status: "pending",
      kind: "makeup",
    },
    {
      id: 203,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-22",
      start: "20:00",
      durationMin: 60,
      status: "pending",
      kind: "extra",
    },
    {
      id: 204,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-13",
      start: "16:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    },
    {
      id: 205,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-05-04",
      start: "16:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    },
    {
      id: 206,
      studentId: 2,
      student: { id: 2, name: "李小欣" },
      dateISO: "2026-04-20",
      start: "16:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    },
  ];
}

function StudentsPageHarness({
  initialStudents = makeStudents(),
  initialRules = makeRules(),
  initialSessions = makeSessions(),
  isStudentsBackendAvailable = false,
  onSnapshot,
}: {
  initialStudents?: StudentProfile[];
  initialRules?: StudentScheduleRule[];
  initialSessions?: Session[];
  isStudentsBackendAvailable?: boolean;
  onSnapshot: (snapshot: Snapshot) => void;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [rules, setRules] = useState(initialRules);
  const [sessions, setSessions] = useState(initialSessions);
  const [toasts, setToasts] = useState<string[]>([]);

  const setToast: Dispatch<SetStateAction<string>> = (value) => {
    setToasts((current) => {
      const previous = current.length > 0 ? current[current.length - 1] : "";
      const next = typeof value === "function" ? value(previous) : value;
      return next ? [...current, next] : current;
    });
  };

  useEffect(() => {
    onSnapshot({ students, rules, sessions, toasts });
  }, [students, rules, sessions, toasts, onSnapshot]);

  return (
    <StudentsPage
      selectedDate={selectedDate}
      students={students}
      setStudents={setStudents}
      isStudentsBackendAvailable={isStudentsBackendAvailable}
      studentScheduleRules={rules}
      setStudentScheduleRules={setRules}
      sessions={sessions}
      setSessions={setSessions}
      setToast={setToast}
    />
  );
}

function renderStudentsPage(options: {
  initialStudents?: StudentProfile[];
  initialRules?: StudentScheduleRule[];
  initialSessions?: Session[];
  isStudentsBackendAvailable?: boolean;
} = {}) {
  let snapshot: Snapshot = {
    students: [],
    rules: [],
    sessions: [],
    toasts: [],
  };
  const user = userEvent.setup();

  render(
    <StudentsPageHarness
      {...options}
      onSnapshot={(nextSnapshot) => {
        Object.assign(snapshot, nextSnapshot);
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

function getStudentCard(name: string) {
  const heading = screen.getByText(name);
  let current = heading.parentElement;

  while (current && current !== document.body) {
    const className = current.getAttribute("class") ?? "";
    if (className.includes("relative p-0")) return current as HTMLElement;
    current = current.parentElement;
  }

  throw new Error(`Student card not found for ${name}`);
}

function uniqueRegularKeys(sessions: Session[]) {
  return new Set(
    sessions
      .filter((session) => session.kind === "regular")
      .map((session) => `${session.studentId}|${session.dateISO}|${session.start}|${session.kind}`)
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fillCreateStudentForm(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getAllByRole("button", { name: "新增學生" })[0]);

  const inputs = document.querySelectorAll("input");
  fireEvent.change(inputs[1], { target: { value: name } });
  fireEvent.change(inputs[2], { target: { value: "2012-04-05" } });
  fireEvent.change(inputs[3], { target: { value: "測試學校" } });
}

async function openStudentEditor(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(getStudentCard(name)).getAllByRole("button")[0]);
  await screen.findByText("基本資料");
}

function backendStudentResponse(overrides: Partial<StudentProfile>) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? "陳小明",
    birthday: overrides.birthday ?? "2012-03-08",
    school: overrides.school ?? "培正中學",
    status: overrides.status ?? "active",
    deactivateMode: overrides.deactivateMode ?? null,
    deactivateOn: overrides.deactivateOn ?? null,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
  };
}

describe("StudentsPage", () => {
  it("shows an empty state when there are no students", () => {
    renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
    });

    expect(screen.getByText("管理學生")).toBeInTheDocument();
    expect(screen.getByText("尚未建立任何學生")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增第一位學生" })).toBeInTheDocument();
  });

  it("renders student management, search, status filters, and inactive students", () => {
    renderStudentsPage();

    expect(screen.getByText("管理學生")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜尋姓名 / 生日 / 學校 / ID")).toBeInTheDocument();
    expect(screen.getByText("狀態篩選")).toBeInTheDocument();
    expect(screen.getByText("王家朗")).toBeInTheDocument();
  });

  it("filters students by search query", async () => {
    const { user } = renderStudentsPage();

    await user.type(screen.getByPlaceholderText("搜尋姓名 / 生日 / 學校 / ID"), "王家朗");

    expect(screen.getByText("王家朗")).toBeInTheDocument();
    expect(screen.queryByText("陳小明")).not.toBeInTheDocument();
    expect(screen.queryByText("李小欣")).not.toBeInTheDocument();
  });

  it("creates a student through backend when backend students are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: 900,
          name: "後端新增學生",
          birthday: "2012-04-05",
          school: "測試學校",
          status: "active",
          deactivateMode: null,
          deactivateOn: null,
          createdAt: "2026-05-25T10:00:00",
          updatedAt: "2026-05-25T10:00:00",
        }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
      isStudentsBackendAvailable: true,
    });

    await fillCreateStudentForm(user, "後端新增學生");
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() =>
      expect(snapshot.students).toEqual([
        expect.objectContaining({
          id: 900,
          name: "後端新增學生",
          birthday: "2012-04-05",
          school: "測試學校",
          status: "active",
        }),
      ])
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "後端新增學生",
          birthday: "2012-04-05",
          school: "測試學校",
          status: "active",
        }),
      })
    );
  });

  it("does not create a local student when backend create fails in backend mode", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
      isStudentsBackendAvailable: true,
    });

    await fillCreateStudentForm(user, "失敗學生");
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("新增學生失敗，請確認後端是否正常")
    );
    expect(snapshot.students).toEqual([]);
    expect(screen.getAllByText("新增學生").length).toBeGreaterThan(1);
  });

  it("keeps local student creation when backend students are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
      isStudentsBackendAvailable: false,
    });

    await fillCreateStudentForm(user, "本地新增學生");
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() =>
      expect(snapshot.students).toEqual([
        expect.objectContaining({
          id: 1001,
          name: "本地新增學生",
          birthday: "2012-04-05",
          school: "測試學校",
          status: "active",
        }),
      ])
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("updates a student through backend and syncs linked session names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendStudentResponse({
            id: 1,
            name: "後端改名學生",
            birthday: "2012-03-08",
            school: "培正中學",
            status: "active",
          }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: true });

    await openStudentEditor(user, "陳小明");
    fireEvent.change(screen.getByDisplayValue("陳小明"), {
      target: { value: "後端改名學生" },
    });
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.students.find((student) => student.id === 1)?.name).toBe("後端改名學生")
    );
    expect(snapshot.sessions.filter((session) => session.studentId === 1).every((session) => session.student.name === "後端改名學生")).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "後端改名學生",
          birthday: "2012-03-08",
          school: "培正中學",
        }),
      })
    );
  });

  it("keeps local student editing when backend students are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: false });

    await openStudentEditor(user, "陳小明");
    fireEvent.change(screen.getByDisplayValue("陳小明"), {
      target: { value: "本地 fallback 改名" },
    });
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.students.find((student) => student.id === 1)?.name).toBe("本地 fallback 改名")
    );
    expect(snapshot.sessions.filter((session) => session.studentId === 1).every((session) => session.student.name === "本地 fallback 改名")).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not update local students or linked sessions when backend edit fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: true });

    await openStudentEditor(user, "陳小明");
    fireEvent.change(screen.getByDisplayValue("陳小明"), {
      target: { value: "不應成功" },
    });
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => expect(snapshot.toasts).toContain("編輯學生失敗，請確認後端是否正常"));
    expect(snapshot.students.find((student) => student.id === 1)?.name).toBe("陳小明");
    expect(snapshot.sessions.filter((session) => session.studentId === 1).every((session) => session.student.name === "陳小明")).toBe(true);
  });

  it("deactivates a student through backend before removing linked future sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendStudentResponse({
            id: 1,
            name: "陳小明",
            birthday: "2012-03-08",
            school: "培正中學",
            status: "inactive",
            deactivateMode: "immediate",
          }),
      }))
    );
    const futureSession: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      initialSessions: [...makeSessions(), futureSession],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "立即停用" }));
    await user.click(screen.getByRole("button", { name: "確認停用" }));

    await waitFor(() => expect(snapshot.students.find((student) => student.id === 1)?.status).toBe("inactive"));
    expect(snapshot.sessions.some((session) => session.id === 999)).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "inactive",
          deactivateMode: "immediate",
          deactivateOn: null,
        }),
      })
    );
  });

  it("does not remove linked sessions when backend deactivation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const futureSession: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      initialSessions: [...makeSessions(), futureSession],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "立即停用" }));
    await user.click(screen.getByRole("button", { name: "確認停用" }));

    await waitFor(() => expect(snapshot.toasts).toContain("停用學生失敗，請確認後端是否正常"));
    expect(snapshot.students.find((student) => student.id === 1)?.status).toBe("active");
    expect(snapshot.sessions.some((session) => session.id === 999)).toBe(true);
  });

  it("schedules deactivation through backend before removing sessions from the scheduled date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendStudentResponse({
            id: 1,
            name: "陳小明",
            birthday: "2012-03-08",
            school: "培正中學",
            status: "scheduled_deactivation",
            deactivateMode: "scheduled",
            deactivateOn: "2099-02-01",
          }),
      }))
    );
    const beforeScheduledDate: Session = {
      id: 998,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-31",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const afterScheduledDate: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-02-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      initialSessions: [...makeSessions(), beforeScheduledDate, afterScheduledDate],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "指定日期停用" }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2099-02-01" } });
    await user.click(screen.getByRole("button", { name: "確認設定" }));

    await waitFor(() =>
      expect(snapshot.students.find((student) => student.id === 1)?.status).toBe(
        "scheduled_deactivation"
      )
    );
    expect(snapshot.students.find((student) => student.id === 1)?.deactivateOn).toBe("2099-02-01");
    expect(snapshot.sessions.some((session) => session.id === 998)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 999)).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "scheduled_deactivation",
          deactivateMode: "scheduled",
          deactivateOn: "2099-02-01",
        }),
      })
    );
  });

  it("does not remove scheduled linked sessions when backend scheduled deactivation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const beforeScheduledDate: Session = {
      id: 998,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-31",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const afterScheduledDate: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-02-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      initialSessions: [...makeSessions(), beforeScheduledDate, afterScheduledDate],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "指定日期停用" }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2099-02-01" } });
    await user.click(screen.getByRole("button", { name: "確認設定" }));

    await waitFor(() => expect(snapshot.toasts).toContain("停用學生失敗，請確認後端是否正常"));
    expect(snapshot.students.find((student) => student.id === 1)?.status).toBe("active");
    expect(snapshot.sessions.some((session) => session.id === 998)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 999)).toBe(true);
  });

  it("cancels scheduled deactivation through backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendStudentResponse({
            id: 2,
            name: "李小欣",
            birthday: "2011-11-21",
            school: "聖羅撒女子中學",
            status: "active",
          }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: true });

    await openStudentEditor(user, "李小欣");
    await user.click(screen.getByRole("button", { name: "取消停用設定" }));

    await waitFor(() => expect(snapshot.students.find((student) => student.id === 2)?.status).toBe("active"));
    expect(snapshot.toasts).toContain("已取消停用設定，先前已移除的課次不會自動恢復");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          deactivateMode: null,
          deactivateOn: null,
        }),
      })
    );
  });

  it("restores an inactive student through backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendStudentResponse({
            id: 3,
            name: "王家朗",
            birthday: "2012-03-08",
            school: "澳門坊眾學校",
            status: "active",
          }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: true });

    await openStudentEditor(user, "王家朗");
    await user.click(screen.getByRole("button", { name: "恢復學生" }));
    await user.click(screen.getByRole("button", { name: "確認恢復" }));

    await waitFor(() => expect(snapshot.students.find((student) => student.id === 3)?.status).toBe("active"));
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/3",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          deactivateMode: null,
          deactivateOn: null,
        }),
      })
    );
  });

  it("shows schedule rule sections and counts per student", () => {
    renderStudentsPage();

    expect(within(getStudentCard("陳小明")).getByText("共 3 條規則")).toBeInTheDocument();
    expect(within(getStudentCard("李小欣")).getByText("共 0 條規則")).toBeInTheDocument();
  });

  it("creates a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();

    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "新增固定課表" }));

    expect(screen.getAllByText("新增固定課表").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByRole("combobox"), "5");
    fireEvent.change(screen.getByDisplayValue("16:00"), { target: { value: "18:30" } });
    const durationInput = screen.getByRole("spinbutton");
    await user.clear(durationInput);
    await user.type(durationInput, "45");
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => expect(snapshot.rules).toHaveLength(4));
    expect(snapshot.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 1,
          weekday: 5,
          start: "18:30",
          durationMin: 45,
          isActive: true,
        }),
      ])
    );
    expect(snapshot.toasts).toContain("已新增固定課表規則");
  });

  it("edits a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();

    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "編輯" })[0]);
    fireEvent.change(screen.getByDisplayValue("16:00"), { target: { value: "19:15" } });
    const durationInput = screen.getByRole("spinbutton");
    await user.clear(durationInput);
    await user.type(durationInput, "75");
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.rules.find((rule) => rule.id === 101)).toEqual(
        expect.objectContaining({ start: "19:15", durationMin: 75 })
      )
    );
    expect(snapshot.toasts).toContain("已更新固定課表規則");
  });

  it("deactivates and restores a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();
    const card = getStudentCard("陳小明");

    await user.click(within(card).getAllByRole("button", { name: "停用" })[0]);
    await waitFor(() => expect(snapshot.rules.find((rule) => rule.id === 101)?.isActive).toBe(false));
    expect(snapshot.toasts).toContain("已停用固定課表規則");

    await user.click(within(card).getAllByRole("button", { name: "恢復" })[0]);
    await waitFor(() => expect(snapshot.rules.find((rule) => rule.id === 101)?.isActive).toBe(true));
    expect(snapshot.toasts).toContain("已恢復固定課表規則");
  });

  it("deletes a schedule rule after confirmation", async () => {
    const { user, snapshot } = renderStudentsPage();

    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "刪除" })[0]);
    expect(screen.getByText("刪除固定課表規則")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認刪除" }));

    await waitFor(() => expect(snapshot.rules.some((rule) => rule.id === 101)).toBe(false));
    expect(snapshot.toasts).toContain("已刪除固定課表規則");
  });

  it("generates remaining monthly regular sessions for an active student and skips duplicates", async () => {
    const { user, snapshot } = renderStudentsPage();

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    const generated = snapshot.sessions.filter((session) => session.id > 206);
    expect(generated).toHaveLength(3);
    expect(generated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 1,
          student: { id: 1, name: "陳小明" },
          status: "pending",
          kind: "regular",
        }),
      ])
    );
    expect(generated.every((session) => session.dateISO >= selectedDate && session.dateISO <= "2026-04-30")).toBe(
      true
    );
    expect(snapshot.sessions.filter((session) => session.studentId === 1 && session.dateISO === "2026-04-20" && session.start === "16:00" && session.kind === "regular")).toHaveLength(1);
  });

  it("does not generate regular sessions for inactive students", async () => {
    const { user, snapshot } = renderStudentsPage();

    await user.click(
      within(getStudentCard("王家朗")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    expect(snapshot.sessions).toHaveLength(6);
    await waitFor(() => expect(snapshot.toasts).toContain("只有啟用中的學生可生成 regular 課次"));
  });

  it("does not generate regular sessions when a student has no active rules", async () => {
    const { user, snapshot } = renderStudentsPage({
      initialRules: [{ id: 101, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: false }],
    });

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    expect(snapshot.sessions).toHaveLength(6);
    await waitFor(() => expect(snapshot.toasts).toContain("此學生沒有可用的固定課表規則"));
  });

  it("does not generate duplicate regular sessions when overlapping rules match the same day and time", async () => {
    const { user, snapshot } = renderStudentsPage({
      initialRules: [
        { id: 101, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
        { id: 102, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
      ],
      initialSessions: [],
    });

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    await waitFor(() => expect(snapshot.sessions).toHaveLength(2));
    expect(uniqueRegularKeys(snapshot.sessions).size).toBe(2);
  });

  it("clears only this student's remaining monthly regular sessions", async () => {
    const sessions = [
      ...makeSessions(),
      {
        id: 207,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-04-27",
        start: "16:00",
        durationMin: 60,
        status: "pending",
        kind: "regular",
      } satisfies Session,
    ];
    const { user, snapshot } = renderStudentsPage({ initialSessions: sessions });

    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "清除本月 regular" }));

    await waitFor(() => expect(snapshot.sessions).toHaveLength(5));
    expect(snapshot.sessions.some((session) => session.id === 201)).toBe(false);
    expect(snapshot.sessions.some((session) => session.id === 207)).toBe(false);
    expect(snapshot.sessions.some((session) => session.id === 202 && session.kind === "makeup")).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 203 && session.kind === "extra")).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 204)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 205)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 206)).toBe(true);
  });

  it("shows a toast when there are no remaining monthly regular sessions to clear", async () => {
    const { user, snapshot } = renderStudentsPage({
      initialSessions: makeSessions().filter((session) => session.id !== 201),
    });

    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "清除本月 regular" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("本月剩餘日期沒有可清除的 regular 課次")
    );
  });

  it("regenerates remaining monthly regular sessions without touching makeup or extra", async () => {
    const staleRegular: Session = {
      id: 207,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "09:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
    };
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [...makeSessions(), staleRegular],
    });

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(
        snapshot.sessions.some(
          (session) =>
            session.studentId === 1 &&
            session.kind === "regular" &&
            session.dateISO === "2026-04-20" &&
            session.start === "09:00"
        )
      ).toBe(false)
    );
    const remainingRegular = snapshot.sessions.filter(
      (session) => session.studentId === 1 && session.kind === "regular" && session.dateISO >= selectedDate && session.dateISO <= "2026-04-30"
    );
    expect(remainingRegular).toHaveLength(4);
    expect(snapshot.sessions.some((session) => session.id === 202 && session.kind === "makeup")).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 203 && session.kind === "extra")).toBe(true);
    expect(snapshot.toasts).toContain("已重新生成 4 堂 regular 課次");
  });

  it("shows a toast when there is nothing to regenerate", async () => {
    const { user, snapshot } = renderStudentsPage({
      initialRules: [],
      initialSessions: [],
    });

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("本月剩餘日期沒有可重新生成的 regular 課次")
    );
  });
});
