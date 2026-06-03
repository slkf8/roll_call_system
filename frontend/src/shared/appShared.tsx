import React, { useEffect, useRef, useState } from "react";

// --- Type Definitions ---

export type Status = "pending" | "present" | "absent" | "cancelled";

export type Reason = { id: number; name: string; code: string };

export type Student = { id: number; name: string };

export type ClosureReason =
  | "病假"
  | "事假"
  | "年假"
  | "家庭事務"
  | "喪假"
  | "進修／考試"
  | "惡劣天氣"
  | "其他";

export const closureReasonsSeed: ClosureReason[] = [
  "病假",
  "事假",
  "年假",
  "家庭事務",
  "喪假",
  "進修／考試",
  "惡劣天氣",
  "其他",
];

export type MaterialsReasonCode = 1 | 2 | 3 | 4 | 5 | 6;

export type Session = {
  id: number;
  studentId?: number;
  student: Student;
  dateISO: string; // YYYY-MM-DD
  start: string; // HH:MM
  durationMin: number;
  status: Status;
  reason?: Reason;
  note?: string;
  kind: "regular" | "makeup" | "extra";
  makeupOfDateISO?: string;
  makeupOfSessionId?: number;
  // Materials service ("教材"): only meaningful on absent sessions. Normalized
  // state is always a stable boolean + (null | 1–6), never undefined.
  materialsProvided: boolean;
  materialsReasonCode: MaterialsReasonCode | null;
};

export type GlobalEvent = {
  id: number;
  dateISO: string;
  mode: "allDay" | "timeRange";
  start?: string; // HH:MM
  end?: string;   // HH:MM
  label: "停課" | "假期";
  leaveReason?: ClosureReason;
  note?: string;
};

export type TabKey = "today" | "month" | "students" | "data";

export type TabDef = {
  key: TabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

export type StudentProfile = {
  id: number;
  name: string;
  birthday: string; // YYYY-MM-DD
  school: string;
  status: "active" | "scheduled_deactivation" | "inactive";
  deactivateMode?: "immediate" | "scheduled";
  deactivateOn?: string; // YYYY-MM-DD
};

export type StudentScheduleRule = {
  id: number;
  studentId: number;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start: string; // HH:MM
  durationMin: number;
  isActive: boolean;
};

// --- Data Seeds ---

export const reasonsSeed: Reason[] = [
  { id: 1, name: "生病", code: "SICK" },
  { id: 2, name: "家事", code: "FAM" },
  { id: 3, name: "交通", code: "TRAF" },
  { id: 4, name: "未通知", code: "NO" },
  { id: 5, name: "考試/活動", code: "EXAM" },
  { id: 6, name: "天氣", code: "WEA" },
];

// 白名單：課次卡片缺席 badge 只附帶預設缺席原因，排除歷史/自訂字串。
const SESSION_CARD_PRESET_REASON_NAMES = new Set(
  reasonsSeed.map((r) => r.name),
);

// --- Materials service (教材) ---

export type MaterialsReasonOption = { code: MaterialsReasonCode; label: string };

export const materialsReasonOptions: MaterialsReasonOption[] = [
  { code: 1, label: "政府措施" },
  { code: 2, label: "活動／考試" },
  { code: 3, label: "停課／天氣" },
  { code: 4, label: "生病" },
  { code: 5, label: "親屬死亡" },
  { code: 6, label: "其他" },
];

export const REASON6_PER_SCHOOL_YEAR_LIMIT = 3;

export function materialsReasonLabel(code: MaterialsReasonCode): string {
  return materialsReasonOptions.find((o) => o.code === code)?.label ?? "";
}

// "教材 · 4 生病"
export function formatMaterialsBadge(code: MaterialsReasonCode): string {
  return `教材 · ${code} ${materialsReasonLabel(code)}`;
}

// --- School year (學年) helpers: Sep 1 – Aug 31 ---

export type SchoolYearRange = { startISO: string; endISO: string };

export function computeDefaultSchoolYear(dateISO: string): SchoolYearRange {
  const d = parseISO(dateISO);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based
  // Sep (8) onwards belongs to year..year+1; Jan–Aug belongs to year-1..year.
  const startYear = month >= 8 ? year : year - 1;
  return {
    startISO: `${startYear}-09-01`,
    endISO: `${startYear + 1}-08-31`,
  };
}

export function isWithinSchoolYear(dateISO: string, range: SchoolYearRange): boolean {
  return dateISO >= range.startISO && dateISO <= range.endISO;
}

// Apply a manual override only when the date falls inside it; otherwise fall
// back to the default Sep–Aug school year for that date.
export function resolveSchoolYearRange(
  dateISO: string,
  override: SchoolYearRange | null
): SchoolYearRange {
  if (override && isWithinSchoolYear(dateISO, override)) {
    return override;
  }
  return computeDefaultSchoolYear(dateISO);
}

// Defensive reason-6 count: only absent + materials provided + code 6 + in range.
export function countReason6ForStudent(
  sessions: Session[],
  studentId: number,
  range: SchoolYearRange
): number {
  return sessions.filter(
    (s) =>
      s.studentId === studentId &&
      s.status === "absent" &&
      s.materialsProvided === true &&
      s.materialsReasonCode === 6 &&
      isWithinSchoolYear(s.dateISO, range)
  ).length;
}

// --- Materials reason string (教材原因欄) ---

// Strict "<day>-<code>" pairs joined by ";": day 1-31 (no leading zero),
// code 1-6, no spaces. Mirrors the backend MATERIALS_REASON_PATTERN exactly.
export const MATERIALS_REASON_MAX_LEN = 1024;
const MATERIALS_REASON_PATTERN =
  /^(?:[1-9]|[12]\d|3[01])-[1-6](?:;(?:[1-9]|[12]\d|3[01])-[1-6])*$/;

// Pre-flight validator shared by backend export + xlsx-populate fallback.
// Empty string is NOT valid (skip-write is decided separately by the caller).
export function isValidMaterialsReasonString(value: string): boolean {
  return value.length <= MATERIALS_REASON_MAX_LEN && MATERIALS_REASON_PATTERN.test(value);
}

// Build the materials reason cell value for one student within a target month.
// Only absent + provided + code 1-6 sessions in range; day not zero-padded;
// sorted by dateISO then start; same-day duplicates kept; ";"-joined; no spaces.
// Returns "" when there is no valid materials record.
export function buildMaterialsReasonString(
  studentSessions: Session[],
  monthStartISO: string,
  monthEndISO: string
): string {
  return studentSessions
    .filter(
      (s) =>
        s.dateISO >= monthStartISO &&
        s.dateISO <= monthEndISO &&
        s.status === "absent" &&
        s.materialsProvided === true &&
        s.materialsReasonCode != null &&
        s.materialsReasonCode >= 1 &&
        s.materialsReasonCode <= 6
    )
    .slice()
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.start.localeCompare(b.start))
    .map((s) => `${parseInt(s.dateISO.slice(8, 10), 10)}-${s.materialsReasonCode}`)
    .join(";");
}

