import type { MaterialsReasonCode, Reason, Session, Status } from "../shared/appShared";


import { API_BASE_URL } from "../config";
export { API_BASE_URL };

export type ApiSession = Session & {
  scheduleRuleId?: number;
};

export type FetchSessionsParams = {
  from?: string;
  to?: string;
  studentId?: number;
};

export type SessionCreatePayload = {
  studentId?: number | null;
  dateISO: string;
  start: string;
  durationMin?: number;
  status?: Status;
  reason?: string | null;
  note?: string | null;
  kind?: Session["kind"];
  makeupOfDateISO?: string | null;
  makeupOfSessionId?: number | null;
  scheduleRuleId?: number | null;
  materialsProvided?: boolean;
  materialsReasonCode?: MaterialsReasonCode | null;
};

export type SessionUpdatePayload = {
  studentId?: number | null;
  dateISO?: string;
  start?: string;
  durationMin?: number;
  status?: Status;
  reason?: string | null;
  note?: string | null;
  kind?: Session["kind"];
  makeupOfDateISO?: string | null;
  makeupOfSessionId?: number | null;
  scheduleRuleId?: number | null;
  materialsProvided?: boolean;
  materialsReasonCode?: MaterialsReasonCode | null;
};

export type DeleteSessionResult = {
  ok: true;
  detachedMakeupCount: number;
};

export type SessionBulkDeleteBreakdown = {
  generatedRegular: number;
  manualRegular: number;
  makeup: number;
  extra: number;
  present: number;
  absent: number;
  pending: number;
  cancelled: number;
};

export type BulkDeleteSessionsResult = {
  ok: true;
  dryRun: boolean;
  removedCount: number;
  detachedMakeupCount: number;
  breakdown: SessionBulkDeleteBreakdown;
};


function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


function parseStatus(value: unknown): Status {
  if (
    value === "pending" ||
    value === "present" ||
    value === "absent" ||
    value === "cancelled"
  ) {
    return value;
  }

  throw new Error("Invalid session response");
}


function parseKind(value: unknown): Session["kind"] {
  if (value === "regular" || value === "makeup" || value === "extra") {
    return value;
  }

  throw new Error("Invalid session response");
}


function parseMaterialsReasonCode(value: unknown): MaterialsReasonCode | null {
  if (value === null || value === undefined) return null;
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6) {
    return value;
  }
  throw new Error("Invalid session response");
}


function parseReason(value: unknown): Reason | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new Error("Invalid session response");
  }

  return {
    id: 0,
    name: value,
    code: "BACKEND_REASON",
  };
}


function parseSession(value: unknown): ApiSession {
  if (!isRecord(value)) {
    throw new Error("Invalid session response");
  }

  if (
    typeof value.id !== "number" ||
    typeof value.dateISO !== "string" ||
    typeof value.start !== "string" ||
    typeof value.durationMin !== "number"
  ) {
    throw new Error("Invalid session response");
  }

  const studentId =
    typeof value.studentId === "number" ? value.studentId : undefined;

  if (value.studentId !== null && value.studentId !== undefined && studentId === undefined) {
    throw new Error("Invalid session response");
  }

  let student = { id: 0, name: "未關聯學生" };
  if (value.student !== null) {
    if (
      !isRecord(value.student) ||
      typeof value.student.id !== "number" ||
      typeof value.student.name !== "string"
    ) {
      throw new Error("Invalid session response");
    }
    student = {
      id: value.student.id,
      name: value.student.name,
    };
  }

  const session: ApiSession = {
    id: value.id,
    studentId,
    student,
    dateISO: value.dateISO,
    start: value.start,
    durationMin: value.durationMin,
    status: parseStatus(value.status),
    reason: parseReason(value.reason),
    note: typeof value.note === "string" ? value.note : undefined,
    kind: parseKind(value.kind),
    makeupOfDateISO:
      typeof value.makeupOfDateISO === "string" ? value.makeupOfDateISO : undefined,
    makeupOfSessionId:
      typeof value.makeupOfSessionId === "number" ? value.makeupOfSessionId : undefined,
    scheduleRuleId:
      typeof value.scheduleRuleId === "number" ? value.scheduleRuleId : undefined,
    // Backward compatible: older responses without materials fields default to
    // a stable boolean + null (never undefined).
    materialsProvided: value.materialsProvided === true,
    materialsReasonCode: parseMaterialsReasonCode(value.materialsReasonCode),
  };

  if (value.note !== null && value.note !== undefined && typeof value.note !== "string") {
    throw new Error("Invalid session response");
  }
  if (
    value.makeupOfDateISO !== null &&
    value.makeupOfDateISO !== undefined &&
    typeof value.makeupOfDateISO !== "string"
  ) {
    throw new Error("Invalid session response");
  }
  if (
    value.makeupOfSessionId !== null &&
    value.makeupOfSessionId !== undefined &&
    typeof value.makeupOfSessionId !== "number"
  ) {
    throw new Error("Invalid session response");
  }
  if (
    value.scheduleRuleId !== null &&
    value.scheduleRuleId !== undefined &&
    typeof value.scheduleRuleId !== "number"
  ) {
    throw new Error("Invalid session response");
  }

  return session;
}


