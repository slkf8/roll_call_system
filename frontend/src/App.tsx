import { useEffect, useMemo, useState } from "react";
import TodayPage from "./pages/TodayPage";
import MonthPage from "./pages/MonthPage";
import StudentsPage from "./pages/StudentsPage";
import DataPage from "./pages/DataPage";
import { fetchStudents } from "./api/studentsApi";
import { fetchScheduleRules } from "./api/scheduleRulesApi";
import { fetchSessions } from "./api/sessionsApi";
import { fetchGlobalEvents } from "./api/globalEventsApi";
import type {
  TabKey,
  TabDef,
  Session,
  GlobalEvent,
  StudentProfile,
  StudentScheduleRule,
} from "./shared/appShared";
import {
  STORAGE_KEY,
  ThemeContext,
  studentProfilesSeed,
  studentScheduleRulesSeed,
  todayISO,
  addDaysISO,
  BottomTabBar,
  Toast,
  IconToday,
  IconMonth,
  IconUsers,
  IconFile,
  pageBackgroundClass,
} from "./shared/appShared";

function toSessionStudent(profile: { id: number; name: string }) {
  return {
    id: profile.id,
    name: profile.name,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeHHMM(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeStudentStatus(value: unknown): StudentProfile["status"] {
  return value === "active" || value === "scheduled_deactivation" || value === "inactive"
    ? value
    : "active";
}

function normalizeSessionStatus(value: unknown): Session["status"] {
  return value === "pending" || value === "present" || value === "absent" || value === "cancelled"
    ? value
    : "pending";
}

function normalizeSessionKind(value: unknown): Session["kind"] {
  return value === "regular" || value === "makeup" || value === "extra" ? value : "regular";
}

function normalizePersistedStudent(value: unknown, fallbackId: number): StudentProfile {
  const item = isRecord(value) ? value : {};
  const status = normalizeStudentStatus(item.status);
  const deactivateMode =
    item.deactivateMode === "immediate" || item.deactivateMode === "scheduled"
      ? item.deactivateMode
      : undefined;

  return {
    id: typeof item.id === "number" ? item.id : fallbackId,
    name: typeof item.name === "string" ? item.name : "未命名學生",
    birthday: typeof item.birthday === "string" ? item.birthday : "",
    school: typeof item.school === "string" ? item.school : "",
    status,
    deactivateMode,
    deactivateOn: isValidDateISO(item.deactivateOn) ? item.deactivateOn : undefined,
  };
}

function getSafeSessionStudentSnapshot(
  session: Partial<Session>,
  students: StudentProfile[]
) {
  if (session.studentId != null) {
    const linkedStudent = students.find((student) => student.id === session.studentId);
    if (linkedStudent) return toSessionStudent(linkedStudent);
  }

  const rawStudent = session.student as Partial<Session["student"]> | undefined;
  const rawName = typeof rawStudent?.name === "string" ? rawStudent.name.trim() : "";
  const rawId = typeof rawStudent?.id === "number" ? rawStudent.id : 0;

  return {
    id: rawId,
    name: rawName || "未關聯學生",
  };
}

function normalizePersistedSession(
  value: unknown,
  students: StudentProfile[],
  fallbackId: number
): Session {
  const session = (isRecord(value) ? value : {}) as Partial<Session>;
  const linkedStudent =
    session.studentId != null
      ? students.find((student) => student.id === session.studentId)
      : undefined;

  return {
    id: typeof session.id === "number" ? session.id : fallbackId,
    studentId: typeof session.studentId === "number" ? session.studentId : undefined,
    student: linkedStudent
      ? toSessionStudent(linkedStudent)
      : getSafeSessionStudentSnapshot(session, students),
    dateISO: isValidDateISO(session.dateISO) ? session.dateISO : todayISO(),
    start: normalizeHHMM(session.start, "00:00"),
    durationMin:
      typeof session.durationMin === "number" && session.durationMin > 0
        ? session.durationMin
        : 60,
    status: normalizeSessionStatus(session.status),
    reason: session.reason,
    note: typeof session.note === "string" ? session.note : undefined,
    kind: normalizeSessionKind(session.kind),
    makeupOfDateISO: isValidDateISO(session.makeupOfDateISO)
      ? session.makeupOfDateISO
      : undefined,
    makeupOfSessionId:
      typeof session.makeupOfSessionId === "number" ? session.makeupOfSessionId : undefined,
    // Materials: stable boolean + (null | 1–6); old payloads lacking the
    // fields default safely and never keep undefined.
    materialsProvided: session.materialsProvided === true,
    materialsReasonCode:
      session.materialsReasonCode === 1 ||
      session.materialsReasonCode === 2 ||
      session.materialsReasonCode === 3 ||
      session.materialsReasonCode === 4 ||
      session.materialsReasonCode === 5 ||
      session.materialsReasonCode === 6
        ? session.materialsReasonCode
        : null,
  };
}

function normalizePersistedRule(
  value: unknown,
  fallbackId: number
): StudentScheduleRule | null {
  if (!isRecord(value)) return null;
  if (typeof value.studentId !== "number") return null;

  const weekday =
    value.weekday === 0 ||
    value.weekday === 1 ||
    value.weekday === 2 ||
    value.weekday === 3 ||
    value.weekday === 4 ||
    value.weekday === 5 ||
    value.weekday === 6
      ? value.weekday
      : 1;

  return {
    id: typeof value.id === "number" ? value.id : fallbackId,
    studentId: value.studentId,
    weekday,
    start: normalizeHHMM(value.start, "16:00"),
    durationMin:
      typeof value.durationMin === "number" && value.durationMin > 0
        ? value.durationMin
        : 60,
    isActive: typeof value.isActive === "boolean" ? value.isActive : true,
  };
}

type SeedSessionConfig = Omit<
  Session,
  "student" | "studentId" | "materialsProvided" | "materialsReasonCode"
> & {
  studentIndex: number;
};

function createSeedSession(config: SeedSessionConfig): Session | null {
  const student = studentProfilesSeed[config.studentIndex];
  if (!student) return null;

  const { studentIndex: _studentIndex, ...session } = config;
  return {
    ...session,
    studentId: student.id,
    student: toSessionStudent(student),
    materialsProvided: false,
    materialsReasonCode: null,
  };
}

function buildSeedSessions(): Session[] {
  const d = todayISO();
  const configs: SeedSessionConfig[] = [
    { id: 2001, studentIndex: 0, dateISO: d, start: "14:00", durationMin: 60, status: "pending", kind: "regular" },
    { id: 2002, studentIndex: 1, dateISO: d, start: "15:00", durationMin: 60, status: "pending", kind: "regular" },
    { id: 2003, studentIndex: 0, dateISO: d, start: "16:00", durationMin: 60, status: "pending", kind: "regular" },
    {
      id: 2004,
      studentIndex: 1,
      dateISO: d,
      start: "17:00",
      durationMin: 60,
      status: "pending",
      kind: "makeup",
      makeupOfDateISO: addDaysISO(d, -4),
      makeupOfSessionId: 1999,
    },
    { id: 2101, studentIndex: 0, dateISO: "2026-05-01", start: "10:00", durationMin: 60, status: "present", kind: "regular" },
    { id: 2102, studentIndex: 0, dateISO: "2026-05-08", start: "10:00", durationMin: 60, status: "present", kind: "regular" },
    {
      id: 2103,
      studentIndex: 0,
      dateISO: "2026-05-15",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "makeup",
      makeupOfDateISO: "2026-05-12",
      makeupOfSessionId: 2099,
    },
    { id: 2104, studentIndex: 0, dateISO: "2026-05-22", start: "10:00", durationMin: 60, status: "present", kind: "extra" },
    {
      id: 2105,
      studentIndex: 0,
      dateISO: "2026-05-29",
      start: "10:00",
      durationMin: 60,
      status: "absent",
      reason: { id: 1, name: "生病", code: "SICK" },
      kind: "regular",
    },
    { id: 2106, studentIndex: 0, dateISO: "2026-04-25", start: "10:00", durationMin: 60, status: "present", kind: "regular" },
    { id: 2107, studentIndex: 1, dateISO: "2026-05-03", start: "16:00", durationMin: 60, status: "present", kind: "regular" },
    { id: 2108, studentIndex: 1, dateISO: "2026-05-10", start: "16:00", durationMin: 60, status: "pending", kind: "regular" },
    { id: 2109, studentIndex: 2, dateISO: "2026-05-05", start: "17:00", durationMin: 60, status: "present", kind: "regular" },
    { id: 2110, studentIndex: 3, dateISO: "2026-05-06", start: "18:00", durationMin: 60, status: "present", kind: "regular" },
    {
      id: 2111,
      studentIndex: 3,
      dateISO: "2026-05-13",
      start: "18:00",
      durationMin: 60,
      status: "present",
      kind: "makeup",
      makeupOfDateISO: "2026-05-09",
      makeupOfSessionId: 2098,
    },
    { id: 2112, studentIndex: 4, dateISO: "2026-05-07", start: "19:00", durationMin: 60, status: "present", kind: "regular" },
    { id: 2113, studentIndex: 5, dateISO: "2026-05-14", start: "19:30", durationMin: 60, status: "present", kind: "extra" },
  ];

  return configs
    .map(createSeedSession)
    .filter((session): session is Session => Boolean(session));
}

function restorePersistedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    const restoredStudents: StudentProfile[] = Array.isArray(parsed.students)
      ? parsed.students.map((student: unknown, index: number) =>
          normalizePersistedStudent(student, index + 1)
        )
      : [];

    const restoredSessions: unknown[] = Array.isArray(parsed.sessions)
      ? parsed.sessions
      : [];

    const normalizedStudents = [...restoredStudents];
    const normalizedSessions = restoredSessions.map((session, index) =>
      normalizePersistedSession(session, normalizedStudents, index + 1)
    );
    const normalizedRules = Array.isArray(parsed.studentScheduleRules)
      ? parsed.studentScheduleRules
          .map((rule: unknown, index: number) => normalizePersistedRule(rule, index + 1))
          .filter((rule: StudentScheduleRule | null): rule is StudentScheduleRule => Boolean(rule))
      : [];
    const selectedDate = isValidDateISO(parsed.selectedDate) ? parsed.selectedDate : todayISO();

    const activeTab =
      parsed.activeTab === "today" ||
      parsed.activeTab === "month" ||
      parsed.activeTab === "students" ||
      parsed.activeTab === "data"
        ? parsed.activeTab
        : "today";

    const normalizedGlobalEvents: GlobalEvent[] = Array.isArray(parsed.globalEvents)
      ? (parsed.globalEvents.filter((event: unknown) => isRecord(event)) as GlobalEvent[])
      : [];

    return {
      activeTab,
      selectedDate,
      globalEvents: normalizedGlobalEvents,
      students: normalizedStudents,
      sessions: normalizedSessions,
      studentScheduleRules: normalizedRules,
    };
  } catch (e) {
    console.error("Restore persisted data failed", e);
    return null;
  }
}

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem("rollcall-theme");
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
  } catch {
    return "light";
  }
}