// Replace a saved session by id (or append when new), so the reason-6 count is
// computed from the effective post-save sessions — never "current + 1".
export function applySessionToList(list: Session[], saved: Session): Session[] {
  const exists = list.some((s) => s.id === saved.id);
  return exists ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved];
}

export const studentsSeed: Student[] = [
  { id: 1, name: "陳小明" },
  { id: 2, name: "林雅婷" },
  { id: 3, name: "王大文" },
  { id: 4, name: "張小美" },
];

export const studentProfilesSeed: StudentProfile[] = [
  {
    id: 1001,
    name: "陳小明",
    birthday: "2012-03-08",
    school: "培正中學",
    status: "active",
  },
  {
    id: 1002,
    name: "李小欣",
    birthday: "2011-11-21",
    school: "聖羅撒女子中學",
    status: "scheduled_deactivation",
    deactivateMode: "scheduled",
    deactivateOn: "2026-05-01",
  },
  {
    id: 1003,
    name: "王家朗",
    birthday: "2012-03-08",
    school: "澳門坊眾學校",
    status: "inactive",
    deactivateMode: "immediate",
  },
  {
    id: 1004,
    name: "林雅婷",
    birthday: "2012-06-14",
    school: "培道中學",
    status: "active",
  },
  {
    id: 1005,
    name: "王大文",
    birthday: "2011-09-03",
    school: "濠江中學",
    status: "active",
  },
  {
    id: 1006,
    name: "張小美",
    birthday: "2012-12-19",
    school: "嘉諾撒聖心中學",
    status: "active",
  },
];

export const studentScheduleRulesSeed: StudentScheduleRule[] = [];

export const STORAGE_KEY = "attendance_v1_data";
export const ThemeContext = React.createContext(false); // isDark context

