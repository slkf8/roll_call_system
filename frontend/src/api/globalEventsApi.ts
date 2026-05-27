import type { ClosureReason, GlobalEvent } from "../shared/appShared";
import { closureReasonsSeed } from "../shared/appShared";


import { API_BASE_URL } from "../config";
export { API_BASE_URL };

export type FetchGlobalEventsParams = {
  from?: string;
  to?: string;
};

export type GlobalEventCreatePayload = {
  dateISO: string;
  mode: GlobalEvent["mode"];
  label: GlobalEvent["label"];
  leaveReason?: string | null;
  start?: string | null;
  end?: string | null;
  note?: string | null;
};

export type GlobalEventUpdatePayload = {
  dateISO?: string;
  mode?: GlobalEvent["mode"];
  label?: GlobalEvent["label"];
  leaveReason?: string | null;
  start?: string | null;
  end?: string | null;
  note?: string | null;
};

export type DeleteGlobalEventResult = {
  ok: true;
};


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


function parseMode(value: unknown): GlobalEvent["mode"] {
  if (value === "allDay" || value === "timeRange") return value;
  throw new Error("Invalid global event response");
}


function parseLabel(value: unknown): GlobalEvent["label"] {
  if (value === "停課" || value === "假期") return value;
  throw new Error("Invalid global event response");
}


function parseLeaveReason(value: unknown): ClosureReason | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new Error("Invalid global event response");
  }

  return closureReasonsSeed.includes(value as ClosureReason)
    ? (value as ClosureReason)
    : undefined;
}


function parseOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new Error("Invalid global event response");
  }
  return value;
}


function parseGlobalEvent(value: unknown): GlobalEvent {
  if (!isRecord(value)) {
    throw new Error("Invalid global event response");
  }

  if (typeof value.id !== "number" || typeof value.dateISO !== "string") {
    throw new Error("Invalid global event response");
  }

  return {
    id: value.id,
    dateISO: value.dateISO,
    mode: parseMode(value.mode),
    label: parseLabel(value.label),
    leaveReason: parseLeaveReason(value.leaveReason),
    start: parseOptionalString(value.start),
    end: parseOptionalString(value.end),
    note: parseOptionalString(value.note),
  };
}


function buildGlobalEventsUrl(params?: FetchGlobalEventsParams): string {
  const query = new URLSearchParams();

  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const queryString = query.toString();
  return `${API_BASE_URL}/api/global-events${queryString ? `?${queryString}` : ""}`;
}


export async function fetchGlobalEvents(
  params?: FetchGlobalEventsParams
): Promise<GlobalEvent[]> {
  const response = await fetch(buildGlobalEventsUrl(params));

  if (!response.ok) {
    throw new Error(`Failed to fetch global events: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid global events response");
  }

  return data.map(parseGlobalEvent);
}


export async function createGlobalEvent(
  payload: GlobalEventCreatePayload
): Promise<GlobalEvent> {
  const response = await fetch(`${API_BASE_URL}/api/global-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create global event: ${response.status}`);
  }

  return parseGlobalEvent(await response.json());
}


export async function updateGlobalEvent(
  id: number,
  payload: GlobalEventUpdatePayload
): Promise<GlobalEvent> {
  const response = await fetch(`${API_BASE_URL}/api/global-events/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update global event: ${response.status}`);
  }

  return parseGlobalEvent(await response.json());
}


export async function deleteGlobalEvent(id: number): Promise<DeleteGlobalEventResult> {
  const response = await fetch(`${API_BASE_URL}/api/global-events/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete global event: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || data.ok !== true) {
    throw new Error("Invalid delete global event response");
  }

  return { ok: true };
}
