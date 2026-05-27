import { API_BASE_URL } from "../config";
export { API_BASE_URL };

export type MonthlyStatisticsSummary = {
  teacherServiceTotal: number;
  monthlySessionCount: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  cancelledCount: number;
  scheduleRuleCount: number;
  globalEventCount: number;
};

export type MonthlyStatisticsStudentRow = {
  studentId: number;
  studentName: string;
  birthday: string;
  school: string;
  status: string;
  regularPresentCount: number;
  makeupPresentCount: number;
  extraPresentCount: number;
  totalPresentCount: number;
};

export type MonthlyStatisticsWarning = {
  code: string;
  message: string;
  count: number;
};

export type MonthlyStatistics = {
  month: string;
  from: string;
  to: string;
  summary: MonthlyStatisticsSummary;
  students: MonthlyStatisticsStudentRow[];
  warnings: MonthlyStatisticsWarning[];
};


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


function parseNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid monthly statistics response");
  }
  return value;
}


function parseString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid monthly statistics response");
  }
  return value;
}


function parseSummary(value: unknown): MonthlyStatisticsSummary {
  if (!isRecord(value)) {
    throw new Error("Invalid monthly statistics response");
  }

  return {
    teacherServiceTotal: parseNumber(value.teacherServiceTotal),
    monthlySessionCount: parseNumber(value.monthlySessionCount),
    presentCount: parseNumber(value.presentCount),
    absentCount: parseNumber(value.absentCount),
    pendingCount: parseNumber(value.pendingCount),
    cancelledCount: parseNumber(value.cancelledCount),
    scheduleRuleCount: parseNumber(value.scheduleRuleCount),
    globalEventCount: parseNumber(value.globalEventCount),
  };
}


function parseStudentRow(value: unknown): MonthlyStatisticsStudentRow {
  if (!isRecord(value)) {
    throw new Error("Invalid monthly statistics student response");
  }

  return {
    studentId: parseNumber(value.studentId),
    studentName: parseString(value.studentName),
    birthday: parseString(value.birthday),
    school: parseString(value.school),
    status: parseString(value.status),
    regularPresentCount: parseNumber(value.regularPresentCount),
    makeupPresentCount: parseNumber(value.makeupPresentCount),
    extraPresentCount: parseNumber(value.extraPresentCount),
    totalPresentCount: parseNumber(value.totalPresentCount),
  };
}


function parseWarning(value: unknown): MonthlyStatisticsWarning {
  if (!isRecord(value)) {
    throw new Error("Invalid monthly statistics warning response");
  }

  return {
    code: parseString(value.code),
    message: parseString(value.message),
    count: parseNumber(value.count),
  };
}


function parseMonthlyStatistics(value: unknown): MonthlyStatistics {
  if (!isRecord(value)) {
    throw new Error("Invalid monthly statistics response");
  }

  if (!Array.isArray(value.students)) {
    throw new Error("Invalid monthly statistics students response");
  }
  if (!Array.isArray(value.warnings)) {
    throw new Error("Invalid monthly statistics warnings response");
  }

  return {
    month: parseString(value.month),
    from: parseString(value.from),
    to: parseString(value.to),
    summary: parseSummary(value.summary),
    students: value.students.map(parseStudentRow),
    warnings: value.warnings.map(parseWarning),
  };
}


export async function fetchMonthlyStatistics(month: string): Promise<MonthlyStatistics> {
  const query = new URLSearchParams({ month });
  const response = await fetch(`${API_BASE_URL}/api/statistics/monthly?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch monthly statistics: ${response.status}`);
  }

  return parseMonthlyStatistics(await response.json());
}
