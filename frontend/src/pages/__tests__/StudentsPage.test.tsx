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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
    },
  ];
}

function StudentsPageHarness({
  initialStudents = makeStudents(),
  initialRules = makeRules(),
  initialSessions = makeSessions(),
  isStudentsBackendAvailable = false,
  isScheduleRulesBackendAvailable = false,
  isSessionsBackendAvailable = false,
  onSnapshot,
}: {
  initialStudents?: StudentProfile[];
  initialRules?: StudentScheduleRule[];
  initialSessions?: Session[];
  isStudentsBackendAvailable?: boolean;
  isScheduleRulesBackendAvailable?: boolean;
  isSessionsBackendAvailable?: boolean;
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
      isScheduleRulesBackendAvailable={isScheduleRulesBackendAvailable}
      isSessionsBackendAvailable={isSessionsBackendAvailable}
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
  isScheduleRulesBackendAvailable?: boolean;
  isSessionsBackendAvailable?: boolean;
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

// 預設情況下每張學生卡片的「固定課表」區是收起的（Phase 4-6A）。
// 既有測試需要直接操作課表內按鈕，呼叫此 helper 確保展開（idempotent：已展開時 no-op）。
async function expandSchedule(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  const card = getStudentCard(name);
  const toggle = within(card).queryByRole("button", { name: "展開固定課表" });
  if (toggle) await user.click(toggle);
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

function backendRuleResponse(overrides: Partial<StudentScheduleRule>) {
  return {
    id: overrides.id ?? 701,
    studentId: overrides.studentId ?? 1,
    weekday: overrides.weekday ?? 1,
    start: overrides.start ?? "16:00",
    durationMin: overrides.durationMin ?? 60,
    isActive: overrides.isActive ?? true,
    createdAt: "2026-05-25T10:00:00",
    updatedAt: "2026-05-25T10:00:00",
  };
}

function backendSessionResponse(overrides: Partial<Session> & { scheduleRuleId?: number }) {
  return {
    id: overrides.id ?? 901,
    studentId: overrides.studentId ?? 1,
    student: overrides.student ?? { id: 1, name: "陳小明" },
    dateISO: overrides.dateISO ?? "2026-04-22",
    start: overrides.start ?? "17:00",
    durationMin: overrides.durationMin ?? 60,
    status: overrides.status ?? "pending",
    reason: null,
    note: null,
    kind: overrides.kind ?? "regular",
    makeupOfDateISO: overrides.makeupOfDateISO ?? null,
    makeupOfSessionId: overrides.makeupOfSessionId ?? null,
    scheduleRuleId: overrides.scheduleRuleId ?? null,
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

  it("creates a student with an empty school (school optional, plan B)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: 901,
          name: "無學校學生",
          birthday: "2012-04-05",
          school: "",
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

    // 只填姓名 + 生日，學校留空。
    await user.click(screen.getAllByRole("button", { name: "新增學生" })[0]);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[1], { target: { value: "無學校學生" } });
    fireEvent.change(inputs[2], { target: { value: "2012-04-05" } });
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() =>
      expect(snapshot.students).toEqual([
        expect.objectContaining({ id: 901, name: "無學校學生", school: "" }),
      ])
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "無學校學生",
          birthday: "2012-04-05",
          school: "",
          status: "active",
        }),
      })
    );
  });

  it("blocks creation with an empty name and shows a precise toast", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
      isStudentsBackendAvailable: true,
    });

    // 留空姓名，填生日 + 學校。
    await user.click(screen.getAllByRole("button", { name: "新增學生" })[0]);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[2], { target: { value: "2012-04-05" } });
    fireEvent.change(inputs[3], { target: { value: "測試學校" } });
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() => expect(snapshot.toasts).toContain("請輸入學生姓名"));
    expect(fetch).not.toHaveBeenCalled();
    expect(snapshot.students).toEqual([]);
  });

  it("blocks creation with an empty birthday and shows a precise toast", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [],
      initialRules: [],
      initialSessions: [],
      isStudentsBackendAvailable: true,
    });

    // 填姓名 + 學校，留空生日。
    await user.click(screen.getAllByRole("button", { name: "新增學生" })[0]);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[1], { target: { value: "無生日學生" } });
    fireEvent.change(inputs[3], { target: { value: "測試學校" } });
    await user.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() => expect(snapshot.toasts).toContain("請輸入學生生日"));
    expect(fetch).not.toHaveBeenCalled();
    expect(snapshot.students).toEqual([]);
  });

  it("edits a student to clear the school (PATCH school empty string)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          ok: true,
          json: async () =>
            backendStudentResponse({
              id: 1,
              name: "陳小明",
              birthday: "2012-03-08",
              school: "",
              status: "active",
            }),
        })
      )
    );
    const { user, snapshot } = renderStudentsPage({ isStudentsBackendAvailable: true });

    await openStudentEditor(user, "陳小明");
    fireEvent.change(screen.getByDisplayValue("培正中學"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.students.find((student) => student.id === 1)?.school).toBe("")
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "陳小明",
          birthday: "2012-03-08",
          school: "",
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
      materialsProvided: false,
      materialsReasonCode: null,
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

  it("removes future linked sessions through backend DELETE when immediate deactivation succeeds", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
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
        } as Response;
      }
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ ok: true, detachedMakeupCount: 0 }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const futureSession: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const pastMakeupLinked: Session = {
      id: 1001,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "1900-01-01",
      start: "11:00",
      durationMin: 60,
      status: "present",
      kind: "makeup",
      makeupOfSessionId: 999,
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const otherStudentFuture: Session = {
      id: 1002,
      studentId: 2,
      student: { id: 2, name: "李小欣" },
      dateISO: "2099-01-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      isSessionsBackendAvailable: true,
      initialSessions: [...makeSessions(), futureSession, pastMakeupLinked, otherStudentFuture],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "立即停用" }));
    await user.click(screen.getByRole("button", { name: "確認停用" }));

    await waitFor(() =>
      expect(snapshot.toasts.some((t) => t.startsWith("已立即停用"))).toBe(true)
    );

    expect(snapshot.sessions.some((s) => s.id === 999)).toBe(false);
    const pastMakeupAfter = snapshot.sessions.find((s) => s.id === 1001);
    expect(pastMakeupAfter).toBeDefined();
    expect(pastMakeupAfter?.makeupOfSessionId).toBeUndefined();
    expect(snapshot.sessions.some((s) => s.id === 1002)).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/999",
      expect.objectContaining({ method: "DELETE" })
    );
    const deletedUrls = fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")
      .map(([url]) => url as string);
    expect(deletedUrls).toContain("http://127.0.0.1:8000/api/sessions/999");
    expect(deletedUrls).not.toContain("http://127.0.0.1:8000/api/sessions/1001");
    expect(deletedUrls).not.toContain("http://127.0.0.1:8000/api/sessions/1002");
  });

  it("does not remove local sessions when immediate deactivation backend DELETE fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
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
        } as Response;
      }
      if (init?.method === "DELETE") {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response;
      }
      throw new Error(`unexpected fetch ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const futureSession: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      isSessionsBackendAvailable: true,
      initialSessions: [...makeSessions(), futureSession],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "立即停用" }));
    await user.click(screen.getByRole("button", { name: "確認停用" }));

    await waitFor(() =>
      expect(snapshot.students.find((s) => s.id === 1)?.status).toBe("inactive")
    );
    expect(snapshot.toasts).toContain("停用學生時移除課次失敗，請確認後端是否正常");
    expect(snapshot.sessions.some((s) => s.id === 999)).toBe(true);
    expect(snapshot.toasts.every((t) => !t.startsWith("已立即停用"))).toBe(true);
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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

  it("removes sessions from deactivateOn onwards through backend DELETE when scheduled deactivation succeeds", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
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
        } as Response;
      }
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ ok: true, detachedMakeupCount: 0 }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const beforeScheduledDate: Session = {
      id: 998,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-01-31",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const otherStudentAfter: Session = {
      id: 1002,
      studentId: 2,
      student: { id: 2, name: "李小欣" },
      dateISO: "2099-02-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      isSessionsBackendAvailable: true,
      initialSessions: [...makeSessions(), beforeScheduledDate, afterScheduledDate, otherStudentAfter],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "指定日期停用" }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2099-02-01" } });
    await user.click(screen.getByRole("button", { name: "確認設定" }));

    await waitFor(() =>
      expect(snapshot.toasts.some((t) => t.startsWith("已設定停用"))).toBe(true)
    );

    expect(snapshot.sessions.some((s) => s.id === 999)).toBe(false);
    expect(snapshot.sessions.some((s) => s.id === 998)).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 1002)).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/999",
      expect.objectContaining({ method: "DELETE" })
    );
    const deletedUrls = fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")
      .map(([url]) => url as string);
    expect(deletedUrls).toContain("http://127.0.0.1:8000/api/sessions/999");
    expect(deletedUrls).not.toContain("http://127.0.0.1:8000/api/sessions/998");
    expect(deletedUrls).not.toContain("http://127.0.0.1:8000/api/sessions/1002");
  });

  it("does not remove local sessions when scheduled deactivation backend DELETE fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
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
        } as Response;
      }
      if (init?.method === "DELETE") {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response;
      }
      throw new Error(`unexpected fetch ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const afterScheduledDate: Session = {
      id: 999,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2099-02-01",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      isStudentsBackendAvailable: true,
      isSessionsBackendAvailable: true,
      initialSessions: [...makeSessions(), afterScheduledDate],
    });

    await openStudentEditor(user, "陳小明");
    await user.click(screen.getByRole("button", { name: "指定日期停用" }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2099-02-01" } });
    await user.click(screen.getByRole("button", { name: "確認設定" }));

    await waitFor(() =>
      expect(snapshot.students.find((s) => s.id === 1)?.status).toBe("scheduled_deactivation")
    );
    expect(snapshot.toasts).toContain("停用學生時移除課次失敗，請確認後端是否正常");
    expect(snapshot.sessions.some((s) => s.id === 999)).toBe(true);
    expect(snapshot.toasts.every((t) => !t.startsWith("已設定停用"))).toBe(true);
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
      materialsProvided: false,
      materialsReasonCode: null,
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
      materialsProvided: false,
      materialsReasonCode: null,
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

  it("creates a schedule rule through backend when backend rules are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendRuleResponse({
            id: 888,
            studentId: 1,
            weekday: 5,
            start: "18:30",
            durationMin: 45,
            isActive: true,
          }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({
      initialRules: [],
      isScheduleRulesBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "新增固定課表" }));
    await user.selectOptions(screen.getByRole("combobox"), "5");
    fireEvent.change(screen.getByDisplayValue("16:00"), { target: { value: "18:30" } });
    const durationInput = screen.getByRole("spinbutton");
    await user.clear(durationInput);
    await user.type(durationInput, "45");
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.rules).toEqual([
        expect.objectContaining({
          id: 888,
          studentId: 1,
          weekday: 5,
          start: "18:30",
          durationMin: 45,
          isActive: true,
        }),
      ])
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/students/1/schedule-rules",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          weekday: 5,
          start: "18:30",
          durationMin: 45,
          isActive: true,
        }),
      })
    );
  });

  it("does not create a local schedule rule when backend create fails", async () => {
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
      initialRules: [],
      isScheduleRulesBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "新增固定課表" }));
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("新增固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.rules).toEqual([]);
    expect(screen.getAllByText("新增固定課表").length).toBeGreaterThan(0);
  });

  it("creates a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();

    await expandSchedule(user, "陳小明");
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

  it("does not update a schedule rule when backend update fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isScheduleRulesBackendAvailable: true });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "編輯" })[0]);
    fireEvent.change(screen.getByDisplayValue("16:00"), { target: { value: "19:15" } });
    await user.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("更新固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.rules.find((rule) => rule.id === 101)).toEqual(
      expect.objectContaining({ start: "16:00", durationMin: 60 })
    );
  });

  it("edits a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();

    await expandSchedule(user, "陳小明");
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

  it("toggles a schedule rule through backend when backend rules are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          backendRuleResponse({
            id: 101,
            studentId: 1,
            weekday: 1,
            start: "16:00",
            durationMin: 60,
            isActive: false,
          }),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isScheduleRulesBackendAvailable: true });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "停用" })[0]);

    await waitFor(() => expect(snapshot.rules.find((rule) => rule.id === 101)?.isActive).toBe(false));
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/schedule-rules/101",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      })
    );
  });

  it("deactivates and restores a schedule rule", async () => {
    const { user, snapshot } = renderStudentsPage();
    await expandSchedule(user, "陳小明");
    const card = getStudentCard("陳小明");

    await user.click(within(card).getAllByRole("button", { name: "停用" })[0]);
    await waitFor(() => expect(snapshot.rules.find((rule) => rule.id === 101)?.isActive).toBe(false));
    expect(snapshot.toasts).toContain("已停用固定課表規則");

    await user.click(within(card).getAllByRole("button", { name: "恢復" })[0]);
    await waitFor(() => expect(snapshot.rules.find((rule) => rule.id === 101)?.isActive).toBe(true));
    expect(snapshot.toasts).toContain("已恢復固定課表規則");
  });

  it("does not delete a schedule rule when backend delete fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    const { user, snapshot } = renderStudentsPage({ isScheduleRulesBackendAvailable: true });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "刪除" })[0]);
    await user.click(screen.getByRole("button", { name: "確認刪除" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("刪除固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.rules.some((rule) => rule.id === 101)).toBe(true);
    expect(screen.getByText("刪除固定課表規則")).toBeInTheDocument();
  });

  it("deletes a schedule rule after confirmation", async () => {
    const { user, snapshot } = renderStudentsPage();

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getAllByRole("button", { name: "刪除" })[0]);
    expect(screen.getByText("刪除固定課表規則")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認刪除" }));

    await waitFor(() => expect(snapshot.rules.some((rule) => rule.id === 101)).toBe(false));
    expect(snapshot.toasts).toContain("已刪除固定課表規則");
  });

  it("generates remaining monthly regular sessions for an active student and skips duplicates", async () => {
    const { user, snapshot } = renderStudentsPage();

    await expandSchedule(user, "陳小明");
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

  it("generates remaining monthly regular sessions through backend when sessions backend is available", async () => {
    const payloads: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        payloads.push(payload);
        return {
          ok: true,
          json: async () =>
            backendSessionResponse({
              id: 900 + payloads.length,
              studentId: payload.studentId as number,
              student: { id: 1, name: "陳小明" },
              dateISO: payload.dateISO as string,
              start: payload.start as string,
              durationMin: payload.durationMin as number,
              kind: "regular",
              scheduleRuleId: payload.scheduleRuleId as number,
            }),
        };
      })
    );
    const { user, snapshot } = renderStudentsPage({ isSessionsBackendAvailable: true });

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 1,
          kind: "regular",
          reason: null,
          note: null,
          makeupOfDateISO: null,
          makeupOfSessionId: null,
          scheduleRuleId: 101,
        }),
        expect.objectContaining({
          studentId: 1,
          kind: "regular",
          reason: null,
          note: null,
          makeupOfDateISO: null,
          makeupOfSessionId: null,
          scheduleRuleId: 102,
        }),
      ])
    );
    expect(payloads.some((payload) => payload.dateISO === "2026-04-20" && payload.start === "16:00")).toBe(false);
    expect(snapshot.toasts).toContain("已生成 3 堂 regular 課次，略過 1 堂已存在課次");
  });

  it("does not append local regular sessions when backend regular generation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        if (payload.scheduleRuleId === 102) {
          return {
            ok: false,
            status: 500,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () =>
            backendSessionResponse({
              id: 910,
              studentId: payload.studentId as number,
              student: { id: 1, name: "陳小明" },
              dateISO: payload.dateISO as string,
              start: payload.start as string,
              durationMin: payload.durationMin as number,
              kind: "regular",
              scheduleRuleId: payload.scheduleRuleId as number,
            }),
        };
      })
    );
    const { user, snapshot } = renderStudentsPage({ isSessionsBackendAvailable: true });

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("生成固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions).toHaveLength(6);
  });

  it("does not call backend regular generation for inactive students", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { user, snapshot } = renderStudentsPage({ isSessionsBackendAvailable: true });

    await expandSchedule(user, "王家朗");
    await user.click(
      within(getStudentCard("王家朗")).getByRole("button", { name: "生成本月 regular 課次" })
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(snapshot.sessions).toHaveLength(6);
    await waitFor(() => expect(snapshot.toasts).toContain("只有啟用中的學生可生成 regular 課次"));
  });

  it("does not generate regular sessions for inactive students", async () => {
    const { user, snapshot } = renderStudentsPage();

    await expandSchedule(user, "王家朗");
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

    await expandSchedule(user, "陳小明");
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

    await expandSchedule(user, "陳小明");
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
        materialsProvided: false,
        materialsReasonCode: null,
      } satisfies Session,
    ];
    const { user, snapshot } = renderStudentsPage({ initialSessions: sessions });

    await expandSchedule(user, "陳小明");
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

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "清除本月 regular" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("本月剩餘日期沒有可清除的 regular 課次")
    );
  });

  it("clears remaining monthly regular sessions through backend when sessions backend is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, detachedMakeupCount: 0 }),
      }))
    );
    const sessions: Session[] = [
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
        materialsProvided: false,
        materialsReasonCode: null,
      },
      {
        id: 208,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-04-28",
        start: "19:00",
        durationMin: 60,
        status: "pending",
        kind: "makeup",
        makeupOfSessionId: 201,
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { user, snapshot } = renderStudentsPage({
      initialSessions: sessions,
      isSessionsBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "清除本月 regular" }));

    await waitFor(() =>
      expect(snapshot.sessions.some((session) => session.id === 201)).toBe(false)
    );
    expect(snapshot.sessions.some((session) => session.id === 207)).toBe(false);
    const makeupAfter = snapshot.sessions.find((session) => session.id === 208);
    expect(makeupAfter).toBeDefined();
    expect(makeupAfter?.makeupOfSessionId).toBeUndefined();
    expect(snapshot.sessions.some((session) => session.id === 202 && session.kind === "makeup")).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 203 && session.kind === "extra")).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 204)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 205)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 206)).toBe(true);
    expect(snapshot.toasts).toContain("已清除 2 堂 regular 課次");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/201",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/207",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("does not remove local regular sessions when backend clear fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, detachedMakeupCount: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const sessions: Session[] = [
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
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { user, snapshot } = renderStudentsPage({
      initialSessions: sessions,
      isSessionsBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(within(getStudentCard("陳小明")).getByRole("button", { name: "清除本月 regular" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("清除固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions.some((session) => session.id === 201)).toBe(true);
    expect(snapshot.sessions.some((session) => session.id === 207)).toBe(true);
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
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [...makeSessions(), staleRegular],
    });

    await expandSchedule(user, "陳小明");
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

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("本月剩餘日期沒有可重新生成的 regular 課次")
    );
  });

  it("regenerates remaining monthly regular sessions through backend when sessions backend is available", async () => {
    let postCounter = 900;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ ok: true, detachedMakeupCount: 0 }),
        } as Response;
      }
      if (init?.method === "POST") {
        postCounter++;
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          studentId: number;
          dateISO: string;
          start: string;
          durationMin: number;
          kind: Session["kind"];
          scheduleRuleId: number;
        };
        return {
          ok: true,
          json: async () =>
            backendSessionResponse({
              id: postCounter,
              studentId: body.studentId,
              dateISO: body.dateISO,
              start: body.start,
              durationMin: body.durationMin,
              kind: body.kind,
              scheduleRuleId: body.scheduleRuleId,
            }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const staleRegular: Session = {
      id: 207,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "09:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const linkedMakeup: Session = {
      id: 208,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-28",
      start: "19:00",
      durationMin: 60,
      status: "pending",
      kind: "makeup",
      makeupOfSessionId: 201,
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [...makeSessions(), staleRegular, linkedMakeup],
      isSessionsBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("已重新生成 4 堂 regular 課次")
    );

    expect(snapshot.sessions.some((s) => s.id === 201)).toBe(false);
    expect(snapshot.sessions.some((s) => s.id === 207)).toBe(false);
    expect(snapshot.sessions.some((s) => s.id === 202 && s.kind === "makeup")).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 203 && s.kind === "extra")).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 204)).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 205)).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 206)).toBe(true);
    const makeupAfter = snapshot.sessions.find((s) => s.id === 208);
    expect(makeupAfter).toBeDefined();
    expect(makeupAfter?.makeupOfSessionId).toBeUndefined();
    const newSessions = snapshot.sessions.filter((s) => s.id >= 901);
    expect(newSessions).toHaveLength(4);
    newSessions.forEach((s) => {
      expect(s.studentId).toBe(1);
      expect(s.kind).toBe("regular");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/201",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/sessions/207",
      expect.objectContaining({ method: "DELETE" })
    );
    const deleteCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(2);

    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    );
    expect(postCalls).toHaveLength(4);
    postCalls.forEach(([, init]) => {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.kind).toBe("regular");
      expect(body.makeupOfDateISO).toBeNull();
      expect(body.makeupOfSessionId).toBeNull();
      expect(body.reason).toBeNull();
      expect(body.note).toBeNull();
      expect(body.studentId).toBe(1);
      expect([101, 102]).toContain(body.scheduleRuleId);
    });
  });

  it("does not update local sessions when backend regenerate delete fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response;
      }
      throw new Error("POST should not be called when DELETE fails");
    });
    vi.stubGlobal("fetch", fetchMock);

    const staleRegular: Session = {
      id: 207,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "09:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [...makeSessions(), staleRegular],
      isSessionsBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("重新生成固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions.some((s) => s.id === 201)).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 207)).toBe(true);
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });

  it("does not update local sessions when backend regenerate create fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ ok: true, detachedMakeupCount: 0 }),
        } as Response;
      }
      if (init?.method === "POST") {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response;
      }
      throw new Error("unexpected method");
    });
    vi.stubGlobal("fetch", fetchMock);

    const staleRegular: Session = {
      id: 207,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-04-20",
      start: "09:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    };
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [...makeSessions(), staleRegular],
      isSessionsBackendAvailable: true,
    });

    await expandSchedule(user, "陳小明");
    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "重新生成本月 regular" })
    );

    await waitFor(() =>
      expect(snapshot.toasts).toContain("重新生成固定課表失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions.some((s) => s.id === 201)).toBe(true);
    expect(snapshot.sessions.some((s) => s.id === 207)).toBe(true);
  });

  // ------------------------------------------------------------
  // Phase 4-6A：固定課表收起 / 展開
  // ------------------------------------------------------------

  it("collapses each student's fixed schedule section by default", () => {
    renderStudentsPage();

    const card = getStudentCard("陳小明");
    // 收起時，動作按鈕與規則列表都不應在 DOM 中。
    expect(
      within(card).queryByRole("button", { name: "生成本月 regular 課次" })
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "清除本月 regular" })
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "重新生成本月 regular" })
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "新增固定課表" })
    ).not.toBeInTheDocument();
    // 但 summary 仍可見。
    expect(within(card).getByText("固定課表")).toBeInTheDocument();
    expect(within(card).getByText(/共\s*3\s*條規則/)).toBeInTheDocument();
    // 展開按鈕存在且為「展開」狀態。
    expect(
      within(card).getByRole("button", { name: "展開固定課表" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("expands and re-collapses the fixed schedule section on toggle", async () => {
    const { user } = renderStudentsPage();
    const card = getStudentCard("陳小明");

    await user.click(within(card).getByRole("button", { name: "展開固定課表" }));
    expect(
      within(card).getByRole("button", { name: "生成本月 regular 課次" })
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "收起固定課表" })
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(within(card).getByRole("button", { name: "收起固定課表" }));
    expect(
      within(card).queryByRole("button", { name: "生成本月 regular 課次" })
    ).not.toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "展開固定課表" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("expands one student's schedule without affecting another", async () => {
    const { user } = renderStudentsPage();

    await user.click(
      within(getStudentCard("陳小明")).getByRole("button", { name: "展開固定課表" })
    );

    expect(
      within(getStudentCard("陳小明")).getByRole("button", {
        name: "生成本月 regular 課次",
      })
    ).toBeInTheDocument();
    expect(
      within(getStudentCard("李小欣")).queryByRole("button", {
        name: "生成本月 regular 課次",
      })
    ).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------
  // Phase 4-6A：批量生成本月 regular
  // ------------------------------------------------------------

  it("renders the batch generate card with the default month range", async () => {
    const { user } = renderStudentsPage();

    const batchButton = screen.getByRole("button", { name: "批量生成固定課次" });
    expect(batchButton).toBeInTheDocument();

    await user.click(batchButton);
    // sheet 副標題唯一可識別此 sheet。
    expect(
      screen.getByText(/在指定日期範圍內，依固定課表補齊課次/)
    ).toBeInTheDocument();
    // selectedDate = "2026-04-20"，預設範圍 = 2026-04-01 .. 2026-04-30
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-30")).toBeInTheDocument();
  });

  it("hides the batch generate card when there are no students", () => {
    renderStudentsPage({ initialStudents: [], initialRules: [], initialSessions: [] });
    expect(
      screen.queryByRole("button", { name: "批量生成固定課次" })
    ).not.toBeInTheDocument();
  });

  it("shows an inline error and does not run when from date is later than to date", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="date"]'
    );
    fireEvent.change(inputs[0], { target: { value: "2026-04-20" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-10" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    expect(screen.getByText(/結束日期需晚於或等於開始日期/)).toBeInTheDocument();
    expect(snapshot.sessions).toEqual([]);
  });

  it("batch-generates regular sessions for active students with active rules and dedups", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // 學生 1（active）有 weekday 1+3 active rules + weekday 5 inactive rule。
    // 2026-04 內 Mon(1) = 4 個 (06,13,20,27)，Wed(3) = 5 個 (01,08,15,22,29)。
    // weekday 5 inactive 不生成。共 9 節。
    // 學生 2（scheduled_deactivation 非 active）不處理。
    // 學生 3（inactive）不處理。
    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    expect(snapshot.sessions.every((s) => s.studentId === 1)).toBe(true);
    expect(snapshot.sessions.every((s) => s.kind === "regular")).toBe(true);
    expect(uniqueRegularKeys(snapshot.sessions).size).toBe(9);
    expect(snapshot.toasts.some((t) => t.startsWith("已批量生成 9 堂"))).toBe(true);
  });

  it("batch generate reports skipped duplicates on second run", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));
    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // 第二輪應全部 skip，session 數不變。
    await waitFor(() =>
      expect(
        snapshot.toasts.some((t) =>
          t.includes("範圍內沒有可新增的 regular 課次") && t.includes("略過 9 堂已存在課次")
        )
      ).toBe(true)
    );
    expect(snapshot.sessions).toHaveLength(9);
    expect(uniqueRegularKeys(snapshot.sessions).size).toBe(9);
  });

  it("batch generate appends a no-rule notice when active students lack any rule", async () => {
    const { user, snapshot } = renderStudentsPage({
      initialStudents: [
        { id: 1, name: "甲", birthday: "2012-01-01", school: "A", status: "active" },
        { id: 2, name: "乙", birthday: "2012-01-01", school: "B", status: "active" },
      ],
      initialRules: [
        { id: 11, studentId: 1, weekday: 1, start: "16:00", durationMin: 60, isActive: true },
      ],
      initialSessions: [],
    });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // 學生 1 有 weekday 1 rule，2026-04 內 Mon = 4 個。
    await waitFor(() => expect(snapshot.sessions).toHaveLength(4));
    expect(
      snapshot.toasts.some(
        (t) => t.includes("已批量生成 4 堂") && t.includes("1 位學生沒有固定課表")
      )
    ).toBe(true);
  });

  it("batch generate honors a restricted date range within the month", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: "2026-04-15" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-30" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    // 學生 1 Mon (20, 27) = 2 個 + Wed (15, 22, 29) = 3 個 = 5 個。
    await waitFor(() => expect(snapshot.sessions).toHaveLength(5));
    expect(
      snapshot.sessions.every((s) => s.dateISO >= "2026-04-15" && s.dateISO <= "2026-04-30")
    ).toBe(true);
  });

  it("batch generate posts each session through the backend in backend mode", async () => {
    const payloads: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        payloads.push(payload);
        return {
          ok: true,
          json: async () =>
            backendSessionResponse({
              id: 900 + payloads.length,
              studentId: payload.studentId as number,
              student: { id: 1, name: "陳小明" },
              dateISO: payload.dateISO as string,
              start: payload.start as string,
              durationMin: payload.durationMin as number,
              kind: "regular",
              scheduleRuleId: payload.scheduleRuleId as number,
            }),
        };
      })
    );
    const { user, snapshot } = renderStudentsPage({
      initialSessions: [],
      isSessionsBackendAvailable: true,
    });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions).toHaveLength(9));
    expect(fetch).toHaveBeenCalledTimes(9);
    expect(payloads.every((p) => p.kind === "regular")).toBe(true);
    expect(payloads.every((p) => p.studentId === 1)).toBe(true);
    expect(payloads.every((p) => p.makeupOfSessionId === null)).toBe(true);
  });

  it("batch generate surfaces a toast when backend session creation fails", async () => {
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
      initialSessions: [],
      isSessionsBackendAvailable: true,
    });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("批量生成 regular 失敗，請確認後端是否正常")
    );
    expect(snapshot.sessions).toEqual([]);
  });

  it("batch generate reports no active students when none are active", async () => {
    const { user, snapshot } = renderStudentsPage({
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
      initialSessions: [],
    });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.toasts).toContain("沒有可批量生成的啟用中學生"));
    expect(snapshot.sessions).toEqual([]);
  });

  // ------------------------------------------------------------
  // 年份 / 月份快選 + 跨月跨年 + 去技術名詞文案
  // ------------------------------------------------------------

  it("does not expose technical wording on the batch entry button", () => {
    renderStudentsPage();
    expect(screen.getByRole("button", { name: "批量生成固定課次" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量生成本月 regular" })).not.toBeInTheDocument();
  });

  it("defaults the chip year to the selected date's year", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    expect(screen.getByText("2026 年")).toBeInTheDocument();
  });

  it("steps the chip year with the prev/next arrows", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    await user.click(screen.getByRole("button", { name: "下一年" }));
    expect(screen.getByText("2027 年")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "上一年" }));
    await user.click(screen.getByRole("button", { name: "上一年" }));
    expect(screen.getByText("2025 年")).toBeInTheDocument();
  });

  it("fills a leap-year February range from the month chip", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "下一年" })); // 2027
    await user.click(screen.getByRole("button", { name: "下一年" })); // 2028
    await user.click(screen.getByRole("button", { name: "2028 年 2 月" }));

    expect(screen.getByDisplayValue("2028-02-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2028-02-29")).toBeInTheDocument();
  });

  it("fills a non-leap February range from the month chip", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "下一年" })); // 2027
    await user.click(screen.getByRole("button", { name: "2027 年 2 月" }));

    expect(screen.getByDisplayValue("2027-02-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2027-02-28")).toBeInTheDocument();
  });

  it("fills 30-day and 31-day month ranges correctly from chips", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    await user.click(screen.getByRole("button", { name: "2026 年 4 月" })); // 30 days
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-30")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2026 年 1 月" })); // 31 days
    expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-01-31")).toBeInTheDocument();
  });

  it("highlights only the chip matching a full-month range, and none after a manual edit", async () => {
    const { user } = renderStudentsPage();
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    // Default range = whole April → 4 月 chip selected.
    expect(screen.getByRole("button", { name: "2026 年 4 月" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // Other chips not selected.
    expect(screen.getByRole("button", { name: "2026 年 5 月" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    // Manually narrow the range → no chip highlighted.
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(inputs[1], { target: { value: "2026-04-10" } });
    expect(screen.getByRole("button", { name: "2026 年 4 月" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("allows a cross-month range and generates across the months", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: "2026-07-15" } });
    fireEvent.change(inputs[1], { target: { value: "2026-09-20" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions.length).toBeGreaterThan(0));
    expect(snapshot.sessions.every((s) => s.kind === "regular" && s.studentId === 1)).toBe(true);
    expect(
      snapshot.sessions.every((s) => s.dateISO >= "2026-07-15" && s.dateISO <= "2026-09-20")
    ).toBe(true);
    expect(snapshot.sessions.some((s) => s.dateISO.startsWith("2026-07"))).toBe(true);
    expect(snapshot.sessions.some((s) => s.dateISO.startsWith("2026-09"))).toBe(true);
  });

  it("allows a cross-year range and generates across the year boundary", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: "2026-12-15" } });
    fireEvent.change(inputs[1], { target: { value: "2027-01-15" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions.length).toBeGreaterThan(0));
    expect(
      snapshot.sessions.every((s) => s.dateISO >= "2026-12-15" && s.dateISO <= "2027-01-15")
    ).toBe(true);
    expect(snapshot.sessions.some((s) => s.dateISO.startsWith("2026-12"))).toBe(true);
    expect(snapshot.sessions.some((s) => s.dateISO.startsWith("2027-01"))).toBe(true);
  });

  it("uses the final manually edited dates even after a chip fill", async () => {
    const { user, snapshot } = renderStudentsPage({ initialSessions: [] });
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));

    await user.click(screen.getByRole("button", { name: "2026 年 4 月" })); // fills whole April
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: "2026-04-13" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-15" } });
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions.length).toBeGreaterThan(0));
    expect(
      snapshot.sessions.every((s) => s.dateISO >= "2026-04-13" && s.dateISO <= "2026-04-15")
    ).toBe(true);
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
    const { user, snapshot } = renderStudentsPage({ initialSessions: [makeup, extra] });

    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    await user.click(screen.getByRole("button", { name: "批量生成" }));

    await waitFor(() => expect(snapshot.sessions.length).toBeGreaterThan(2));
    const keptMakeup = snapshot.sessions.find((s) => s.id === 5001);
    const keptExtra = snapshot.sessions.find((s) => s.id === 5002);
    expect(keptMakeup).toEqual(makeup);
    expect(keptExtra).toEqual(extra);
    // New sessions are all regular; makeup/extra untouched.
    const added = snapshot.sessions.filter((s) => s.id !== 5001 && s.id !== 5002);
    expect(added.every((s) => s.kind === "regular")).toBe(true);
  });
});
