import { useState, useMemo, useContext, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createSession, deleteSession, updateSession } from "../api/sessionsApi";
import type { SessionUpdatePayload } from "../api/sessionsApi";

// ==========================================
// 匯入 Shared 層內容 (對齊現有專案結構)
// ==========================================
import type {
  Session,
  GlobalEvent,
  ClosureReason,
  StudentProfile,
} from "../shared/appShared";
import {
  ThemeContext,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconCalendar,
  IOSSheet,
  FieldRow,
  DurationInput,
  Menu,
  SessionCard,
  checkOverlap,
  timeToMinutes,
  formatConflictSummary,
  getEffectiveStatus,
  getNextSessionId,
  getSessionStudentName,
  getConflictCandidates,
  reasonsSeed,
  closureReasonsSeed,
  endTime,
  addMinutes,
  isSessionCovered,
  ThemeToggle,
  HeaderBadge,
} from "../shared/appShared";

// ==========================================
// 本地 Types
// ==========================================
export interface MakeupDraft {
  dateISO: string;
  start: string;
  durationMin: number;
  studentId?: Session["studentId"];
  student: Session["student"];
  status: Session["status"];
  kind: Session["kind"];
  sourceSessionId?: Session["id"];
  sourceDateISO?: string;
}

export interface MonthPageProps {
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  selectedDate: string;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  students: StudentProfile[];
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  isSessionsBackendAvailable: boolean;
  globalEvents: GlobalEvent[];
  setGlobalEvents: Dispatch<SetStateAction<GlobalEvent[]>>;
  setToast: Dispatch<SetStateAction<string>>;
}