// --- Helper Functions ---

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISO(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function formatZHDate(dateISO: string) {
  const d = parseISO(dateISO);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（週${wd}）`;
}

export function addDaysISO(dateISO: string, delta: number) {
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function addMinutes(hhmm: string, mins: number) {
  const t = timeToMinutes(hhmm) + mins;
  const hh = Math.floor((t % (24 * 60)) / 60);
  const mm = (t % (24 * 60)) % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

export function endTime(s: Session) {
  return addMinutes(s.start, s.durationMin);
}

export function formatDurationMin(mins: number) {
  if (mins === 60) return "1小時課程";
  if (mins % 60 === 0) return `${mins / 60}小時課程`;
  if (mins > 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}小時${m}分鐘課程`;
  }
  return `${mins}分鐘課程`;
}

export function removeSessionById(list: Session[], id: number) {
  return list.filter((s) => s.id !== id);
}

export function roundToNearest15Min() {
  const now = new Date();
  const m = now.getMinutes();
  const rounded = Math.round(m / 15) * 15;
  now.setMinutes(rounded);
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export function getNextSessionId(sessions: Session[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

export function getSessionStudentName(session: Pick<Session, "student"> | null | undefined) {
  return session?.student?.name?.trim() || "未關聯學生";
}

export function checkOverlap(
  a: { start: string; durationMin: number },
  b: { start: string; durationMin: number }
) {
  const startA = timeToMinutes(a.start);
  const endA = startA + a.durationMin;
  const startB = timeToMinutes(b.start);
  const endB = startB + b.durationMin;
  return startA < endB && startB < endA;
}

export function formatConflictSummary(conflicts: Session[]) {
  if (conflicts.length === 0) return "";
  const sorted = [...conflicts].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const names = sorted.slice(0, 2).map(c => `「${getSessionStudentName(c)}」`);
  if (sorted.length > 2) {
    return `⚠️ 與${names.join("、")}等 ${sorted.length} 堂衝突`;
  }
  return `⚠️ 與${names.join("、")}衝突`;
}

export function isSessionCovered(s: Session, g: GlobalEvent | null) {
  if (!g) return false;
  if (g.mode === "allDay") return true;
  if (g.mode === "timeRange" && g.start && g.end) {
    const gStart = timeToMinutes(g.start);
    const gEnd = timeToMinutes(g.end);
    const sStart = timeToMinutes(s.start);
    const sEnd = sStart + s.durationMin;
    return Math.max(gStart, sStart) < Math.min(gEnd, sEnd);
  }
  return false;
}

export function getEffectiveStatus(s: Session, g: GlobalEvent | null): Status {
  if (isSessionCovered(s, g)) return "cancelled";
  return s.status;
}

export function getConflictCandidates(
  allSessions: Session[],
  targetDate: string,
  globalEvents: GlobalEvent[]
) {
  const targetGlobal = globalEvents.find(e => e.dateISO === targetDate) || null;
  return allSessions.filter(s => 
    s.dateISO === targetDate && 
    s.status !== 'cancelled' && 
    !isSessionCovered(s, targetGlobal)
  );
}

// --- Icons (Embedded SVGs) ---

export function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3v2M16 3v2M4.5 8.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6.5 5h11A3.5 3.5 0 0 1 21 8.5v10A3.5 3.5 0 0 1 17.5 22h-11A3.5 3.5 0 0 1 3 18.5v-10A3.5 3.5 0 0 1 6.5 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFile({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18 9 12l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconDots({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconToday({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMonth({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7 7h10M7 11h6M7 15h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 21v-1a3.5 3.5 0 0 0-2.4-3.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 4.2a4 4 0 0 1 0 7.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMore({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWarning({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBan({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM4.93 4.93l14.14 14.14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUndo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 14L4 9l5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// --- UI Components ---

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "muted" | "purple";
  className?: string;
}) {
  const isDark = React.useContext(ThemeContext);
  
  const cls =
    tone === "success"
      ? (isDark ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
      : tone === "danger"
      ? (isDark ? 'bg-rose-900/20 text-rose-400 border-rose-900/50' : 'bg-rose-50 text-rose-700 border-rose-200')
      : tone === "muted"
      ? (isDark ? 'bg-[#1C1C1E] text-[#8E8E93] border-white/10' : 'bg-[#EFEFF4] text-slate-500 border-[#E5E5EA]')
      : tone === "purple"
      ? (isDark ? 'bg-purple-900/20 text-purple-400 border-purple-900/50' : 'bg-purple-50 text-purple-700 border-purple-200')
      : (isDark ? 'bg-[#2C2C2E] text-[#D1D1D6] border-white/10' : 'bg-slate-50 text-slate-700 border-slate-200');

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls} ${className}`}>
      {children}
    </span>
  );
}

export function IconButton({
  tone,
  onClick,
  children,
  ariaLabel,
  disabled, 
}: {
  tone: "green" | "red" | "blue" | "gray"; 
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const isDark = React.useContext(ThemeContext);
  
  const cls =
    tone === "green"
      ? (isDark ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400 active:bg-emerald-900/40' : 'bg-emerald-50 border-emerald-200 text-emerald-700 active:bg-emerald-100')
      : tone === "red"
      ? (isDark ? 'bg-rose-900/20 border-rose-900/50 text-rose-400 active:bg-rose-900/40' : 'bg-rose-50 border-rose-200 text-rose-700 active:bg-rose-100')
      : tone === "gray"
      ? (isDark ? 'bg-[#2C2C2E] border-white/10 text-[#D1D1D6] active:bg-[#3A3A3C]' : 'bg-slate-50 border-slate-200 text-slate-700 active:bg-slate-100')
      : (isDark ? 'bg-[#2C2C2E] border-white/10 text-[#F2F2F7] active:bg-[#3A3A3C]' : 'bg-[#EAF2FF] border-[#D6E7FF] text-[#2563EB] active:bg-[#DDEBFF]');

  const stateCls = disabled
    ? "opacity-40 cursor-not-allowed" 
    : "active:scale-[0.98]";

  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`h-11 w-11 rounded-2xl border transition flex items-center justify-center ${stateCls} ${cls}`}
    >
      {children}
    </button>
  );
}

export function Toast({ text }: { text: string }) {
  const isDark = React.useContext(ThemeContext);
  return (
    <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2">
      <div className={`rounded-2xl px-4 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${
        isDark ? 'bg-[#2C2C2E] text-[#F2F2F7] ring-1 ring-white/10' : 'bg-slate-900 text-white'
      }`}>
        {text}
      </div>
    </div>
  );
}

export function Menu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const isDark = React.useContext(ThemeContext);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }

    function onDocDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onDocDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={wrapRef} className="mt-3 flex justify-end relative z-10">
      <div className={`w-full max-w-sm rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.10)] ring-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right ${
        isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-white ring-black/5'
      }`}>
        {items.map((it, idx) => (
          <button
            key={idx}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={`w-full px-4 py-3 text-left text-sm transition ${
              isDark 
                ? `hover:bg-[#2C2C2E] ${it.danger ? 'text-rose-400' : 'text-[#F2F2F7]'}`
                : `hover:bg-[#F2F2F7] ${it.danger ? 'text-rose-700' : 'text-slate-700'}`
            }`}
          >
            {it.label}
          </button>
        ))}
        <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-[#E5E5EA]'}`} />
        <button
          onClick={onClose}
          className={`w-full px-4 py-3 text-left text-sm font-semibold transition ${
            isDark ? 'text-[#F2F2F7] hover:bg-[#2C2C2E]' : 'text-[#007AFF] hover:bg-[#F2F2F7]'
          }`}
        >
          收起
        </button>
      </div>
    </div>
  );
}

export function IOSSheet({
  open,
  title,
  subtitle,
  leftAction,
  rightAction,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  leftAction?: { label: string; onClick: () => void };
  rightAction?: { label: string; onClick: () => void; emphasize?: boolean; danger?: boolean };
  onClose: () => void;
  children: React.ReactNode;
}) {
  const isDark = React.useContext(ThemeContext);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-5 pb-6">
        <div className={`rounded-[28px] shadow-2xl ring-1 overflow-hidden animate-in slide-in-from-bottom duration-300 ${
          isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-white ring-black/5'
        }`}>
          <div className="flex justify-center pt-2">
            <div className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-[#3A3A3C]' : 'bg-slate-200'}`} />
          </div>

          <div className={`px-5 pt-3 pb-4 border-b ${isDark ? 'border-white/10' : 'border-[#E5E5EA]'}`}>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={leftAction ? leftAction.onClick : onClose}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                  isDark ? 'text-[#F2F2F7] hover:bg-[#2C2C2E]' : 'text-[#007AFF] hover:bg-[#F2F2F7]'
                }`}
              >
                {leftAction ? leftAction.label : "取消"}
              </button>

              <div className="text-center">
                <div className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</div>
                {subtitle ? <div className={`mt-0.5 text-xs ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>{subtitle}</div> : null}
              </div>

              {rightAction ? (
                <button
                  onClick={rightAction.onClick}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    isDark 
                      ? `hover:bg-[#2C2C2E] ${rightAction.danger ? 'text-rose-400' : 'text-[#F2F2F7]'}`
                      : `hover:bg-[#F2F2F7] ${rightAction.danger ? 'text-rose-700' : rightAction.emphasize ? 'text-[#007AFF]' : 'text-slate-600'}`
                  }`}
                >
                  {rightAction.label}
                </button>
              ) : (
                <div className="w-[64px]" />
              )}
            </div>
          </div>

          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const isDark = React.useContext(ThemeContext);
  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 ring-1 ${
      isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-[#F2F2F7] ring-[#E5E5EA]'
    }`}>
      <div className={`text-sm font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-slate-600'}`}>{label}</div>
      <div className="min-w-[140px] text-right">{children}</div>
    </div>
  );
}

export function DurationInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const isDark = React.useContext(ThemeContext);
  const MAX_DURATION = 120; 

  return (
    <div className={`inline-flex items-center rounded-2xl ring-1 overflow-hidden ${
      isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-white ring-[#E5E5EA]'
    }`}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className={`px-3 py-2 text-base font-bold transition-colors ${
          isDark ? 'text-[#F2F2F7] hover:bg-[#2C2C2E] active:bg-[#3A3A3C]' : 'text-[#007AFF] hover:bg-[#F2F2F7] active:bg-[#E5E5EA]'
        }`}
        aria-label="減少"
      >
        −
      </button>
      <div className="flex items-center justify-center min-w-[80px]">
        <input
          type="number"
          value={value === 0 ? "" : value}
          onChange={(e) => {
             let v = parseInt(e.target.value, 10);
             if (isNaN(v)) v = 0;
             if (v > MAX_DURATION) v = MAX_DURATION;
             onChange(v);
          }}
          onBlur={() => { 
            let v = value;
            if (v < 1) v = 1;
            if (v > MAX_DURATION) v = MAX_DURATION;
            if (v !== value) onChange(v);
          }}
          className={`w-12 py-2 text-right text-sm font-semibold focus:outline-none p-0 border-none bg-transparent ${
            isDark ? 'text-[#F2F2F7] focus:bg-[#2C2C2E]' : 'text-slate-800 focus:bg-[#F2F2F7]'
          }`}
        />
        <span className={`pl-1 py-2 text-sm font-semibold pointer-events-none ${isDark ? 'text-[#F2F2F7]' : 'text-slate-800'}`}>分</span>
      </div>
      <button
        onClick={() => onChange(Math.min(MAX_DURATION, value + 1))}
        className={`px-3 py-2 text-base font-bold transition-colors ${
          isDark ? 'text-[#F2F2F7] hover:bg-[#2C2C2E] active:bg-[#3A3A3C]' : 'text-[#007AFF] hover:bg-[#F2F2F7] active:bg-[#E5E5EA]'
        }`}
        aria-label="增加"
      >
        +
      </button>
    </div>
  );
}

export function SessionCard({
  s,
  effectiveStatus,
  hasConflict,
  globalAlert, 
  onPresent,
  onAbsent,
  onReset, 
  onOpenMenu,
}: {
  s: Session;
  effectiveStatus: Status; 
  hasConflict?: boolean;
  globalAlert?: string;
  onPresent: () => void;
  onAbsent: () => void;
  onReset: () => void;
  onOpenMenu: () => void;
}) {
  const isDark = React.useContext(ThemeContext);

  const statusPill =
    effectiveStatus === "pending" ? (
      <Pill tone="muted" className="gap-1">
        <IconClock className="h-4 w-4" /> 待確認
      </Pill>
    ) : effectiveStatus === "present" ? (
      <Pill tone="success">已到</Pill>
    ) : effectiveStatus === "absent" ? (
      <Pill tone="danger">
        缺席
        {s.reason && SESSION_CARD_PRESET_REASON_NAMES.has(s.reason.name)
          ? ` · ${s.reason.name}`
          : ""}
      </Pill>
    ) : (
      <Pill tone="muted">停課</Pill>
    );

  const isBlocked = !!globalAlert;

  return (
    <div className={`rounded-[24px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-6 py-5 ${
      isDark ? 'bg-[#1C1C1E] ring-1 ring-white/10' : 'bg-white ring-1 ring-[#E5E5EA]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className={`text-[34px] leading-none font-extrabold tracking-tight w-[92px] tabular-nums ${
            isDark ? 'text-[#F2F2F7]' : 'text-slate-800'
          }`}>
            {s.start}
          </div>

          <div>
            {s.kind === "makeup" && s.makeupOfDateISO ? (
              <Pill tone="purple" className="mb-2">
                補課（原 {s.makeupOfDateISO}）
              </Pill>
            ) : null}
            <div className={`text-[20px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{getSessionStudentName(s)}</div>
            <div className={`mt-1 text-sm ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>
              {formatDurationMin(s.durationMin)}
              <span className={isDark ? 'text-[#3A3A3C]' : 'text-slate-300'}> · </span>
              {s.start}–{endTime(s)}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            {globalAlert && (
              <Pill tone="danger" className={isDark ? 'gap-1' : 'gap-1 bg-amber-50 text-amber-700 border-amber-200'}>
                <IconWarning className="h-3.5 w-3.5" />
                {globalAlert}
              </Pill>
            )}
            {hasConflict && !globalAlert && s.status !== "cancelled" && (
              <Pill tone="danger" className={isDark ? 'gap-1' : 'gap-1 bg-amber-50 text-amber-700 border-amber-200'}>
                <IconWarning className="h-3.5 w-3.5" />
                衝突
              </Pill>
            )}
            {statusPill}
          </div>

          <div className="flex items-center gap-3">
            <IconButton tone="green" ariaLabel="記錄已到" onClick={onPresent} disabled={isBlocked}>
              <IconCheck className="h-6 w-6" />
            </IconButton>
            <IconButton tone="red" ariaLabel="記錄缺席" onClick={onAbsent} disabled={isBlocked}>
              <IconX className="h-6 w-6" />
            </IconButton>
            {effectiveStatus !== "pending" && (
              <IconButton tone="gray" ariaLabel="撤銷" onClick={onReset} disabled={isBlocked}>
                <IconUndo className="h-5 w-5" />
              </IconButton>
            )}
            <IconButton tone="blue" ariaLabel="更多" onClick={onOpenMenu}>
              <IconDots className="h-6 w-6" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export type AbsenceSubmitValues = {
  reason: Reason;
  note?: string;
  materialsProvided: boolean;
  materialsReasonCode: MaterialsReasonCode | null;
};

// Minimal shared body for the 請假 / 缺席 sheet. Owns the form fields and
// validation only; the host page keeps its own save handler / API patch /
// local fallback / state updates and reacts via onSubmit. Remount (via a key
// keyed on the target session) to reset between sessions.
export function AbsenceSheetBody({
  initialReasonName = null,
  initialNote = "",
  initialMaterialsProvided = false,
  initialMaterialsReasonCode = null,
  onSubmit,
  setToast,
}: {
  initialReasonName?: string | null;
  initialNote?: string;
  initialMaterialsProvided?: boolean;
  initialMaterialsReasonCode?: MaterialsReasonCode | null;
  onSubmit: (values: AbsenceSubmitValues) => void;
  setToast: (text: string) => void;
}) {
  const isDark = React.useContext(ThemeContext);
  const [note, setNote] = useState(initialNote);
  // Backend reasons round-trip as a string (name) with id 0, so match the
  // preset chip by name — matching by id would never pre-select on reopen.
  const [reasonId, setReasonId] = useState<number | null>(
    () => reasonsSeed.find((reason) => reason.name === initialReasonName)?.id ?? null
  );
  const [materialsProvided, setMaterialsProvided] = useState(initialMaterialsProvided);
  const [materialsReasonCode, setMaterialsReasonCode] =
    useState<MaterialsReasonCode | null>(initialMaterialsReasonCode);

  function handleSubmit() {
    const reason = reasonsSeed.find((r) => r.id === reasonId);
    if (!reason) {
      setToast("請先選擇學生的缺席原因");
      return;
    }
    if (materialsProvided && materialsReasonCode == null) {
      setToast("請選擇教材服務的申報原因");
      return;
    }
    onSubmit({
      reason,
      note: note.trim() ? note : undefined,
      materialsProvided,
      materialsReasonCode: materialsProvided ? materialsReasonCode : null,
    });
  }

  const chipBase =
    "rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.99]";
  const chipIdle = isDark
    ? "bg-[#1C1C1E] border-white/10 text-[#D1D1D6] hover:bg-[#2C2C2E]"
    : "bg-[#F2F2F7] border-[#E5E5EA] text-slate-700 hover:bg-[#EDEDF3]";
  const chipActive = isDark
    ? "bg-emerald-900/20 border-emerald-900/50 text-emerald-400"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";

  return (
    <div className="space-y-4">
      <div>
        <div className={`text-[12px] font-semibold ${isDark ? "text-[#8E8E93]" : "text-slate-500"}`}>
          （可選）備註
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：已通知家長 / 交通延誤..."
          className={`mt-2 w-full min-h-[92px] rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            isDark
              ? "bg-[#1C1C1E] border-white/10 text-[#F2F2F7] placeholder:text-[#8E8E93] focus:ring-white/20"
              : "bg-white border-[#E5E5EA] text-slate-800 placeholder:text-slate-400 focus:ring-[#C7DAFF]"
          }`}
        />
      </div>

      <div>
        <div className={`text-[12px] font-semibold ${isDark ? "text-[#8E8E93]" : "text-slate-500"}`}>
          缺席原因
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasonsSeed.map((r) => {
            const active = reasonId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => setReasonId(r.id)}
                className={`${chipBase} ${active ? chipActive : chipIdle}`}
              >
                {r.name}
                <span className={`ml-2 text-xs font-medium ${isDark ? "text-[#8E8E93]" : "text-slate-400"}`}>
                  {r.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className={`text-[12px] font-semibold ${isDark ? "text-[#8E8E93]" : "text-slate-500"}`}>
          教材服務（可選）
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={materialsProvided}
            onClick={() => setMaterialsProvided((v) => !v)}
            className={`${chipBase} ${materialsProvided ? chipActive : chipIdle}`}
          >
            教材
          </button>
        </div>

        {materialsProvided ? (
          <>
            <div className={`mt-3 text-[12px] font-semibold ${isDark ? "text-[#8E8E93]" : "text-slate-500"}`}>
              教材申報原因
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {materialsReasonOptions.map((opt) => {
                const active = materialsReasonCode === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMaterialsReasonCode(opt.code)}
                    className={`${chipBase} ${active ? chipActive : chipIdle}`}
                  >
                    {opt.code} {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className={`w-full rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.99] ${
          isDark
            ? "bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90"
            : "bg-[#007AFF] text-white hover:bg-[#0A6CFF]"
        }`}
      >
        完成缺席紀錄
      </button>
    </div>
  );
}

export function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
}) {
  const isDark = React.useContext(ThemeContext);
  return (
    <div className={`flex p-0.5 rounded-xl ring-1 ${isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-[#E5E5EA] ring-black/5'}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              active 
                ? (isDark ? "bg-[#2C2C2E] text-white shadow-sm ring-1 ring-white/10" : "bg-white text-slate-900 shadow-sm ring-1 ring-black/5") 
                : (isDark ? "text-[#8E8E93] hover:text-[#D1D1D6]" : "text-slate-500 hover:text-slate-700")
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function HeaderBar({
  title,
  icon,
  right,
}: {
  title: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
}) {
  const isDark = React.useContext(ThemeContext);
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 flex items-center justify-center ${
          isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#F2F2F7]' : 'bg-white ring-[#E5E5EA] text-slate-700'
        }`}>
          {icon}
        </div>
        <div className={`text-[28px] leading-tight font-extrabold ${isDark ? 'text-white' : ''}`}>{title}</div>
      </div>
      {right ? <div>{right}</div> : <div />}
    </div>
  );
}

export function ThemeToggle({
  isDark,
  interactive = false,
  onSelect,
}: {
  isDark: boolean;
  interactive?: boolean;
  onSelect?: (theme: "light" | "dark") => void;
}) {
  const baseWrap = `flex items-center p-0.5 rounded-full backdrop-blur-md transition-colors ${
    isDark
      ? "bg-[#2C2C2E]/60 ring-1 ring-white/10"
      : "bg-slate-200/60 ring-1 ring-black/5"
  }`;

  const segmentBase =
    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all";

  const lightCls = !isDark
    ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
    : "text-white/65 hover:text-white";

  const darkCls = isDark
    ? "bg-white/15 text-[#F2F2F7] shadow-sm ring-1 ring-white/10"
    : "text-slate-500 hover:text-slate-700";

  const lightContent = (
    <>
      <span className="text-[13px]">☀️</span>
      <span>淺色</span>
    </>
  );

  const darkContent = (
    <>
      <span className="text-[13px]">🌙</span>
      <span>深色</span>
    </>
  );

  if (!interactive) {
    return (
      <div className={baseWrap}>
        <div className={`${segmentBase} ${lightCls}`}>{lightContent}</div>
        <div className={`${segmentBase} ${darkCls}`}>{darkContent}</div>
      </div>
    );
  }

  return (
    <div className={baseWrap}>
      <button
        type="button"
        onClick={() => onSelect?.("light")}
        className={`${segmentBase} ${lightCls}`}
        aria-pressed={!isDark}
        aria-label="切換為淺色模式"
      >
        {lightContent}
      </button>

      <button
        type="button"
        onClick={() => onSelect?.("dark")}
        className={`${segmentBase} ${darkCls}`}
        aria-pressed={isDark}
        aria-label="切換為深色模式"
      >
        {darkContent}
      </button>
    </div>
  );
}

export function HeaderBadge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isDark = React.useContext(ThemeContext);

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        isDark ? "bg-white/10 text-slate-300" : "bg-[#E5E5EA] text-gray-600"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function pageBackgroundClass(isDark: boolean) {
  return isDark
    ? "bg-[#111214] text-[#F2F2F7]"
    : "bg-[#F2F2F7] text-slate-900";
}

export function primaryCardSurfaceClass(isDark: boolean) {
  return isDark
    ? "bg-[#1C1C1E] ring-white/10"
    : "bg-white ring-[#E5E5EA]";
}

export function secondarySurfaceClass(isDark: boolean) {
  return isDark
    ? "bg-[#2C2C2E] ring-white/10"
    : "bg-[#F2F2F7] ring-[#E5E5EA]";
}

export function mutedTextClass(isDark: boolean) {
  return isDark
    ? "text-[#8E8E93]"
    : "text-slate-500";
}

export function secondaryButtonClass(isDark: boolean) {
  return isDark
    ? "bg-[#2C2C2E] text-slate-300 ring-1 ring-white/10 active:bg-[#3A3A3C]"
    : "bg-white text-gray-700 ring-1 ring-[#E5E5EA] active:bg-gray-50";
}

export function blueEmphasisButtonClass(isDark: boolean) {
  return isDark
    ? "bg-[#1C1C1E] text-[#0A84FF] ring-1 ring-white/10 hover:bg-[#2C2C2E]"
    : "bg-[#E5F0FF] text-[#007AFF] active:bg-[#D1E3FF]";
}

export function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  const isDark = React.useContext(ThemeContext);
  return (
    <div className={`mt-6 rounded-[24px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 p-6 ${
      isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-white ring-[#E5E5EA]'
    }`}>
      <div className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</div>
      <div className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>{desc}</div>
      <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ring-1 ${
        isDark ? 'bg-[#2C2C2E] ring-white/10 text-[#D1D1D6]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
      }`}>
        這個頁面先做入口與導航結構，細節頁面之後再單獨設計（避免現在就鎖死資訊架構）。
      </div>
    </div>
  );
}

export function BottomTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabDef[];
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  const isDark = React.useContext(ThemeContext);
  const MAX_VISIBLE = 4;
  const needsMore = tabs.length > MAX_VISIBLE;

  const visibleTabs = needsMore ? tabs.slice(0, MAX_VISIBLE - 1) : tabs;
  const extraTabs = needsMore ? tabs.slice(MAX_VISIBLE - 1) : [];

  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-4xl px-5">
          <div className={`rounded-[22px] backdrop-blur-xl shadow-[0_-6px_18px_rgba(0,0,0,0.10)] ring-1 overflow-hidden ${
            isDark ? 'bg-[#111214]/80 ring-white/10' : 'bg-white/80 ring-black/5'
          }`}>
            <div className="grid grid-flow-col auto-cols-fr">
              {visibleTabs.map((t) => {
                const isActive = active === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => onSelect(t.key)}
                    className={`py-3.5 flex flex-col items-center justify-center gap-1 transition active:scale-[0.99] ${
                      isActive 
                        ? (isDark ? "text-white" : "text-[#007AFF]") 
                        : (isDark ? "text-[#8E8E93]" : "text-slate-500")
                    }`}
                    aria-label={t.label}
                  >
                    <div className="h-6 w-6">{t.icon(isActive)}</div>
                    <div className={`text-[11px] font-semibold ${isActive ? "" : ""}`}>{t.label}</div>
                  </button>
                );
              })}

              {needsMore ? (
                <button
                  onClick={() => setMoreOpen(true)}
                  className={`py-3.5 flex flex-col items-center justify-center gap-1 transition active:scale-[0.99] ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}
                  aria-label="更多"
                >
                  <div className="h-6 w-6">
                    <IconMore className="h-6 w-6" />
                  </div>
                  <div className="text-[11px] font-semibold">更多</div>
                </button>
              ) : null}
            </div>
            <div className="h-[calc(12px+env(safe-area-inset-bottom))] bg-transparent" />
          </div>
        </div>
      </div>

      <IOSSheet
        open={moreOpen}
        title="更多"
        onClose={() => setMoreOpen(false)}
        leftAction={{ label: "關閉", onClick: () => setMoreOpen(false) }}
      >
        <div className="space-y-2">
          {extraTabs.length ? (
            extraTabs.length && extraTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  onSelect(t.key);
                  setMoreOpen(false);
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 ${
                  isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#F2F2F7] hover:bg-[#2C2C2E]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-700 hover:bg-[#EDEDF3]'
                }`}
              >
                {t.label}
              </button>
            ))
          ) : (
            <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
              isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#8E8E93]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
            }`}>
              目前沒有更多功能。
            </div>
          )}
        </div>
      </IOSSheet>
    </>
  );
}