export default function App() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => getInitialTheme());
  const isDark = theme === 'dark';
  const restoredData = useMemo(() => restorePersistedData(), []);
  
  useEffect(() => {
    try {
      localStorage.setItem("rollcall-theme", theme);
    } catch (e) {
      console.error("Save theme failed", e);
    }
  }, [theme]);

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const nextTab = restoredData?.activeTab;

    if (
      nextTab === "today" ||
      nextTab === "month" ||
      nextTab === "students" ||
      nextTab === "data"
    ) {
      return nextTab;
    }

    return "today";
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const nextDate = restoredData?.selectedDate;

    if (isValidDateISO(nextDate)) {
      return nextDate;
    }

    return todayISO();
  });

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [sessions, setSessions] = useState<Session[]>(() => {
    if (restoredData) {
      return restoredData.sessions;
    }

    return buildSeedSessions();
  });

  const [globalEvents, setGlobalEvents] = useState<GlobalEvent[]>(() => {
    if (restoredData?.globalEvents) {
      return restoredData.globalEvents;
    }

    return [];
  });

  const [students, setStudents] = useState<StudentProfile[]>(() => {
    if (restoredData) {
      return restoredData.students;
    }

    return studentProfilesSeed;
  });
  const [isStudentsBackendAvailable, setIsStudentsBackendAvailable] = useState(false);
  const [isScheduleRulesBackendAvailable, setIsScheduleRulesBackendAvailable] = useState(false);
  const [isSessionsBackendAvailable, setIsSessionsBackendAvailable] = useState(false);
  const [isGlobalEventsBackendAvailable, setIsGlobalEventsBackendAvailable] = useState(false);

  const [studentScheduleRules, setStudentScheduleRules] = useState<StudentScheduleRule[]>(() => {
    if (restoredData) {
      return restoredData.studentScheduleRules;
    }

    return studentScheduleRulesSeed;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadGlobalEvents() {
      try {
        const backendGlobalEvents = await fetchGlobalEvents();
        if (!cancelled) {
          setGlobalEvents(backendGlobalEvents);
          setIsGlobalEventsBackendAvailable(true);
        }
      } catch (error) {
        if (!cancelled) {
          setIsGlobalEventsBackendAvailable(false);
        }
        console.warn("Backend global events unavailable, using local data", error);
      }
    }

    fetchStudents()
      .then(async (backendStudents) => {
        if (cancelled) return;

        setIsStudentsBackendAvailable(true);
        setStudents(backendStudents);

        if (backendStudents.length === 0) {
          setStudentScheduleRules([]);
          setIsScheduleRulesBackendAvailable(true);
        } else {
          try {
            const backendRulesByStudent = await Promise.all(
              backendStudents.map((student) => fetchScheduleRules(student.id))
            );
            if (!cancelled) {
              setStudentScheduleRules(backendRulesByStudent.flat());
              setIsScheduleRulesBackendAvailable(true);
            }
          } catch (error) {
            if (!cancelled) {
              setIsScheduleRulesBackendAvailable(false);
            }
            console.warn("Backend schedule rules unavailable, using local data", error);
          }
        }

        try {
          const backendSessions = await fetchSessions();
          if (!cancelled) {
            setSessions(backendSessions);
            setIsSessionsBackendAvailable(true);
          }
        } catch (error) {
          if (!cancelled) {
            setIsSessionsBackendAvailable(false);
          }
          console.warn("Backend sessions unavailable, using local data", error);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setIsStudentsBackendAvailable(false);
          setIsScheduleRulesBackendAvailable(false);
          setIsSessionsBackendAvailable(false);
        }
        console.warn("Backend students unavailable, using local data", error);
      })
      .finally(() => {
        void loadGlobalEvents();
      });

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    try {
      const data = {
        version: 1,
        sessions,
        selectedDate,
        activeTab,
        globalEvents,
        students,
        studentScheduleRules,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Save app state failed", e);
    }
  }, [sessions, selectedDate, activeTab, globalEvents, students, studentScheduleRules]);

  const [toast, setToast] = useState<string>("");
  
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const tabs: TabDef[] = useMemo(
    () => [
      {
        key: "today",
        label: "今日",
        icon: (active) => <IconToday className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
      {
        key: "month",
        label: "月份",
        icon: (active) => <IconMonth className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
      {
        key: "students",
        label: "學生",
        icon: (active) => <IconUsers className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
      {
        key: "data",
        label: "數據",
        icon: (active) => <IconFile className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
    ],
    []
  );

  return (
    <ThemeContext.Provider value={isDark}>
      <div className={`min-h-screen font-sans transition-colors ${pageBackgroundClass(isDark)}`}>
        {toast ? <Toast text={toast} /> : null}

        <div className="pb-28">
          {activeTab === "today" ? (
            <TodayPage
              setTheme={setTheme}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              now={now}
              students={students}
              sessions={sessions}
              setSessions={setSessions}
              isSessionsBackendAvailable={isSessionsBackendAvailable}
              isGlobalEventsBackendAvailable={isGlobalEventsBackendAvailable}
              globalEvents={globalEvents}
              setGlobalEvents={setGlobalEvents}
              setToast={setToast}
            />
          ) : activeTab === "month" ? (
            <MonthPage
              setTheme={setTheme}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              students={students}
              sessions={sessions}
              setSessions={setSessions}
              isSessionsBackendAvailable={isSessionsBackendAvailable}
              isGlobalEventsBackendAvailable={isGlobalEventsBackendAvailable}
              globalEvents={globalEvents}
              setGlobalEvents={setGlobalEvents}
              setToast={setToast}
            />
          ) : activeTab === "students" ? (
            <StudentsPage
              selectedDate={selectedDate}
              students={students}
              setStudents={setStudents}
              isStudentsBackendAvailable={isStudentsBackendAvailable}
              isScheduleRulesBackendAvailable={isScheduleRulesBackendAvailable}
              isSessionsBackendAvailable={isSessionsBackendAvailable}
              studentScheduleRules={studentScheduleRules}
              setStudentScheduleRules={setStudentScheduleRules}
              sessions={sessions}
              setSessions={setSessions}
              setToast={setToast}
            />
          ) : activeTab === "data" ? (
            <DataPage
              setTheme={setTheme}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              students={students}
              studentScheduleRules={studentScheduleRules}
              sessions={sessions}
              globalEvents={globalEvents}
              setToast={setToast}
            />
          ) : null}
        </div>

        <BottomTabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      </div>
    </ThemeContext.Provider>
  );
}
