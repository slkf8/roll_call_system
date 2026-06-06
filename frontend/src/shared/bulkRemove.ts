import type { Session } from "./appShared";

// Pure state-sync helper for batch removal. After the backend has already
// deleted every session falling on `dates`, this mirrors that result onto the
// frontend `sessions` array: it drops the removed sessions and detaches any
// surviving makeup that pointed at a removed source (clearing
// makeupOfSessionId while preserving makeupOfDateISO — matching the backend's
// detach semantics). It never mutates the input array or its objects, and
// preserves the original order of the surviving sessions.
export function applyBulkRemovalToSessions(
  sessions: Session[],
  dates: string[]
): Session[] {
  const removeDates = new Set(dates);

  // Ids of the sessions being removed (only those whose date is selected).
  const removedIds = new Set<number>();
  for (const session of sessions) {
    if (removeDates.has(session.dateISO)) {
      removedIds.add(session.id);
    }
  }

  const result: Session[] = [];
  for (const session of sessions) {
    if (removeDates.has(session.dateISO)) {
      continue; // removed
    }
    if (
      session.makeupOfSessionId !== undefined &&
      removedIds.has(session.makeupOfSessionId)
    ) {
      // Surviving makeup that referenced a removed source: detach the link but
      // keep makeupOfDateISO as the historical record.
      result.push({ ...session, makeupOfSessionId: undefined });
    } else {
      result.push(session);
    }
  }

  return result;
}
