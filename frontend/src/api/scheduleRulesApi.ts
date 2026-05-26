import type { StudentScheduleRule } from "../shared/appShared";


export const API_BASE_URL = "http://127.0.0.1:8000";

export type CreateScheduleRulePayload = {
  weekday: StudentScheduleRule["weekday"];
  start: string;
  durationMin?: number;
  isActive?: boolean;
};

export type UpdateScheduleRulePayload = {
  weekday?: StudentScheduleRule["weekday"];
  start?: string;
  durationMin?: number;
  isActive?: boolean;
};


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


function parseWeekday(value: unknown): StudentScheduleRule["weekday"] {
  if (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  ) {
    return value;
  }

  throw new Error("Invalid schedule rule response");
}


function parseScheduleRule(value: unknown): StudentScheduleRule {
  if (!isRecord(value)) {
    throw new Error("Invalid schedule rule response");
  }

  if (
    typeof value.id !== "number" ||
    typeof value.studentId !== "number" ||
    typeof value.start !== "string" ||
    typeof value.durationMin !== "number" ||
    typeof value.isActive !== "boolean"
  ) {
    throw new Error("Invalid schedule rule response");
  }

  return {
    id: value.id,
    studentId: value.studentId,
    weekday: parseWeekday(value.weekday),
    start: value.start,
    durationMin: value.durationMin,
    isActive: value.isActive,
  };
}


export async function fetchScheduleRules(studentId: number): Promise<StudentScheduleRule[]> {
  const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/schedule-rules`);

  if (!response.ok) {
    throw new Error(`Failed to fetch schedule rules: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid schedule rules response");
  }

  return data.map(parseScheduleRule);
}


export async function createScheduleRule(
  studentId: number,
  payload: CreateScheduleRulePayload
): Promise<StudentScheduleRule> {
  const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/schedule-rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create schedule rule: ${response.status}`);
  }

  return parseScheduleRule(await response.json());
}


export async function updateScheduleRule(
  ruleId: number,
  payload: UpdateScheduleRulePayload
): Promise<StudentScheduleRule> {
  const response = await fetch(`${API_BASE_URL}/api/schedule-rules/${ruleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update schedule rule: ${response.status}`);
  }

  return parseScheduleRule(await response.json());
}


export async function deleteScheduleRule(ruleId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/schedule-rules/${ruleId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete schedule rule: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || data.ok !== true) {
    throw new Error("Invalid delete schedule rule response");
  }
}