// ==========================================
// 本地 Icons & 局部小元件
// ==========================================
function IconCheckCircle2({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ==========================================
// Helper
// ==========================================
function formatDateISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCompactTimeRange(start?: string, end?: string) {
  if (!start || !end) return "";

  const compact = (value: string) => {
    const [h, m] = value.split(":");
    if (!h || !m) return value;
    return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
  };

  return `${compact(start)}-${compact(end)}`;
}

function getApplicableGlobalEvent(session: Session, globalEvents: GlobalEvent[]): GlobalEvent | null {
  const dayEvents = globalEvents.filter((e) => e.dateISO === session.dateISO);

  for (const e of dayEvents) {
    if (e.mode === "allDay") return e;

    if (e.mode === "timeRange" && e.start && e.end) {
      const eventDuration = timeToMinutes(e.end) - timeToMinutes(e.start);

      if (
        eventDuration > 0 &&
        checkOverlap(session, {
          start: e.start,
          durationMin: eventDuration,
        } as Session)
      ) {
        return e;
      }
    }
  }

  return null;
}

function formatGlobalAlert(event: GlobalEvent | null) {
  if (!event) return undefined;
  if (event.label === "停課" && event.leaveReason) {
    return `${event.label} · ${event.leaveReason}`;
  }
  return event.label;
}

// ==========================================
// Main Component
// ==========================================
export default function MonthPage({
  setTheme,
  selectedDate,
  setSelectedDate,
  students,
  sessions,
  setSessions,
  isSessionsBackendAvailable,
  globalEvents,
  setGlobalEvents,
  setToast,
}: MonthPageProps) {
  const isDark = useContext(ThemeContext) || false;

  const monthDatePickerRef = useRef<HTMLInputElement>(null);

  // 供月曆顯示的月份錨點 (預設為 today 或是 selectedDate 的所在月份)
  const [viewDate, setViewDate] = useState(
    () => (selectedDate ? new Date(selectedDate) : new Date())
  );

  useEffect(() => {
    if (!selectedDate) return;

    const picked = new Date(selectedDate);
    if (Number.isNaN(picked.getTime())) return;

    setViewDate((prev) => {
      const sameMonth =
        prev.getFullYear() === picked.getFullYear() &&
        prev.getMonth() === picked.getMonth();

      return sameMonth ? prev : new Date(picked.getFullYear(), picked.getMonth(), 1);
    });
  }, [selectedDate]);

  const today = new Date();
  const isViewingCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth();

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Forms & Action Sheets State
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [sheetAbsentFor, setSheetAbsentFor] = useState<string | number | null>(null);
  const [sheetEditFor, setSheetEditFor] = useState<Session | null>(null);
  const [sheetMakeupFor, setSheetMakeupFor] = useState<MakeupDraft | null>(null);
  const [sheetDeleteFor, setSheetDeleteFor] = useState<Session | null>(null);

  // --- 批量模式新增狀態 ---
  const [batchEventSheetOpen, setBatchEventSheetOpen] = useState(false);
  const [batchEventLabel, setBatchEventLabel] = useState<GlobalEvent["label"]>("假期");
  const [batchLeaveReason, setBatchLeaveReason] = useState<ClosureReason | "">("");

  // 安全陣列確保不會因為 undefined crash
  const safeSessions = sessions || [];
  const safeEvents = globalEvents || [];
  const schedulableStudentIds = useMemo(
    () => new Set(students.filter((s) => s.status !== "inactive").map((s) => s.id)),
    [students]
  );

  // --- Drawer 單日事件管理狀態 ---
  const [drawerGlobalSheetOpen, setDrawerGlobalSheetOpen] = useState(false);

  const [editingDrawerGlobal, setEditingDrawerGlobal] = useState<GlobalEvent>({
    id: 0,
    dateISO: "",
    mode: "allDay",
    label: "停課",
  });

  const currentDrawerGlobalEvent = useMemo(() => {
    if (!drawerDate) return null;
    return safeEvents.find((e) => e.dateISO === drawerDate) || null;
  }, [drawerDate, safeEvents]);


  // --- 新增的狀態 (與 TodayPage 對齊) ---
  const [absentNote, setAbsentNote] = useState("");

  const absentTarget = useMemo(
    () => safeSessions.find((s) => s.id === sheetAbsentFor) ?? null,
    [safeSessions, sheetAbsentFor]
  );

  const [editDate, setEditDate] = useState<string>(selectedDate);
  const [editStart, setEditStart] = useState<string>("14:00");
  const [editDuration, setEditDuration] = useState<number>(60);

  const [mkDate, setMkDate] = useState<string>(selectedDate);
  const [mkStart, setMkStart] = useState<string>("18:00");
  const [mkPurpose, setMkPurpose] = useState<"makeup" | "extra">("makeup");

  // 衝突檢查


const checkConflictsWithOthers = (targetSession: Session, allSessions: Session[]) => {
  const dayEvents = safeEvents.filter((e) => e.dateISO === targetSession.dateISO);

  const candidates = getConflictCandidates(
    allSessions,
    targetSession.dateISO,
    dayEvents
  );

  const targetIncluded = candidates.some((s) => s.id === targetSession.id);
  if (!targetIncluded) return;

  const others = candidates.filter((s) => s.id !== targetSession.id);
  const overlapOthers = others.filter((o) => checkOverlap(targetSession, o));

  if (overlapOthers.length > 0) {
    const conflicts = [targetSession, ...overlapOthers];
    const msg = formatConflictSummary(conflicts);
    setToast(msg);
  }
};

const calculateDayConflicts = (
  dateISO: string,
  daySessions: Session[],
  dayEvents: GlobalEvent[]
) => {
  const conflicts = new Set<string | number>();

  const candidates = getConflictCandidates(daySessions, dateISO, dayEvents);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];

      if (checkOverlap(a, b)) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }

  return conflicts;
};

  // --- Handlers ---
  function openMonthDatePicker() {
    const input = monthDatePickerRef.current as HTMLInputElement | null;
    if (!input) return;

    const anyInput = input as any;
    if (typeof anyInput.showPicker === "function") {
      anyInput.showPicker();
    } else {
      input.click();
    }
  }

  function handleMonthDateChange(value: string) {
    if (!value) return;

    const picked = new Date(value);
    setSelectedDate(value);
    setViewDate(new Date(picked.getFullYear(), picked.getMonth(), 1));
    setDrawerDate(value);
    setActiveMenuId(null);
  }

  function goToCurrentMonth() {
    const now = new Date();
    const iso = formatDateISO(now);
    setSelectedDate(iso);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setDrawerDate(null);
    setActiveMenuId(null);
  }

  function reasonToPayload(reason: Partial<Session>["reason"] | string | null | undefined) {
    if (typeof reason === "string") return reason;
    if (reason) return reason.name;
    return null;
  }

  function buildStatusPayload(
    newStatus: Session["status"],
    extraData: Partial<Session>
  ): SessionUpdatePayload {
    const payload: SessionUpdatePayload = { status: newStatus };

    if ("reason" in extraData) {
      payload.reason = reasonToPayload(extraData.reason);
    }
    if ("note" in extraData) {
      payload.note = extraData.note || null;
    }

    return payload;
  }

  const handleMarkStatus = async (
    id: Session["id"],
    newStatus: Session["status"],
    extraData: Partial<Session> = {}
  ): Promise<boolean> => {
    if (!isSessionsBackendAvailable) {
      setSessions((prev) =>
        (prev || []).map((s) => (s.id === id ? { ...s, status: newStatus, ...extraData } : s))
      );
      return true;
    }

    try {
      const updated = await updateSession(id as number, buildStatusPayload(newStatus, extraData));
      setSessions((prev) => (prev || []).map((s) => (s.id === updated.id ? updated : s)));
      return true;
    } catch (error) {
      console.warn("Backend session update failed", error);
      setToast("點名更新失敗，請確認後端是否正常");
      return false;
    }
  };

  function openAbsent(id: string | number) {
    setSheetAbsentFor(id);
    setAbsentNote("");
  }

  function openEditFromMenu(session: Session) {
    setSheetEditFor(session);
    setEditDate(session.dateISO);
    setEditStart(session.start);
    setEditDuration(session.durationMin);
  }

  function openMakeupFromMenu(session: Session, purpose: "makeup" | "extra") {
    if (session.studentId == null || !schedulableStudentIds.has(session.studentId)) {
      setToast("已停用學生不可安排補課或加課");
      return;
    }

    const isMakeup = purpose === "makeup";

    setSheetMakeupFor({
      dateISO: drawerDate || selectedDate,
      start: endTime(session),
      durationMin: 60,
      studentId: session.studentId,
      student: session.student,
      status: "pending",
      kind: isMakeup ? "makeup" : "extra",
      sourceSessionId: isMakeup ? session.id : undefined,
      sourceDateISO: isMakeup ? session.dateISO : undefined,
    });
    setMkDate(drawerDate || selectedDate);
    setMkStart(endTime(session));
    setMkPurpose(purpose);
  }

  const handleEditSubmit = async () => {
    if (!sheetEditFor) return;

    const updatedSession: Session = {
      ...sheetEditFor,
      dateISO: editDate,
      start: editStart,
      durationMin: editDuration,
    };

    if (isSessionsBackendAvailable) {
      try {
        const backendUpdatedSession = await updateSession(sheetEditFor.id as number, {
          dateISO: editDate,
          start: editStart,
          durationMin: editDuration,
        });
        setSessions((prev) => {
          const safePrev = prev || [];
          const nextSessions = safePrev.map((s) =>
            s.id === backendUpdatedSession.id ? backendUpdatedSession : s
          );
          checkConflictsWithOthers(backendUpdatedSession, nextSessions);
          return nextSessions;
        });
        setSheetEditFor(null);
      } catch (error) {
        console.warn("Backend session edit failed", error);
        setToast("編輯課次失敗，請確認後端是否正常");
      }
      return;
    }

    setSessions((prev) => {
      const safePrev = prev || [];
      const nextSessions = safePrev.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      );
      checkConflictsWithOthers(updatedSession, nextSessions);
      return nextSessions;
    });

    setSheetEditFor(null);
  };

  const handleMakeupSubmit = async () => {
    if (!sheetMakeupFor) return;

    if (
      sheetMakeupFor.studentId == null ||
      !schedulableStudentIds.has(sheetMakeupFor.studentId)
    ) {
      setToast("已停用學生不可安排補課或加課");
      return;
    }

    const isMakeup = mkPurpose === "makeup";

    if (isSessionsBackendAvailable) {
      try {
        const createdSession = await createSession({
          studentId: sheetMakeupFor.studentId,
          dateISO: mkDate,
          start: mkStart,
          durationMin: sheetMakeupFor.durationMin,
          status: "pending",
          reason: null,
          note: null,
          kind: isMakeup ? "makeup" : "extra",
          makeupOfDateISO: isMakeup ? sheetMakeupFor.sourceDateISO ?? null : null,
          makeupOfSessionId: isMakeup ? sheetMakeupFor.sourceSessionId ?? null : null,
          scheduleRuleId: null,
        });

        setSessions((prev) => {
          const safePrev = prev || [];
          const nextSessions = [...safePrev, createdSession];
          checkConflictsWithOthers(createdSession, nextSessions);
          return nextSessions;
        });

        setSheetMakeupFor(null);
      } catch (error) {
        console.warn("Backend makeup session create failed", error);
        setToast(isMakeup ? "建立補課失敗，請確認後端是否正常" : "建立加課失敗，請確認後端是否正常");
      }
      return;
    }

    setSessions((prev) => {
      const safePrev = prev || [];

      const newSession: Session = {
        id: getNextSessionId(safePrev),
        studentId: sheetMakeupFor.studentId,
        student: {
          id: sheetMakeupFor.student?.id ?? 0,
          name: getSessionStudentName(sheetMakeupFor),
        },
        dateISO: mkDate,
        start: mkStart,
        durationMin: sheetMakeupFor.durationMin,
        status: "pending",
        kind: isMakeup ? "makeup" : "extra",
        makeupOfDateISO: isMakeup ? sheetMakeupFor.sourceDateISO : undefined,
        makeupOfSessionId: isMakeup ? sheetMakeupFor.sourceSessionId : undefined,
      };

      const nextSessions = [...safePrev, newSession];
      checkConflictsWithOthers(newSession, nextSessions);
      return nextSessions;
    });

    setSheetMakeupFor(null);
  };

