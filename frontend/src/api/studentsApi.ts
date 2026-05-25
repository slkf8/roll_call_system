import type { StudentProfile } from "../shared/appShared";


export const API_BASE_URL = "http://127.0.0.1:8000";


export async function fetchStudents(): Promise<StudentProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/students`);

  if (!response.ok) {
    throw new Error(`Failed to fetch students: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid students response");
  }

  return data as StudentProfile[];
}
