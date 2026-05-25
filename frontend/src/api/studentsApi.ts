import type { StudentProfile } from "../shared/appShared";


export const API_BASE_URL = "http://127.0.0.1:8000";

export type CreateStudentPayload = {
  name: string;
  birthday?: string;
  school?: string;
  status?: StudentProfile["status"];
  deactivateMode?: StudentProfile["deactivateMode"] | null;
  deactivateOn?: string | null;
};


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


function parseStudentProfile(value: unknown): StudentProfile {
  if (!isRecord(value)) {
    throw new Error("Invalid student response");
  }

  if (typeof value.id !== "number" || typeof value.name !== "string") {
    throw new Error("Invalid student response");
  }

  if (
    value.status !== "active" &&
    value.status !== "scheduled_deactivation" &&
    value.status !== "inactive"
  ) {
    throw new Error("Invalid student response");
  }

  const deactivateMode =
    value.deactivateMode === "immediate" || value.deactivateMode === "scheduled"
      ? value.deactivateMode
      : undefined;

  return {
    id: value.id,
    name: value.name,
    birthday: typeof value.birthday === "string" ? value.birthday : "",
    school: typeof value.school === "string" ? value.school : "",
    status: value.status,
    deactivateMode,
    deactivateOn: typeof value.deactivateOn === "string" ? value.deactivateOn : undefined,
  };
}


export async function fetchStudents(): Promise<StudentProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/students`);

  if (!response.ok) {
    throw new Error(`Failed to fetch students: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid students response");
  }

  return data.map(parseStudentProfile);
}


export async function createStudent(payload: CreateStudentPayload): Promise<StudentProfile> {
  const response = await fetch(`${API_BASE_URL}/api/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create student: ${response.status}`);
  }

  return parseStudentProfile(await response.json());
}
