import type { Session } from "./appShared";

export type TeacherServiceRangeStats = {
  presentCount: number;
  materialsCount: number;
  teacherServiceTotal: number;
};

export type MonthRangeValidation =
  | { isValid: true; monthCount: number }
  | { isValid: false; message: string };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PRESENT_KINDS = new Set(["regular", "makeup", "extra"]);
const VALID_MATERIALS_REASON_CODES = new Set([1, 2, 3, 4, 5, 6]);

function monthIndex(month: string): number {
  const [yearText, monthText] = month.split("-");
  return Number(yearText) * 12 + Number(monthText) - 1;
}

function isValidMonthToken(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

function sessionMonth(session: Session): string {
  return session.dateISO.slice(0, 7);
}

function isPresentServiceSession(session: Session): boolean {
  return session.status === "present" && PRESENT_KINDS.has(session.kind);
}

function isMaterialsServiceSession(session: Session): boolean {
  return (
    session.status === "absent" &&
    session.materialsProvided === true &&
    VALID_MATERIALS_REASON_CODES.has(session.materialsReasonCode as number)
  );
}

export function validateMonthRange(
  startMonth: string,
  endMonth: string
): MonthRangeValidation {
  if (!isValidMonthToken(startMonth) || !isValidMonthToken(endMonth)) {
    return { isValid: false, message: "請選擇有效月份" };
  }

  const startIndex = monthIndex(startMonth);
  const endIndex = monthIndex(endMonth);
  if (startIndex > endIndex) {
    return { isValid: false, message: "開始月份不可晚於結束月份" };
  }

  const monthCount = endIndex - startIndex + 1;
  if (monthCount > 12) {
    return { isValid: false, message: "月份範圍最多 12 個月" };
  }

  return { isValid: true, monthCount };
}

export function calculateTeacherServiceStatsByMonthRange(
  sessions: Session[],
  startMonth: string,
  endMonth: string
): TeacherServiceRangeStats {
  if (!validateMonthRange(startMonth, endMonth).isValid) {
    return { presentCount: 0, materialsCount: 0, teacherServiceTotal: 0 };
  }

  let presentCount = 0;
  let materialsCount = 0;

  for (const session of sessions) {
    const month = sessionMonth(session);
    if (month < startMonth || month > endMonth) continue;

    if (isPresentServiceSession(session)) {
      presentCount += 1;
    } else if (isMaterialsServiceSession(session)) {
      materialsCount += 1;
    }
  }

  return {
    presentCount,
    materialsCount,
    teacherServiceTotal: presentCount + materialsCount,
  };
}