const handleDeleteSubmit = async () => {
  if (!sheetDeleteFor) return;

  const deleteTarget = sheetDeleteFor;

  const kindText =
    deleteTarget.kind === "makeup"
      ? "補課"
      : deleteTarget.kind === "extra"
      ? "加課"
      : "課次";

  const linkedMakeups = sessions.filter(
    (s) => s.makeupOfSessionId === deleteTarget.id
  );
  let detachedCount = linkedMakeups.length;

  if (isSessionsBackendAvailable) {
    try {
      const result = await deleteSession(deleteTarget.id);
      detachedCount = result.detachedMakeupCount;
    } catch (error) {
      console.warn("Backend session delete failed", error);
      setToast("刪除課次失敗，請確認後端是否正常");
      return;
    }
  }

  setSessions((prev) => {
    const safePrev = prev || [];

    return safePrev
      .filter((s) => s.id !== deleteTarget.id)
      .map((s) => {
        if (s.makeupOfSessionId === deleteTarget.id) {
          return {
            ...s,
            makeupOfSessionId: undefined,
            makeupOfDateISO: undefined,
          };
        }
        return s;
      });
  });

  setToast(
    detachedCount > 0
      ? `已刪除${kindText}，並解除 ${detachedCount} 堂補課關聯`
      : `已刪除${kindText}`
  );

  setSheetDeleteFor(null);
};

  // --- Drawer 單日事件 Handlers ---
  function openDrawerGlobalSheet() {
    if (!drawerDate) return;

    if (currentDrawerGlobalEvent) {
      setEditingDrawerGlobal({ ...currentDrawerGlobalEvent });
    } else {
      setEditingDrawerGlobal({
        id: Date.now(),
        dateISO: drawerDate,
        mode: "allDay",
        label: "停課",
        leaveReason: "病假",
        start: "14:00",
        end: "18:00",
      });
    }

    setDrawerGlobalSheetOpen(true);
  }

  function saveDrawerGlobalEvent() {
    if (!editingDrawerGlobal.label.trim()) {
      setToast("請輸入事件名稱");
      return;
    }

    if (editingDrawerGlobal.label === "停課" && !editingDrawerGlobal.leaveReason) {
      setToast("請選擇停課原因");
      return;
    }

    if (editingDrawerGlobal.mode === "timeRange") {
      if (!editingDrawerGlobal.start || !editingDrawerGlobal.end) {
        setToast("請輸入完整的開始與結束時間");
        return;
      }

      if (timeToMinutes(editingDrawerGlobal.start) >= timeToMinutes(editingDrawerGlobal.end)) {
        setToast("全局事件時間區間不合法（開始必須早於結束）");
        return;
      }
    }

    const normalizedEvent: GlobalEvent = {
    ...editingDrawerGlobal,
    start: editingDrawerGlobal.mode === "timeRange" ? editingDrawerGlobal.start : undefined,
    end: editingDrawerGlobal.mode === "timeRange" ? editingDrawerGlobal.end : undefined,
    leaveReason:
        editingDrawerGlobal.label === "停課"
        ? editingDrawerGlobal.leaveReason
        : undefined,
    };

    setGlobalEvents((prev) => {
      const safePrev = prev || [];
      const filtered = safePrev.filter((e) => e.dateISO !== normalizedEvent.dateISO);
      return [...filtered, normalizedEvent];
    });

    setDrawerGlobalSheetOpen(false);
    setToast(
      normalizedEvent.label === "停課" && normalizedEvent.leaveReason
        ? `已設定：${normalizedEvent.label} · ${normalizedEvent.leaveReason}`
        : `已設定：${normalizedEvent.label}`
    );
  }

  function deleteDrawerGlobalEvent() {
    if (!drawerDate) return;

    setGlobalEvents((prev) => {
      const safePrev = prev || [];
      return safePrev.filter((e) => e.dateISO !== drawerDate);
    });

    setDrawerGlobalSheetOpen(false);
    setToast("已取消全局事件");
  }

  function openBatchModeFromDrawer() {
    if (!drawerDate) return;

    setDrawerGlobalSheetOpen(false);
    setActiveMenuId(null);
    setSelectedDates(new Set([drawerDate]));
    setIsBatchMode(true);
    setDrawerDate(null);
  }


const handleBatchMarkHoliday = () => {
  const selected = Array.from(selectedDates);
  if (selected.length === 0) {
    setToast("請先選擇日期");
    return;
  }

  if (batchEventLabel === "停課" && !batchLeaveReason) {
    setToast("請選擇停課原因");
    return;
  }

  const nextLeaveReason: ClosureReason | undefined =
    batchEventLabel === "停課" ? (batchLeaveReason || "病假") : undefined;

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  setGlobalEvents((prev) => {
    const safePrev = prev || [];
    const next = [...safePrev];

    for (const dateISO of selected) {
      const existingIndex = next.findIndex((e) => e.dateISO === dateISO);

      if (existingIndex === -1) {
        next.push({
          id: Date.now() + createdCount + updatedCount + unchangedCount,
          dateISO,
          mode: "allDay",
          label: batchEventLabel,
          leaveReason: nextLeaveReason,
        });
        createdCount++;
        continue;
      }

      const existing = next[existingIndex];

      const isSameAllDayEvent =
        existing.mode === "allDay" &&
        existing.label === batchEventLabel &&
        (existing.leaveReason ?? undefined) === nextLeaveReason;

      if (isSameAllDayEvent) {
        unchangedCount++;
        continue;
      }

      next[existingIndex] = {
        ...existing,
        mode: "allDay",
        start: undefined,
        end: undefined,
        label: batchEventLabel,
        leaveReason: nextLeaveReason,
      };
      updatedCount++;
    }

    return next;
  });

  if (createdCount === 0 && updatedCount === 0) {
    setToast(`所選日期已經是${batchEventLabel}，未做變更`);
  } else {
    const parts: string[] = [];
    if (createdCount > 0) parts.push(`新增 ${createdCount} 天`);
    if (updatedCount > 0) parts.push(`更新 ${updatedCount} 天`);
    if (unchangedCount > 0) parts.push(`保留 ${unchangedCount} 天`);
    setToast(`已套用${batchEventLabel}：${parts.join("、")}`);
  }

  setBatchEventSheetOpen(false);
  setIsBatchMode(false);
  setSelectedDates(new Set());
  setBatchLeaveReason("");
};

