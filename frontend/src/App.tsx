import { useEffect, useMemo, useState } from "react";
import TodayPage from "./pages/TodayPage";
import MonthPage from "./pages/MonthPage";
import StudentsPage from "./pages/StudentsPage";
import type { TabKey, TabDef, Session, GlobalEvent,StudentProfile, } from "./shared/appShared";
import {
  STORAGE_KEY,
  ThemeContext,
  studentsSeed,
  studentProfilesSeed,
  todayISO,
  addDaysISO,
  BottomTabBar,
  HeaderBar,
  Toast,
  IconToday,
  IconMonth,
  IconUsers,
  IconFile,
  pageBackgroundClass,
} from "./shared/appShared";

export default function App() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    try { return localStorage.getItem('rollcall-theme') as 'light'|'dark' || 'light'; }
    catch { return 'light'; }
  });
  const isDark = theme === 'dark';
  
  useEffect(() => {
    try {
      localStorage.setItem("rollcall-theme", theme);
    } catch (e) {
      console.error("Save theme failed", e);
    }
  }, [theme]);

const [activeTab, setActiveTab] = useState<TabKey>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const nextTab = parsed.activeTab;

      if (
        nextTab === "today" ||
        nextTab === "month" ||
        nextTab === "students" ||
        nextTab === "data"
      ) {
        return nextTab;
      }
    }
  } catch (e) {
    console.error("Restore tab failed", e);
  }
  return "today";
});

const [selectedDate, setSelectedDate] = useState<string>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const nextDate = parsed.selectedDate;

      if (typeof nextDate === "string" && nextDate.trim()) {
        return nextDate;
      }
    }
  } catch (e) {
    console.error("Restore date failed", e);
  }
  return todayISO();
});

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.sessions)) return parsed.sessions;
      }
    } catch (e) { console.error("Restore sessions failed", e); }

    const d = todayISO();
    return [
      { id: 2001, student: studentsSeed[0], dateISO: d, start: "14:00", durationMin: 60, status: "pending", kind: "regular" },
      { id: 2002, student: studentsSeed[1], dateISO: d, start: "15:00", durationMin: 60, status: "pending", kind: "regular" },
      { id: 2003, student: studentsSeed[2], dateISO: d, start: "16:00", durationMin: 60, status: "pending", kind: "regular" },
      {
        id: 2004,
        student: studentsSeed[3],
        dateISO: d,
        start: "17:00",
        durationMin: 60,
        status: "pending",
        kind: "makeup",
        makeupOfDateISO: addDaysISO(d, -4),
        makeupOfSessionId: 1999,
      },
    ];
  });

const [globalEvents, setGlobalEvents] = useState<GlobalEvent[]>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.globalEvents)) return parsed.globalEvents;
    }
  } catch (e) {
    console.error("Restore global events failed", e);
  }
  return [];
});

const [students, setStudents] = useState<StudentProfile[]>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.students)) return parsed.students;
    }
  } catch (e) {
    console.error("Restore students failed", e);
  }
  return studentProfilesSeed;
});


  useEffect(() => {
    try {
      const data = {
        version: 1,
        sessions,
        selectedDate,
        activeTab,
        globalEvents,
        students,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Save app state failed", e);
    }
  }, [sessions, selectedDate, activeTab, globalEvents, students]);

  const [toast, setToast] = useState<string>("");
  
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function exportExcelStub() {
    setToast("（預覽）已觸發匯出 Excel");
  }

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
              sessions={sessions}
              setSessions={setSessions}
              globalEvents={globalEvents}
              setGlobalEvents={setGlobalEvents}
              setToast={setToast}
            />
          ) : activeTab === "month" ? (
            <MonthPage
              setTheme={setTheme}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              sessions={sessions}
              setSessions={setSessions}
              globalEvents={globalEvents}
              setGlobalEvents={setGlobalEvents}
              setToast={setToast}
            />
          ) : activeTab === "students" ? (
            <StudentsPage
              students={students}
              setStudents={setStudents}
              sessions={sessions}
              setSessions={setSessions}
              setToast={setToast}
            />
          ) : activeTab === "data" ? (
            <div className="mx-auto max-w-4xl px-5 py-8">
              <HeaderBar title="數據與匯出" icon={<IconFile className="h-6 w-6" />} />
              <div
                className={`mt-6 rounded-[24px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 p-6 ${
                  isDark ? "bg-[#1C1C1E] ring-white/10" : "bg-white ring-[#E5E5EA]"
                }`}
              >
                <div className={`text-lg font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                  匯出資料
                </div>
                <div
                  className={`mt-2 text-sm leading-relaxed ${
                    isDark ? "text-[#8E8E93]" : "text-slate-500"
                  }`}
                >
                  將所有點名與請假紀錄匯出為 Excel 檔案，以便進一步統計與存檔。
                </div>
                <div className="mt-6">
                  <button
                    onClick={exportExcelStub}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold ring-1 transition active:scale-[0.99] ${
                      isDark
                        ? "bg-emerald-900/20 text-emerald-400 ring-emerald-900/50 hover:bg-emerald-900/40"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <IconFile className="h-5 w-5" />
                    匯出 Excel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <BottomTabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />
      </div>
    </ThemeContext.Provider>
  );
}