function buildSessionsUrl(params?: FetchSessionsParams): string {
  const query = new URLSearchParams();

  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (typeof params?.studentId === "number") {
    query.set("studentId", String(params.studentId));
  }

  const queryString = query.toString();
  return `${API_BASE_URL}/api/sessions${queryString ? `?${queryString}` : ""}`;
}


export async function fetchSessions(params?: FetchSessionsParams): Promise<ApiSession[]> {
  const response = await fetch(buildSessionsUrl(params));

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid sessions response");
  }

  return data.map(parseSession);
}


export async function createSession(payload: SessionCreatePayload): Promise<ApiSession> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  return parseSession(await response.json());
}


export async function updateSession(
  id: number,
  payload: SessionUpdatePayload
): Promise<ApiSession> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update session: ${response.status}`);
  }

  return parseSession(await response.json());
}


export async function deleteSession(id: number): Promise<DeleteSessionResult> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    data.ok !== true ||
    typeof data.detachedMakeupCount !== "number"
  ) {
    throw new Error("Invalid delete session response");
  }

  return {
    ok: true,
    detachedMakeupCount: data.detachedMakeupCount,
  };
}


const BULK_DELETE_BREAKDOWN_KEYS = [
  "generatedRegular",
  "manualRegular",
  "makeup",
  "extra",
  "present",
  "absent",
  "pending",
  "cancelled",
] as const;


function parseBulkDeleteBreakdown(value: unknown): SessionBulkDeleteBreakdown {
  if (!isRecord(value)) {
    throw new Error("Invalid bulk delete session response");
  }
  for (const key of BULK_DELETE_BREAKDOWN_KEYS) {
    if (!isNonNegativeInteger(value[key])) {
      throw new Error("Invalid bulk delete session response");
    }
  }
  return {
    generatedRegular: value.generatedRegular as number,
    manualRegular: value.manualRegular as number,
    makeup: value.makeup as number,
    extra: value.extra as number,
    present: value.present as number,
    absent: value.absent as number,
    pending: value.pending as number,
    cancelled: value.cancelled as number,
  };
}


export async function bulkDeleteSessions(
  dates: string[],
  dryRun: boolean
): Promise<BulkDeleteSessionsResult> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/bulk-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dates, dryRun }),
  });

  if (!response.ok) {
    throw new Error(`Failed to bulk delete sessions: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    data.ok !== true ||
    typeof data.dryRun !== "boolean" ||
    data.dryRun !== dryRun ||
    !isNonNegativeInteger(data.removedCount) ||
    !isNonNegativeInteger(data.detachedMakeupCount)
  ) {
    throw new Error("Invalid bulk delete session response");
  }

  const breakdown = parseBulkDeleteBreakdown(data.breakdown);

  return {
    ok: true,
    dryRun: data.dryRun,
    removedCount: data.removedCount,
    detachedMakeupCount: data.detachedMakeupCount,
    breakdown,
  };
}