const handleBatchClearHoliday = () => {
  const selected = Array.from(selectedDates);

  if (selected.length === 0) {
    setToast("請先選擇日期");
    return;
  }

  let clearedCount = 0;

  setGlobalEvents((prev) => {
    const safePrev = prev || [];

    return safePrev.filter((e) => {
      if (selectedDates.has(e.dateISO)) {
        clearedCount++;
        return false;
      }
      return true;
    });
  });

  if (clearedCount === 0) {
    setToast("所選日期沒有可清除的事件");
  } else {
    setToast(`已清除 ${clearedCount} 筆事件`);
  }

  setIsBatchMode(false);
  setSelectedDates(new Set());
};

  // --- 月曆邏輯 ---
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewDate]);

  const handleDayClick = (dateISO: string) => {
    if (isBatchMode) {
      setSelectedDates((prev) => {
        const next = new Set(prev);
        if (next.has(dateISO)) next.delete(dateISO);
        else next.add(dateISO);
        return next;
      });
    } else {
      setSelectedDate(dateISO);
      setDrawerDate(dateISO);
    }
  };

  const changeMonth = (offset: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getDaySummary = (dateISO: string) => {
    const daySessions = safeSessions.filter((s) => s.dateISO === dateISO);
    const dayEvents = safeEvents.filter((e) => e.dateISO === dateISO);

    // 計算全局事件有效狀態覆蓋後的 Session 狀態
    const effectiveSessions = daySessions.map((s) => {
      const event = getApplicableGlobalEvent(s, dayEvents);
      return {
        ...s,
        effectiveStatus: getEffectiveStatus(s, event),
      };
    });

    const allDayEvent = dayEvents.find((e) => e.mode === "allDay") || null;
    const firstTimedEvent =
      !allDayEvent ? dayEvents.find((e) => e.mode === "timeRange") || null : null;

    const isHoliday = !!allDayEvent;
    const hasTimedEvent = !!firstTimedEvent;

    const eventLabel = allDayEvent?.label || null;
    const eventDisplayLabel = allDayEvent ? formatGlobalAlert(allDayEvent) ?? null : null;

    const timedEventLabel = firstTimedEvent?.label || null;
    const timedEventDisplayLabel = firstTimedEvent
      ? formatGlobalAlert(firstTimedEvent) ?? null
      : null;

    const timedEventTimeLabel = firstTimedEvent
      ? formatCompactTimeRange(firstTimedEvent.start, firstTimedEvent.end)
      : "";

    const conflictIds = calculateDayConflicts(dateISO, daySessions, dayEvents);

    const total = effectiveSessions.length;
    const present = effectiveSessions.filter((s) => s.effectiveStatus === "present").length;
    const absent = effectiveSessions.filter((s) => s.effectiveStatus === "absent").length;
    const pending = effectiveSessions.filter((s) => s.effectiveStatus === "pending").length;
    const hasConflict = conflictIds.size > 0;

    return {
      total,
      present,
      absent,
      pending,
      isHoliday,
      eventLabel,
      eventDisplayLabel,
      hasTimedEvent,
      timedEventLabel,
      timedEventDisplayLabel,
      timedEventTimeLabel,
      hasConflict,
      completed: present + absent,
      conflictIds,
      dayEvents,
    };
  };

  const drawerSummary = drawerDate ? getDaySummary(drawerDate) : null;
  const drawerSessions = useMemo(() => {
    if (!drawerDate) return [];

    return safeSessions
      .filter((s) => s.dateISO === drawerDate)
      .slice()
      .sort((a, b) => {
        const diff = timeToMinutes(a.start) - timeToMinutes(b.start);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id));
      });
  }, [drawerDate, safeSessions]);

  return (
    <div
    className={`min-h-screen flex flex-col font-sans relative pb-28 overflow-x-hidden ${
        isDark ? "bg-[#111214]" : "bg-[#F2F2F7]"
    }`}
    >
      {/* --- HeaderBar --- */}
      <div className="mx-auto w-full max-w-4xl px-5 pb-4 pt-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                isDark ? "bg-[#1C1C1E] ring-white/10 text-[#F2F2F7]" : "bg-white ring-[#E5E5EA] text-slate-700"
              }`}>
                <IconCalendar className="h-5 w-5" />
              </div>
              <h1
                className={`text-[28px] font-bold tracking-tight ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                排課總覽
              </h1>
              <HeaderBadge>正式版 v1.3</HeaderBadge>
            </div>
            
            <ThemeToggle
              isDark={isDark}
              interactive={true}
              onSelect={(next) => setTheme(next)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
            {isBatchMode ? (
              <div
                className={`flex items-center gap-3 animate-in fade-in rounded-full p-1.5 pl-4 ring-1 shadow-sm ${
                  isDark ? "bg-[#1C1C1E] ring-white/10" : "bg-white ring-[#E5E5EA]"
                }`}
              >
                <span className={`text-[15px] font-bold ${isDark ? "text-[#0A84FF]" : "text-[#007AFF]"}`}>
                  已選取 {selectedDates.size} 天
                </span>
                <button
                  onClick={() => {
                    setIsBatchMode(false);
                    setSelectedDates(new Set());
                  }}
                  className={`rounded-full p-1.5 transition-colors ${
                    isDark
                      ? "bg-[#2C2C2E] text-slate-300 hover:bg-[#3A3A3C]"
                      : "bg-[#F2F2F7] text-gray-600 hover:bg-[#E5E5EA]"
                  }`}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                <div
                  className={`flex items-center rounded-full p-1 ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                    isDark ? "bg-[#1C1C1E] ring-white/10" : "bg-white ring-[#E5E5EA]"
                  }`}
                >
                  <button
                    onClick={() => changeMonth(-1)}
                    className={`rounded-full p-1.5 transition-colors active:scale-[0.98] ${
                      isDark
                        ? "text-[#8E8E93] hover:text-slate-300 hover:bg-white/10"
                        : "text-[#8E8E93] hover:text-gray-600 hover:bg-[#F2F2F7]"
                    }`}
                    aria-label="上一個月"
                  >
                    <IconChevronLeft className="h-5 w-5" />
                  </button>

                  <button
                    onClick={openMonthDatePicker}
                    className={`min-w-[90px] px-3 text-center text-[15px] font-bold tabular-nums active:opacity-50 transition-opacity ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                    aria-label="選擇月份日期"
                  >
                    {viewDate.getFullYear()}年{viewDate.getMonth() + 1}月
                  </button>

                  <input
                    ref={monthDatePickerRef}
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleMonthDateChange(e.target.value)}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10"
                    tabIndex={-1}
                  />

                  <button
                    onClick={() => changeMonth(1)}
                    className={`rounded-full p-1.5 transition-colors active:scale-[0.98] ${
                      isDark
                        ? "text-[#8E8E93] hover:text-slate-300 hover:bg-white/10"
                        : "text-[#8E8E93] hover:text-gray-600 hover:bg-[#F2F2F7]"
                    }`}
                    aria-label="下一個月"
                  >
                    <IconChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {!isViewingCurrentMonth && (
                  <button
                    onClick={goToCurrentMonth}
                    className={`rounded-full px-4 py-2 text-[14px] font-bold ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors active:scale-[0.98] ${
                      isDark
                        ? "bg-[#2C2C2E] text-slate-300 ring-white/10 active:bg-[#3A3A3C]"
                        : "bg-white text-gray-700 ring-[#E5E5EA] active:bg-gray-50"
                    }`}
                  >
                    回到本月
                  </button>
                )}
              </div>
            )}

            {!isBatchMode && (
              <button
                onClick={() => setIsBatchMode(true)}
                className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${
                  isDark
                    ? "bg-[#1C1C1E] text-[#0A84FF] ring-1 ring-white/10 hover:bg-[#2C2C2E] active:scale-[0.98]"
                    : "bg-[#E5F0FF] text-[#007AFF] active:bg-[#D1E3FF]"
                }`}
              >
                批量停課
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- 月曆網格區 --- */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-5">
        <div className="mb-2 grid grid-cols-7 gap-2">
                {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <div key={day} className={`py-1 text-center text-[12px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {calendarDays.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="min-h-[90px] bg-transparent" />;

            const dateISO = formatDateISO(date);
            const summary = getDaySummary(dateISO);
            const isSelected = selectedDates.has(dateISO);
            const isToday = formatDateISO(new Date()) === dateISO;

            let cellClasses =
              "relative flex flex-col min-h-[90px] p-2 rounded-[18px] transition-all duration-200 select-none cursor-pointer overflow-hidden ";

            if (isBatchMode) {
              cellClasses += isSelected
                ? isDark
                  ? "bg-[#1C1C1E] ring-2 ring-[#0A84FF] shadow-sm "
                  : "bg-[#E5F0FF] ring-2 ring-[#007AFF] shadow-sm "
                : isDark
                ? "bg-[#1C1C1E] ring-1 ring-white/10 opacity-60 hover:opacity-100 "
                : "bg-white ring-1 ring-[#E5E5EA] opacity-60 hover:opacity-100 ";
            } else {
              cellClasses += isDark
                ? "bg-[#1C1C1E] ring-1 ring-white/10 active:scale-[0.97] active:bg-[#2C2C2E] "
                : "bg-white ring-1 ring-[#E5E5EA] shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-[0.97] active:bg-[#F9F9FB] ";
            }

            if (summary.isHoliday && !isSelected) {
              cellClasses += isDark ? " bg-[#242426]" : " bg-[#FAFAFA]";
            }

            const isPickedDate = dateISO === selectedDate;
            if (!isBatchMode && isPickedDate) {
              cellClasses += isDark
                ? " ring-2 ring-[#0A84FF]"
                : " ring-2 ring-[#007AFF]";
            }

            return (
              <div
                key={dateISO}
                className={cellClasses}
                onClick={() => handleDayClick(dateISO)}
              >
                {summary.hasConflict && (
                  <div className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#FF3B30]" />
                )}

                {isBatchMode && isSelected && (
                  <div className={`absolute right-1.5 top-1.5 rounded-full ${isDark ? 'bg-[#1C1C1E] text-[#0A84FF]' : 'bg-white text-[#007AFF]'}`}>
                    <IconCheckCircle2 className="h-4 w-4" />
                  </div>
                )}

                <div className="z-10">
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold ${
                        isToday
                          ? isDark ? "bg-[#0A84FF] text-white" : "bg-[#007AFF] text-white"
                          : isDark
                          ? "text-white"
                          : "text-gray-900"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {!summary.isHoliday && summary.hasTimedEvent && (
                    <div className="mt-1 flex items-center gap-1">
                      <span
                        title={
                          `${summary.timedEventDisplayLabel ?? ""}${
                            summary.timedEventTimeLabel ? ` ${summary.timedEventTimeLabel}` : ""
                          }`
                        }
                        className={`inline-block h-1 w-4 shrink-0 rounded-full ${
                          summary.timedEventLabel === "假期"
                            ? isDark
                              ? "bg-violet-500"
                              : "bg-violet-500/80"
                            : isDark
                            ? "bg-amber-500"
                            : "bg-amber-500/90"
                        }`}
                      />

                        {summary.timedEventTimeLabel && (
                        <span
                            className={`min-w-0 truncate text-[9px] font-bold leading-none tracking-tight ${
                            isDark ? "text-[#8E8E93]" : "text-slate-500"
                            }`}
                        >
                            {summary.timedEventTimeLabel}
                        </span>
                        )}
                    </div>
                  )}
                </div>

                <div className="z-10 mt-auto flex flex-col gap-1">
                  {!summary.isHoliday && summary.total > 0 && (
                    <>
                      <div className="text-center tracking-tight">
                        <span
                          className={`text-[16px] font-bold ${
                            summary.completed === summary.total
                              ? isDark
                                ? "text-white"
                                : "text-gray-900"
                                : isDark
                                ? "text-[#8E8E93]"
                                : "text-gray-600"
                          }`}
                        >
                          {summary.completed}
                        </span>
                        <span className={`mx-0.5 text-[11px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>/</span>
                        <span className={`text-[11px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
                          {summary.total}
                        </span>
                      </div>

                      {(summary.absent > 0 || summary.pending > 0) && (
                        <div className="flex items-center justify-center gap-1.5">
                          {summary.absent > 0 && (
                            <div className="flex items-center gap-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]"></span>
                                <span className={`text-[11px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
                                {summary.absent}
                                </span>
                            </div>
                          )}
                          {summary.pending > 0 && (
                            <div className="flex items-center gap-0.5">
                              <span className={`h-1.5 w-1.5 rounded-full border-2 ${isDark ? 'border-slate-500' : 'border-[#8E8E93]'}`}></span>
                                <span className={`text-[11px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
                                {summary.pending}
                                </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {summary.isHoliday && summary.eventDisplayLabel && (
                    <span className={`mt-1 block text-center text-[11px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
                    {summary.eventDisplayLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* --- Batch Action Bar --- */}
      {isBatchMode && (
        <div className="animate-in slide-in-from-bottom-5 fade-in fixed bottom-[100px] left-1/2 z-30 -translate-x-1/2 duration-200">
          <div
            className={`flex items-center gap-4 rounded-[24px] px-5 py-3 ring-1 backdrop-blur-xl ${
              isDark ? "bg-[#1C1C1E]/80 ring-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)]" : "bg-white/90 ring-[#E5E5EA] shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            }`}
          >
            <div className={`whitespace-nowrap text-[14px] font-bold ${isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'}`}>
              已選 <span className={`text-[16px] ${isDark ? 'text-[#0A84FF]' : 'text-[#007AFF]'}`}>{selectedDates.size}</span>
            </div>
            <div className={`h-6 w-[1px] ${isDark ? "bg-white/10" : "bg-[#E5E5EA]"}`}></div>
            <div className="flex gap-2">
              <button
                disabled={selectedDates.size === 0}
                onClick={() => setBatchEventSheetOpen(true)}
                className={`rounded-full px-5 py-2.5 text-[14px] font-bold transition-colors disabled:opacity-40 ${
                  isDark
                    ? "bg-[#2C2C2E] text-white ring-1 ring-white/10 active:bg-[#3A3A3C]"
                    : "bg-gray-900 text-white active:bg-gray-800"
                }`}
              >
                標記停課 / 假期
              </button>
              <button
                disabled={selectedDates.size === 0}
                onClick={handleBatchClearHoliday}
                className={`rounded-full px-5 py-2.5 text-[14px] font-bold transition-colors disabled:opacity-40 ${
                  isDark
                    ? "bg-[#2C2C2E] text-slate-300 ring-1 ring-white/10 active:bg-[#3A3A3C]"
                    : "bg-[#F2F2F7] text-gray-700 active:bg-[#E5E5EA]"
                }`}
              >
                清除事件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Day Drawer --- */}
      {drawerDate && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => {
            setDrawerDate(null);
            setActiveMenuId(null);
            setDrawerGlobalSheetOpen(false);
          }}
        />
      )}

      <div
        className={`fixed top-0 z-50 flex h-full w-full sm:w-[620px] lg:w-[700px] xl:w-[760px] max-w-[100vw] shrink-0 flex-col shadow-2xl transition-all duration-300 ease-in-out ${
          drawerDate ? "right-0" : "-right-full"
        } ${isDark ? "bg-[#1C1C1E]" : "bg-[#F2F2F7]"}`}
      >
        {drawerDate && drawerSummary && (
          <>
            <div
              className={`sticky top-0 z-10 ${
                isDark ? "bg-[#1C1C1E]" : "bg-[#F2F2F7]"
              }`}
            >
              <div className="flex w-full items-start justify-between px-6 pb-4 pt-12">
                <div className="flex flex-col gap-1">
                  <h2
                    className={`text-[24px] font-bold tracking-tight ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {drawerDate.replace(/-/g, "/")}
                  </h2>
                  <p className="text-[14px] font-bold text-[#8E8E93]">當日詳細記錄</p>
                </div>
                <button
                  onClick={() => {
                    setDrawerDate(null);
                    setActiveMenuId(null);
                    setDrawerGlobalSheetOpen(false);
                  }}
                  className={`rounded-full p-2 transition-colors ${
                    isDark
                      ? "bg-[#2C2C2E] text-slate-300 active:bg-[#3A3A3C]"
                      : "bg-[#E5E5EA] text-gray-600 active:bg-[#D1D1D6]"
                  }`}
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="w-full px-6 pb-6">
                <div
                  className={`mb-6 grid grid-cols-4 gap-2 divide-x rounded-[22px] p-5 text-center ring-1 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${
                    isDark
                      ? "bg-[#2C2C2E] divide-white/10 ring-white/10"
                      : "bg-white divide-[#F2F2F7] ring-[#E5E5EA]"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-[22px] font-bold leading-none ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {drawerSummary.total}
                    </span>
                    <span className="text-[11px] font-bold text-[#8E8E93]">總課次</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[22px] font-bold leading-none text-[#1E7E34]">
                      {drawerSummary.completed}
                    </span>
                    <span className="text-[11px] font-bold text-[#8E8E93]">已完成</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[22px] font-bold leading-none text-[#D92D20]">
                      {drawerSummary.absent}
                    </span>
                    <span className="text-[11px] font-bold text-[#8E8E93]">缺席</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[22px] font-bold leading-none text-[#8E8E93]">
                      {drawerSummary.pending}
                    </span>
                    <span className="text-[11px] font-bold text-[#8E8E93]">待確認</span>
                  </div>
                </div>

                <div
                  className={`mb-4 rounded-[22px] p-4 ring-1 ${
                    isDark ? "bg-[#2C2C2E] ring-white/10" : "bg-white ring-[#E5E5EA]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className={`text-[13px] font-bold ${isDark ? "text-[#8E8E93]" : "text-gray-700"}`}>
                        當日事件
                        </div>

                      {currentDrawerGlobalEvent ? (
                        <div className="mt-1">
                          <div className={`text-[15px] font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {formatGlobalAlert(currentDrawerGlobalEvent)}
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium text-[#8E8E93]">
                            {currentDrawerGlobalEvent.mode === "allDay"
                              ? "全天"
                              : `${currentDrawerGlobalEvent.start}–${currentDrawerGlobalEvent.end}`}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[13px] font-medium text-[#8E8E93]">
                          尚未設定當日停課 / 假期
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={openDrawerGlobalSheet}
                      className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                        isDark
                          ? "bg-black/20 text-slate-200 ring-1 ring-white/10 active:bg-black/30"
                          : "bg-[#F2F2F7] text-gray-700 ring-1 ring-[#E5E5EA] active:bg-[#E5E5EA]"
                      }`}
                    >
                      {currentDrawerGlobalEvent ? "編輯事件" : "設定事件"}
                    </button>

                    {currentDrawerGlobalEvent && (
                      <button
                        onClick={deleteDrawerGlobalEvent}
                        className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                          isDark
                            ? "bg-[#3A1E22] text-rose-300 ring-1 ring-rose-500/20 active:bg-[#4A252A]"
                            : "bg-rose-50 text-rose-600 ring-1 ring-rose-200 active:bg-rose-100"
                        }`}
                      >
                        清除此日
                      </button>
                    )}

                    <button
                      onClick={openBatchModeFromDrawer}
                      className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                        isDark 
                          ? "bg-[#1C1C1E] text-[#0A84FF] ring-1 ring-white/10 active:bg-[#2C2C2E]"
                          : "bg-[#E5F0FF] text-[#007AFF] active:bg-[#D1E3FF]"
                      }`}
                    >
                      批量模式
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {drawerSessions.length > 0 ? (
                    drawerSessions.map((session) => {
                      const event = getApplicableGlobalEvent(session, drawerSummary.dayEvents);
                      const blockedByGlobal = isSessionCovered(session, event);

                      return (
                        <div key={session.id} className="relative">
                          <SessionCard
                            s={session}
                            effectiveStatus={getEffectiveStatus(session, event)}
                            hasConflict={drawerSummary.conflictIds.has(session.id)}
                            globalAlert={blockedByGlobal ? formatGlobalAlert(event) : undefined}
                            // isDark={isDark}
                            onPresent={() => {
                              if (blockedByGlobal) {
                                setToast(`⚠️ 本節已被「${formatGlobalAlert(event)}」覆蓋，已鎖定操作`);
                                return;
                              }
                              void handleMarkStatus(session.id, "present", {
                                reason: undefined,
                                note: undefined,
                              });
                            }}
                            onAbsent={() => {
                              if (blockedByGlobal) {
                                setToast(`⚠️ 本節已被「${formatGlobalAlert(event)}」覆蓋，已鎖定操作`);
                                return;
                              }
                              openAbsent(session.id);
                            }}
                            onReset={() => {
                              if (blockedByGlobal) {
                                setToast(`⚠️ 本節已被「${formatGlobalAlert(event)}」覆蓋，已鎖定操作`);
                                return;
                              }
                              void handleMarkStatus(session.id, "pending", {
                                reason: undefined,
                                note: undefined,
                              });
                            }}
                            onOpenMenu={() =>
                              setActiveMenuId(activeMenuId === session.id ? null : session.id)
                            }
                          />
                          <Menu
                            open={activeMenuId === session.id}
                            onClose={() => setActiveMenuId(null)}
                            items={[
                              {
                                label: "編輯課次",
                                onClick: () => {
                                  setActiveMenuId(null);
                                  openEditFromMenu(session);
                                },
                              },
                              {
                                label: "安排補課（補回本堂）",
                                onClick: () => {
                                  setActiveMenuId(null);
                                  openMakeupFromMenu(session, "makeup");
                                },
                              },
                              {
                                label: "額外加課（不抵扣缺席）",
                                onClick: () => {
                                  setActiveMenuId(null);
                                  openMakeupFromMenu(session, "extra");
                                },
                              },
                              {
                                label:
                                  session.status === "cancelled"
                                    ? "取消單堂停課"
                                    : "標記單堂停課",
                                onClick: () => {
                                  setActiveMenuId(null);

                                  const nextStatus: Session["status"] =
                                    session.status === "cancelled" ? "pending" : "cancelled";

                                  void handleMarkStatus(session.id, nextStatus).then((ok) => {
                                    if (!ok) return;
                                    setToast(
                                      nextStatus === "cancelled"
                                        ? `已將 ${getSessionStudentName(session)} ${session.start} 標記為單堂停課`
                                        : `已取消 ${getSessionStudentName(session)} ${session.start} 的單堂停課`
                                    );
                                  });
                                },
                              },
                              {
                                label: "刪除課次",
                                onClick: () => {
                                  setActiveMenuId(null);
                                  setSheetDeleteFor(session);
                                },
                                danger: true,
                              },
                            ]}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-[15px] font-bold text-[#8E8E93]">
                      當日無排課紀錄
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- 全局 IOSSheets --- */}

      <IOSSheet
        open={drawerGlobalSheetOpen}
        title="設定當日事件"
        onClose={() => setDrawerGlobalSheetOpen(false)}
        leftAction={{ label: "取消", onClick: () => setDrawerGlobalSheetOpen(false) }}
        rightAction={{ label: "完成", onClick: saveDrawerGlobalEvent, emphasize: true }}
      >
        <div className="space-y-4">
          <div className={`rounded-2xl p-1 flex ring-1 ${isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-[#F2F2F7] ring-[#E5E5EA]'}`}>
            {(["停課", "假期"] as const).map((label) => (
              <button
                key={label}
                onClick={() =>
                  setEditingDrawerGlobal((p) => ({
                    ...p,
                    label,
                    leaveReason:
                      label === "停課"
                        ? p.leaveReason || "病假"
                        : undefined,
                  }))
                }
                className={`flex-1 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  editingDrawerGlobal.label === label
                    ? (isDark
                        ? "bg-[#2C2C2E] shadow-sm ring-1 ring-white/10 text-[#F2F2F7]"
                        : "bg-white shadow-sm ring-1 ring-black/5 text-slate-900")
                    : (isDark ? "text-[#8E8E93]" : "text-slate-500")
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <FieldRow label="模式">
            <select
              value={editingDrawerGlobal.mode}
              onChange={(e) =>
                setEditingDrawerGlobal((p) => ({
                  ...p,
                  mode: e.target.value as GlobalEvent["mode"],
                }))
              }
              className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
              }`}
            >
              <option value="allDay">全日</option>
              <option value="timeRange">指定時段</option>
            </select>
          </FieldRow>

          {editingDrawerGlobal.label === "停課" && (
            <FieldRow label="停課原因">
              <select
                value={editingDrawerGlobal.leaveReason || ""}
                onChange={(e) =>
                  setEditingDrawerGlobal((p) => ({
                    ...p,
                    leaveReason: e.target.value as ClosureReason,
                  }))
                }
                className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                  isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                }`}
              >
                <option value="" disabled>
                  請選擇
                </option>
                {closureReasonsSeed.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </FieldRow>
          )}

          {editingDrawerGlobal.mode === "timeRange" && (
            <>
              <FieldRow label="開始">
                <input
                  type="time"
                  value={editingDrawerGlobal.start || ""}
                  onChange={(e) =>
                    setEditingDrawerGlobal((p) => ({
                      ...p,
                      start: e.target.value,
                    }))
                  }
                  className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                    isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                  }`}
                />
              </FieldRow>

              <FieldRow label="結束">
                <input
                  type="time"
                  value={editingDrawerGlobal.end || ""}
                  onChange={(e) =>
                    setEditingDrawerGlobal((p) => ({
                      ...p,
                      end: e.target.value,
                    }))
                  }
                  className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                    isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                  }`}
                />
              </FieldRow>
            </>
          )}

          {currentDrawerGlobalEvent && (
            <button
              onClick={deleteDrawerGlobalEvent}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-bold ring-1 transition ${
                isDark
                  ? 'bg-[#1C1C1E] text-rose-400 ring-white/10 active:bg-[#2C2C2E]'
                  : 'bg-white text-rose-600 ring-[#E5E5EA] active:bg-rose-50'
              }`}
            >
              取消此事件
            </button>
          )}

          <div className={`text-xs px-2 ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>
            設定後，當日課次將依事件模式顯示為停課 / 假期；若是指定時段，只影響重疊的課次。
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={batchEventSheetOpen}
        title="批量設定事件"
        onClose={() => setBatchEventSheetOpen(false)}
        leftAction={{ label: "取消", onClick: () => setBatchEventSheetOpen(false) }}
        rightAction={{ label: "完成", onClick: handleBatchMarkHoliday, emphasize: true }}
      >
        <div className="space-y-4">
          <div className={`rounded-2xl p-1 flex ring-1 ${isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-[#F2F2F7] ring-[#E5E5EA]'}`}>
            {(["停課", "假期"] as const).map((label) => (
              <button
                key={label}
                onClick={() => {
                  setBatchEventLabel(label);
                  setBatchLeaveReason(label === "停課" ? (batchLeaveReason || "病假") : "");
                }}
                className={`flex-1 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  batchEventLabel === label
                    ? (isDark
                        ? "bg-[#2C2C2E] shadow-sm ring-1 ring-white/10 text-[#F2F2F7]"
                        : "bg-white shadow-sm ring-1 ring-black/5 text-slate-900")
                    : (isDark ? "text-[#8E8E93]" : "text-slate-500")
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {batchEventLabel === "停課" && (
            <FieldRow label="停課原因">
              <select
                value={batchLeaveReason}
                onChange={(e) => setBatchLeaveReason(e.target.value as ClosureReason)}
                className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                  isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                }`}
              >
                <option value="" disabled>
                  請選擇
                </option>
                {closureReasonsSeed.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </FieldRow>
          )}

          <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
            isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#D1D1D6]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
          }`}>
            將對目前選取的日期批量建立全日事件。這次先支援全日模式，不處理指定時段。
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={!!sheetAbsentFor}
        title="請假 / 缺席"
        subtitle={
          absentTarget
            ? `${getSessionStudentName(absentTarget)} · ${absentTarget.dateISO} · ${absentTarget.start}–${endTime(absentTarget)}`
            : undefined
        }
        onClose={() => setSheetAbsentFor(null)}
        leftAction={{ label: "取消", onClick: () => setSheetAbsentFor(null) }}
      >
        <div className="space-y-4">
          <div>
            <div className={`text-[12px] font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>（可選）備註</div>
            <textarea
              value={absentNote}
              onChange={(e) => setAbsentNote(e.target.value)}
              placeholder="例如：已通知家長 / 交通延誤..."
              className={`mt-2 w-full min-h-[92px] rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] placeholder:text-[#8E8E93] focus:ring-white/20'
                  : 'bg-white border-[#E5E5EA] text-slate-800 placeholder:text-slate-400 focus:ring-[#C7DAFF]'
              }`}
            />
          </div>

          <div>
            <div className={`text-[12px] font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>缺席原因（點選即完成記錄）</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {reasonsSeed.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    if (!absentTarget) return;
                    void handleMarkStatus(absentTarget.id, "absent", {
                      reason: r,
                      note: absentNote || undefined,
                    }).then((ok) => {
                      if (!ok) return;
                      setToast(`${getSessionStudentName(absentTarget)} ${absentTarget.start} 缺席：${r.name}`);
                      setSheetAbsentFor(null);
                    });
                  }}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.99] ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 text-[#D1D1D6] hover:bg-[#2C2C2E]'
                      : 'bg-[#F2F2F7] border-[#E5E5EA] text-slate-700 hover:bg-[#EDEDF3]'
                  }`}
                >
                  {r.name}
                  <span className={`ml-2 text-xs font-medium ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>{r.code}</span>
                </button>
              ))}
            </div>
            <div className={`mt-2 text-[12px] ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>補課/加課請到每堂右側「…」選單操作。</div>
          </div>
        </div>
      </IOSSheet>

      {sheetEditFor && (
        <IOSSheet
          open={!!sheetEditFor}
          title="編輯課次"
          subtitle={`${getSessionStudentName(sheetEditFor)} · ${sheetEditFor.dateISO}`}
          onClose={() => setSheetEditFor(null)}
          leftAction={{ label: "取消", onClick: () => setSheetEditFor(null) }}
          rightAction={{ label: "完成", onClick: handleEditSubmit, emphasize: true }}
        >
          <div className="space-y-3">
            <FieldRow label="日期">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20'
                    : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
                }`}
              />
            </FieldRow>

            <FieldRow label="開始時間">
              <input
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20'
                    : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
                }`}
              />
            </FieldRow>

            <FieldRow label="時長">
              <DurationInput value={editDuration} onChange={setEditDuration} />
            </FieldRow>

            <FieldRow label="結束時間">
              <div className={`text-sm font-semibold tabular-nums ${isDark ? 'text-[#F2F2F7]' : 'text-slate-800'}`}>
                {addMinutes(editStart, editDuration)}
              </div>
            </FieldRow>

            <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
              isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#D1D1D6]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
            }`}>
              提示：時長可直接輸入分鐘，或用 ± 逐分鐘調整（不設 15 分鐘限制）。
            </div>
          </div>
        </IOSSheet>
      )}

      {sheetMakeupFor && (
        <IOSSheet
          open={!!sheetMakeupFor}
          title={mkPurpose === "makeup" ? "安排補課" : "安排加課"}
          subtitle={`${getSessionStudentName(sheetMakeupFor)} · 原課 ${sheetMakeupFor.dateISO} ${sheetMakeupFor.start}–${endTime({
            ...sheetMakeupFor,
            id: 0,
          } as Session)}`}
          onClose={() => setSheetMakeupFor(null)}
          leftAction={{ label: "取消", onClick: () => setSheetMakeupFor(null) }}
          rightAction={{ label: "完成", onClick: handleMakeupSubmit, emphasize: true }}
        >
          <div className="space-y-3">
            <FieldRow label="日期">
              <input
                type="date"
                value={mkDate}
                onChange={(e) => setMkDate(e.target.value)}
                className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20'
                    : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
                }`}
              />
            </FieldRow>

            <FieldRow label="開始時間">
              <input
                type="time"
                value={mkStart}
                onChange={(e) => setMkStart(e.target.value)}
                className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20'
                    : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
                }`}
              />
            </FieldRow>

            <FieldRow label="用途">
              <select
                value={mkPurpose}
                onChange={(e) => setMkPurpose(e.target.value as "makeup" | "extra")}
                className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20'
                    : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
                }`}
              >
                <option value="makeup">補回本堂</option>
                <option value="extra">額外加課</option>
              </select>
            </FieldRow>

            <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
              isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#D1D1D6]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
            }`}>
              補課不放在請假流程內，避免主流程被低頻操作打斷。
            </div>
          </div>
        </IOSSheet>
      )}

      {sheetDeleteFor && (
        <IOSSheet
          open={!!sheetDeleteFor}
          title="刪除課次"
          subtitle={`確認要刪除 ${getSessionStudentName(sheetDeleteFor)} 的課次嗎？`}
          rightAction={{ label: "刪除", danger: true, onClick: handleDeleteSubmit }}
          onClose={() => setSheetDeleteFor(null)}
        >
          <div className="py-2 text-center text-sm text-slate-500">
            刪除後將無法復原，請確認後操作。
          </div>
        </IOSSheet>
      )}
    </div>
  );
}
