import type { Session, StudentProfile, StudentScheduleRule } from "./appShared";

// Shared, side-effect-free helpers for generating regular (fixed-schedule)
// sessions and the date math they rely on. Extracted verbatim from
// StudentsPage so MonthPage can reuse the exact same generation semantics —
// algorithm and field meanings are unchanged.

export type RegularSessionCandidate = {
  session: Session;
  scheduleRuleId: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getNextSessionId(list: Session[]) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function toSessionStudent(profile: { id: number; name: string }) {
  return {
    id: profile.id,
    name: profile.name,
  };
}

export function getMonthRemainingDates(anchorISO: string) {
  const [year, month, day] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month || !day) return [];

  const cursor = new Date(year, month - 1, day);
  if (Number.isNaN(cursor.getTime())) return [];

  const dates: Array<{ date: Date; dateISO: string }> = [];
  const targetMonth = cursor.getMonth();

  while (cursor.getMonth() === targetMonth) {
    dates.push({
      date: new Date(cursor),
      dateISO: formatDateISO(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function isWithinMonthRemaining(dateISO: string, anchorISO: string) {
  const [year, month, day] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month || !day) return false;

  const endOfMonth = new Date(year, month, 0);
  const endISO = formatDateISO(endOfMonth);
  const monthPrefix = `${year}-${pad2(month)}-`;

  return dateISO.startsWith(monthPrefix) && dateISO >= anchorISO && dateISO <= endISO;
}

export function getMonthStartISO(anchorISO: string) {
  const [year, month] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month) return "";
  return `${year}-${pad2(month)}-01`;
}

export function getMonthEndISO(anchorISO: string) {
  const [year, month] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month) return "";
  // Day 0 of next month = last day of this month.
  const end = new Date(year, month, 0);
  if (Number.isNaN(end.getTime())) return "";
  return formatDateISO(end);
}

export function getDatesInRange(fromISO: string, toISO: string) {
  const [fy, fm, fd] = fromISO.split("-").map((item) => Number(item));
  const [ty, tm, td] = toISO.split("-").map((item) => Number(item));
  if (!fy || !fm || !fd || !ty || !tm || !td) return [];

  const cursor = new Date(fy, fm - 1, fd);
  const stop = new Date(ty, tm - 1, td);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(stop.getTime())) return [];
  if (cursor.getTime() > stop.getTime()) return [];

  const dates: Array<{ date: Date; dateISO: string }> = [];
  while (cursor.getTime() <= stop.getTime()) {
    dates.push({
      date: new Date(cursor),
      dateISO: formatDateISO(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

// 核心生成器：以「日期列表」為輸入，dedup key =
//   `${studentId}|${dateISO}|${start}|regular`
// 單一學生「本月剩餘」與批量「自訂月內範圍」皆透過此函式產生課次，
// 避免兩套生成邏輯分叉。
export function buildRegularSessionsInDates(
  student: StudentProfile,
  activeRules: StudentScheduleRule[],
  baseSessions: Session[],
  dates: Array<{ date: Date; dateISO: string }>
) {
  const existingRegularKeys = new Set(
    baseSessions
      .filter((session) => session.kind === "regular")
      .map(
        (session) =>
          `${session.studentId ?? ""}|${session.dateISO}|${session.start}|${session.kind}`
      )
  );

  let nextId = getNextSessionId(baseSessions);
  let skippedCount = 0;
  const generatedSessions: RegularSessionCandidate[] = [];

  for (const rule of activeRules) {
    for (const target of dates) {
      if (target.date.getDay() !== rule.weekday) continue;

      const key = `${student.id}|${target.dateISO}|${rule.start}|regular`;
      if (existingRegularKeys.has(key)) {
        skippedCount++;
        continue;
      }

      existingRegularKeys.add(key);
      generatedSessions.push({
        scheduleRuleId: rule.id,
        session: {
          id: nextId,
          studentId: student.id,
          student: toSessionStudent(student),
          dateISO: target.dateISO,
          start: rule.start,
          durationMin: rule.durationMin,
          status: "pending",
          kind: "regular",
          materialsProvided: false,
          materialsReasonCode: null,
        },
      });
      nextId++;
    }
  }

  return {
    generatedSessions,
    skippedCount,
  };
}
