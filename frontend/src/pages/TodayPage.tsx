import { useState, useEffect, useMemo, useRef, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import { updateSession } from "../api/sessionsApi";
import type { SessionUpdatePayload } from "../api/sessionsApi";
import type {
  Session,
  GlobalEvent,
  Reason,
  ClosureReason,
  StudentProfile,
} from "../shared/appShared";
import {
  ThemeContext,
  ThemeToggle,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconBan,
  IconPlus,
  reasonsSeed,
  closureReasonsSeed,
  todayISO,
  addDaysISO,
  formatZHDate,
  timeToMinutes,
  addMinutes,
  endTime,
  pad2,
  roundToNearest15Min,
  getNextSessionId,
  getSessionStudentName,
  checkOverlap,
  formatConflictSummary,
  isSessionCovered,
  getEffectiveStatus,
  getConflictCandidates,
  HeaderBar,
  SegmentedControl,
  SessionCard,
  IOSSheet,
  FieldRow,
  DurationInput,
  Menu,
} from "../shared/appShared";

export interface TodayPageProps {
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  selectedDate: string;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  now: Date;
  students: StudentProfile[];
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  isSessionsBackendAvailable: boolean;
  globalEvents: GlobalEvent[];
  setGlobalEvents: Dispatch<SetStateAction<GlobalEvent[]>>;
  setToast: Dispatch<SetStateAction<string>>;
}

export default function TodayPage({
  setTheme,
  selectedDate,
  setSelectedDate,
  now,
  students,
  sessions,
  setSessions,
  isSessionsBackendAvailable,
  globalEvents,
  setGlobalEvents,
  setToast
}: TodayPageProps) {
  const isDark = useContext(ThemeContext);

  function toSessionStudent(profile: { id: number; name: string }) {
    return {
      id: profile.id,
      name: profile.name,
    };
  }

  const datePickerRef = useRef<HTMLInputElement>(null);

  const currentGlobalEvent = useMemo(() => {
    return globalEvents.find(e => e.dateISO === selectedDate) || null;
  }, [globalEvents, selectedDate]);

  const [globalSheetOpen, setGlobalSheetOpen] = useState(false);
  const [editingGlobal, setEditingGlobal] = useState<GlobalEvent>({
    id: 0, dateISO: "", mode: "allDay", label: "停課"
  });

  const allDaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.dateISO === selectedDate)
      .slice()
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [sessions, selectedDate]);

  const conflictingSessionIds = useMemo(() => {
    const ids = new Set<number>();
    const active = getConflictCandidates(sessions, selectedDate, globalEvents);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (checkOverlap(a, b)) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [sessions, selectedDate, globalEvents]);

  const [filterMode, setFilterMode] = useState<"all" | "pending">("all");

  const visibleSessions = useMemo(() => {
    if (filterMode === "all") return allDaySessions;
    return allDaySessions.filter(
      (s) => getEffectiveStatus(s, currentGlobalEvent) === "pending"
    );
  }, [allDaySessions, filterMode, currentGlobalEvent]);

  const stats = useMemo(() => {
    const total = allDaySessions.length;
    const present = allDaySessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "present").length;
    const absent = allDaySessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "absent").length;
    const pending = allDaySessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "pending").length;
    return { total, present, absent, pending };
  }, [allDaySessions, currentGlobalEvent]);

  const schedulableStudents = useMemo(
    () => students.filter((s) => s.status !== "inactive"),
    [students]
  );

  const [absentOpen, setAbsentOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => sessions.find((x) => x.id === selectedId) ?? null, [sessions, selectedId]);
  const [absentNote, setAbsentNote] = useState<string>("");

  const [makeupOpen, setMakeupOpen] = useState(false);
  const [mkDate, setMkDate] = useState<string>(() => selectedDate);
  const [mkStart, setMkStart] = useState<string>("18:00");
  const [mkPurpose, setMkPurpose] = useState<"makeup" | "extra">("makeup");

  const [editOpen, setEditOpen] = useState(false);
  const [editStart, setEditStart] = useState<string>("14:00");
  const [editDuration, setEditDuration] = useState<number>(60);

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteTarget = useMemo(() => sessions.find((x) => x.id === deleteId) ?? null, [sessions, deleteId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStudentId, setCreateStudentId] = useState<number>(
    () => students.find((s) => s.status !== "inactive")?.id ?? 0
  );
  const [createDate, setCreateDate] = useState<string>(selectedDate);
  const [createStart, setCreateStart] = useState<string>("10:00");
  const [createDuration, setCreateDuration] = useState<number>(60);

  useEffect(() => {
    setMenuOpenId(null);
    setAbsentOpen(false);
    setMakeupOpen(false);
    setEditOpen(false);
    setDeleteOpen(false);
    setCreateOpen(false);
    setGlobalSheetOpen(false); 

    setSelectedId(null);
    setAbsentNote(""); 
    setCreateDate(selectedDate); 
  }, [selectedDate]);

  function openGlobalSheet() {
    if (currentGlobalEvent) {
      setEditingGlobal({ ...currentGlobalEvent });
    } else {
      setEditingGlobal({
        id: Date.now(),
        dateISO: selectedDate,
        mode: "allDay",
        label: "停課",
        leaveReason: "病假",
        start: "14:00",
        end: "18:00"
      });
    }
    setGlobalSheetOpen(true);
  }

  function saveGlobalEvent() {
    if (!editingGlobal.label.trim()) {
      setToast("請輸入事件名稱");
      return;
    }

    if (editingGlobal.label === "停課" && !editingGlobal.leaveReason) {
      setToast("請選擇停課原因");
      return;
    }

    if (editingGlobal.mode === "timeRange") {
      if (!editingGlobal.start || !editingGlobal.end) {
        setToast("請輸入完整的開始與結束時間");
        return;
      }
      if (timeToMinutes(editingGlobal.start) >= timeToMinutes(editingGlobal.end)) {
        setToast("全局事件時間區間不合法（開始必須早於結束）");
        return;
      }
    }

  const normalizedEvent: GlobalEvent = {
    ...editingGlobal,
    start: editingGlobal.mode === "timeRange" ? editingGlobal.start : undefined,
    end: editingGlobal.mode === "timeRange" ? editingGlobal.end : undefined,
    leaveReason:
      editingGlobal.label === "停課"
        ? editingGlobal.leaveReason
        : undefined,
  };

    setGlobalEvents(prev => {
      const filtered = prev.filter(e => e.dateISO !== normalizedEvent.dateISO);
      return [...filtered, normalizedEvent];
    });

    setGlobalSheetOpen(false);
    setToast(
      normalizedEvent.label === "停課" && normalizedEvent.leaveReason
        ? `已設定：${normalizedEvent.label} · ${normalizedEvent.leaveReason}`
        : `已設定：${normalizedEvent.label}`
    );
  }

  function deleteGlobalEvent() {
    setGlobalEvents(prev => prev.filter(e => e.dateISO !== selectedDate));
    setGlobalSheetOpen(false);
    setToast("已取消全局事件");
  }

  function patchSession(id: number, patch: Partial<Session>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  type AttendancePatch = {
    status?: Session["status"];
    reason?: Reason | string | null;
    note?: string | null;
  };

  function toBackendAttendancePatch(patch: AttendancePatch): SessionUpdatePayload {
    const payload: SessionUpdatePayload = {};

    if (patch.status) payload.status = patch.status;
    if ("reason" in patch) {
      payload.reason =
        typeof patch.reason === "string"
          ? patch.reason
          : patch.reason
          ? patch.reason.name
          : null;
    }
    if ("note" in patch) {
      payload.note = patch.note || null;
    }

    return payload;
  }

  function toLocalAttendancePatch(patch: AttendancePatch): Partial<Session> {
    return {
      ...(patch.status ? { status: patch.status } : {}),
      ...("reason" in patch
        ? { reason: typeof patch.reason === "string" || patch.reason == null ? undefined : patch.reason }
        : {}),
      ...("note" in patch ? { note: patch.note || undefined } : {}),
    };
  }

  async function updateAttendanceSession(
    session: Session,
    patch: AttendancePatch,
    successToast: string,
    onSuccess?: () => void
  ) {
    if (!isSessionsBackendAvailable) {
      patchSession(session.id, toLocalAttendancePatch(patch));
      setToast(successToast);
      onSuccess?.();
      return;
    }

    try {
      const updated = await updateSession(session.id, toBackendAttendancePatch(patch));
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setToast(successToast);
      onSuccess?.();
    } catch (error) {
      console.warn("Backend session update failed", error);
      setToast("點名更新失敗，請確認後端是否正常");
    }
  }

  function requestDelete(id: number) {
    setMenuOpenId(null);
    setDeleteId(id);
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const kindText = deleteTarget.kind === "makeup" ? "補課" : deleteTarget.kind === "extra" ? "加課" : "課次";
    
    const linkedMakeups = sessions.filter(s => s.makeupOfSessionId === deleteTarget.id);
    const detachedCount = linkedMakeups.length;

    setSessions((prev) => {
      return prev.filter((s) => s.id !== deleteTarget.id).map(s => {
        if (s.makeupOfSessionId === deleteTarget.id) {
          return { ...s, makeupOfSessionId: undefined, makeupOfDateISO: undefined };
        }
        return s;
      });
    });

    if (selectedId === deleteTarget.id) setSelectedId(null);
    setToast(detachedCount > 0 ? `已刪除${kindText}，並解除 ${detachedCount} 堂補課關聯` : `已刪除${kindText}`);
    setDeleteOpen(false);
  }

  function openAbsent(id: number) {
    setSelectedId(id);
    setAbsentNote("");
    setAbsentOpen(true);
  }

  function saveAbsentByReason(reason: Reason) {
    if (!selected) return;
    void updateAttendanceSession(
      selected,
      { status: "absent", reason, note: absentNote || null },
      `${getSessionStudentName(selected)} ${selected.start} 缺席：${reason.name}`,
      () => setAbsentOpen(false)
    );
  }

  function openMakeupFromMenu(id: number, purpose: "makeup" | "extra") {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;

    if (s.studentId == null) {
      setToast("找不到學生主檔，無法安排補課或加課");
      return;
    }

    const linkedStudent = students.find((student) => student.id === s.studentId);

    if (!linkedStudent) {
      setToast("找不到學生主檔，無法安排補課或加課");
      return;
    }

    if (linkedStudent.status === "inactive") {
      setToast("已停用學生不可安排補課或加課");
      return;
    }

    setSelectedId(id);
    setMkDate(selectedDate);
    setMkStart(endTime(s));
    setMkPurpose(purpose);
    setMakeupOpen(true);
  }

  function createMakeup() {
    if (!selected) return;

    if (selected.studentId == null) {
      setToast("找不到學生主檔，無法安排補課或加課");
      return;
    }

    const linkedStudent = students.find((s) => s.id === selected.studentId);

    if (!linkedStudent) {
      setToast("找不到學生主檔，無法安排補課或加課");
      return;
    }

    if (linkedStudent.status === "inactive") {
      setToast("已停用學生不可安排補課或加課");
      return;
    }

    const nextId = getNextSessionId(sessions);
    
    const newSession: Session = {
      id: nextId,
      studentId: selected.studentId,
      student: toSessionStudent(linkedStudent),
      dateISO: mkDate,
      start: mkStart,
      durationMin: 60,
      status: "pending",
      kind: mkPurpose === "makeup" ? "makeup" : "extra",
      makeupOfDateISO: mkPurpose === "makeup" ? selected.dateISO : undefined,
      makeupOfSessionId: mkPurpose === "makeup" ? selected.id : undefined,
    };

    const candidates = getConflictCandidates(sessions, mkDate, globalEvents);
    const conflicts = candidates.filter(other => checkOverlap(newSession, other));

    setSessions((prev) => [...prev, newSession]);
    
    if (conflicts.length > 0) {
    setToast(formatConflictSummary([newSession, ...conflicts]));
    } else {
    setToast(mkPurpose === "makeup" ? "已建立補課" : "已建立加課");
    }
    setMakeupOpen(false);
  }

  function openEditFromMenu(id: number) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(id);
    setEditStart(s.start);
    setEditDuration(s.durationMin);
    setEditOpen(true);
  }

  function saveEdit() {
    if (!selected) return;
    const clamped = Math.min(120, Math.max(1, editDuration || 1));
    const nextSession = { ...selected, start: editStart, durationMin: clamped };
    
    const candidates = getConflictCandidates(sessions, selected.dateISO, globalEvents);
    const conflicts = candidates.filter(s => s.id !== selected.id && checkOverlap(nextSession, s));

    patchSession(selected.id, { start: editStart, durationMin: clamped });
    
    if (conflicts.length > 0) {
        setToast(formatConflictSummary([nextSession, ...conflicts]));
    } else {
        setToast("已更新課次");
    }
    setEditOpen(false);
  }

  function openCreateSheet() {
    if (schedulableStudents.length === 0) {
      setToast("請先新增學生");
      return;
    }

    setCreateStudentId(schedulableStudents[0].id);
    setCreateDate(selectedDate);
    setCreateStart(roundToNearest15Min());
    setCreateDuration(60);
    setCreateOpen(true);
  }

  function handleCreateSession() {
    const student = schedulableStudents.find((s) => s.id === createStudentId);

    if (!student || student.status === "inactive") {
      setToast("已停用學生不可新增排課");
      return;
    }

    const clamped = Math.min(120, Math.max(1, createDuration || 1));
    const nextId = getNextSessionId(sessions);
    const newSession: Session = {
      id: nextId,
      studentId: student.id,
      student: toSessionStudent(student),
      dateISO: createDate,
      start: createStart,
      durationMin: clamped,
      status: "pending",
      kind: "extra",
    };

    const candidates = getConflictCandidates(sessions, createDate, globalEvents);
    const conflicts = candidates.filter(other => checkOverlap(newSession, other));

    setSessions(prev => [...prev, newSession]);
    
    if (conflicts.length > 0) {
        setToast(formatConflictSummary([newSession, ...conflicts]));
    } else {
        setToast("已新增課次");
    }
    setCreateOpen(false);
  }

  function formatGlobalAlert(event: GlobalEvent | null) {
    if (!event) return undefined;
    if (event.label === "停課" && event.leaveReason) {
      return `${event.label} · ${event.leaveReason}`;
    }
    return event.label;
  }

  return (
    <>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <HeaderBar
          title="出席紀錄系統"
          icon={<IconCalendar className="h-6 w-6" />}
          right={
            <ThemeToggle
              isDark={isDark}
              interactive={true}
              onSelect={(next) => setTheme(next)}
            />
          }
        />

        <div className={`mt-5 rounded-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 px-3 py-2 ${
          isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-white ring-[#E5E5EA]'
        }`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedDate((d) => addDaysISO(d, -1))}
              className={`h-10 w-10 rounded-2xl flex items-center justify-center active:scale-[0.98] ${
                isDark ? 'text-[#8E8E93] hover:bg-[#2C2C2E]' : 'text-slate-600 hover:bg-[#F2F2F7]'
              }`}
              aria-label="上一天"
            >
              <IconChevronLeft className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center relative">
              <button
                onClick={() => {
                  const input = datePickerRef.current as any;
                  if (input) {
                    if (typeof input.showPicker === 'function') {
                      input.showPicker();
                    } else {
                      input.click();
                    }
                  }
                }}
                className={`text-[18px] font-bold active:opacity-50 transition-opacity ${
                  isDark ? 'text-[#F2F2F7]' : 'text-slate-800'
                }`}
                aria-label="選擇日期"
              >
                {formatZHDate(selectedDate)}
              </button>
              
              <input
                ref={datePickerRef}
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10"
                tabIndex={-1}
              />

              {selectedDate !== todayISO() && (
                <button
                  onClick={() => setSelectedDate(todayISO())}
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold active:scale-95 transition ${
                    isDark ? 'bg-[#2C2C2E] text-[#D1D1D6]' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  回到今天
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedDate((d) => addDaysISO(d, 1))}
              className={`h-10 w-10 rounded-2xl flex items-center justify-center active:scale-[0.98] ${
                isDark ? 'text-[#8E8E93] hover:bg-[#2C2C2E]' : 'text-slate-600 hover:bg-[#F2F2F7]'
              }`}
              aria-label="下一天"
            >
              <IconChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="mt-4 px-1">
          {currentGlobalEvent ? (
            <button
              onClick={openGlobalSheet}
              className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold ring-1 active:scale-[0.99] transition ${
                isDark ? 'bg-amber-900/20 text-amber-300 ring-amber-500/30' : 'bg-amber-50 text-amber-800 ring-amber-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconBan className="h-4 w-4" />
                已設定：{currentGlobalEvent.label}
                {currentGlobalEvent.label === "停課" && currentGlobalEvent.leaveReason ? ` · ${currentGlobalEvent.leaveReason}` : ""}
                {currentGlobalEvent.mode === "timeRange" &&
                  currentGlobalEvent.start &&
                  currentGlobalEvent.end && (
                    <span className="text-xs font-normal opacity-80">
                      ({currentGlobalEvent.start}–{currentGlobalEvent.end})
                    </span>
                )}
                {currentGlobalEvent.mode === "allDay" && (
                  <span className="text-xs font-normal opacity-80">(全日)</span>
                )}
              </span>
              <span className={`text-xs font-bold ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>編輯</span>
            </button>
          ) : (
            <button
              onClick={openGlobalSheet}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                isDark ? 'text-[#8E8E93] hover:bg-[#1C1C1E]' : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <IconBan className="h-3.5 w-3.5" />
              設定停課/假期
            </button>
          )}
        </div>

        <div className={`mt-3 flex flex-wrap items-center gap-6 text-[13px] ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>
          <div>
            今日排程：<span className={`font-semibold ${isDark ? 'text-[#F2F2F7]' : 'text-slate-800'}`}>{stats.total}</span> 堂
          </div>
          <div className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
            已到：<span className="font-semibold">{stats.present}</span>
          </div>
          <div className={isDark ? 'text-rose-400' : 'text-rose-700'}>
            缺席：<span className="font-semibold">{stats.absent}</span>
          </div>
          <div className={isDark ? 'text-[#8E8E93]' : 'text-slate-400'}>
            未定：<span className="font-semibold">{stats.pending}</span>
          </div>
          <div className={`ml-auto ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>
            現在：{pad2(now.getHours())}:{pad2(now.getMinutes())}
          </div>
        </div>

        <div className="mt-4">
          <SegmentedControl
            value={filterMode}
            onChange={setFilterMode}
            options={[
              { value: "all", label: "全部" },
              { value: "pending", label: "待確認" },
            ]}
          />
        </div>

        <div className="mt-6 space-y-8">
          <div className="space-y-4">
            <div className={`px-1 text-sm font-bold ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>
              未完成點名 ({visibleSessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "pending").length})
            </div>
            {visibleSessions.length === 0 ? (
              <div className={`rounded-[24px] border border-dashed py-6 text-center text-sm ${
                isDark ? 'border-white/10 bg-[#1C1C1E]/50 text-[#8E8E93]' : 'border-slate-300 bg-white/50 text-slate-400'
              }`}>
                今日沒有課次
              </div>
            ) : visibleSessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "pending").length === 0 ? (
              <div className={`rounded-[24px] border border-dashed py-6 text-center text-sm ${
                isDark ? 'border-white/10 bg-[#1C1C1E]/50 text-[#8E8E93]' : 'border-slate-300 bg-white/50 text-slate-400'
              }`}>
                今日已全部完成
              </div>
            ) : (
              visibleSessions
                .filter((s) => getEffectiveStatus(s, currentGlobalEvent) === "pending")
                .map((s) => (
                  <div key={s.id} className="relative">
                    <SessionCard
                      s={s}
                      effectiveStatus={getEffectiveStatus(s, currentGlobalEvent)}
                      hasConflict={conflictingSessionIds.has(s.id)}
                      globalAlert={isSessionCovered(s, currentGlobalEvent) ? formatGlobalAlert(currentGlobalEvent) : undefined}
                      onPresent={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        void updateAttendanceSession(
                          s,
                          { status: "present", reason: null, note: null },
                          `${getSessionStudentName(s)} ${s.start} 已到`
                        );
                      }}
                      onAbsent={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        openAbsent(s.id);
                      }}
                      onReset={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        void updateAttendanceSession(
                          s,
                          { status: "pending", reason: null, note: null },
                          "已撤銷，回到未點名"
                        );
                      }}
                      onOpenMenu={() => setMenuOpenId((cur) => (cur === s.id ? null : s.id))}
                    />
                    <Menu
                    open={menuOpenId === s.id}
                    onClose={() => setMenuOpenId(null)}
                    items={[
                        {
                        label: "編輯課次（時間 / 時長）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openEditFromMenu(s.id);
                        },
                        },
                        {
                        label: "安排補課（補回本堂）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openMakeupFromMenu(s.id, "makeup");
                        },
                        },
                        {
                        label: "額外加課（不抵扣缺席）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openMakeupFromMenu(s.id, "extra");
                        },
                        },
                        {
                        label: s.kind === "makeup" ? "刪除此補課" : s.kind === "extra" ? "刪除此加課" : "刪除此課次",
                        onClick: () => {
                            setMenuOpenId(null);
                            requestDelete(s.id);
                        },
                        danger: true,
                        },
                        {
                        label: s.status === "cancelled" ? "取消停課" : "標記停課",
                        onClick: () => {
                            setMenuOpenId(null);
                            void updateAttendanceSession(
                              s,
                              {
                                status: s.status === "cancelled" ? "pending" : "cancelled",
                                reason: null,
                                note: null,
                              },
                              s.status === "cancelled" ? "已取消停課" : "已標記停課"
                            );
                        },
                        danger: true,
                        },
                    ]}
                    />
                  </div>
                ))
            )}
          </div>

          {visibleSessions.filter((s) => getEffectiveStatus(s, currentGlobalEvent) !== "pending").length > 0 && (
            <div className="space-y-4">
              <div className={`px-1 text-sm font-bold ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>已完成 / 其他</div>
              {visibleSessions
                .filter((s) => getEffectiveStatus(s, currentGlobalEvent) !== "pending")
                .map((s) => (
                  <div key={s.id} className="relative">
                    <SessionCard
                      s={s}
                      effectiveStatus={getEffectiveStatus(s, currentGlobalEvent)}
                      hasConflict={conflictingSessionIds.has(s.id)}
                      globalAlert={isSessionCovered(s, currentGlobalEvent) ? formatGlobalAlert(currentGlobalEvent) : undefined}
                      onPresent={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        void updateAttendanceSession(
                          s,
                          { status: "present", reason: null, note: null },
                          `${getSessionStudentName(s)} ${s.start} 已到`
                        );
                      }}
                      onAbsent={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        openAbsent(s.id);
                      }}
                      onReset={() => {
                        if (isSessionCovered(s, currentGlobalEvent)) {
                          setToast(`⚠️ 本節已被「${formatGlobalAlert(currentGlobalEvent)}」覆蓋，已鎖定操作`);
                          return;
                        }
                        void updateAttendanceSession(
                          s,
                          { status: "pending", reason: null, note: null },
                          "已撤銷，回到未點名"
                        );
                      }}
                      onOpenMenu={() => setMenuOpenId((cur) => (cur === s.id ? null : s.id))}
                    />
                    <Menu
                    open={menuOpenId === s.id}
                    onClose={() => setMenuOpenId(null)}
                    items={[
                        {
                        label: "編輯課次（時間 / 時長）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openEditFromMenu(s.id);
                        },
                        },
                        {
                        label: "安排補課（補回本堂）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openMakeupFromMenu(s.id, "makeup");
                        },
                        },
                        {
                        label: "額外加課（不抵扣缺席）",
                        onClick: () => {
                            setMenuOpenId(null);
                            openMakeupFromMenu(s.id, "extra");
                        },
                        },
                        {
                        label: s.kind === "makeup" ? "刪除此補課" : s.kind === "extra" ? "刪除此加課" : "刪除此課次",
                        onClick: () => {
                            setMenuOpenId(null);
                            requestDelete(s.id);
                        },
                        danger: true,
                        },
                        {
                        label: s.status === "cancelled" ? "取消停課" : "標記停課",
                        onClick: () => {
                            setMenuOpenId(null);
                            void updateAttendanceSession(
                              s,
                              {
                                status: s.status === "cancelled" ? "pending" : "cancelled",
                                reason: null,
                                note: null,
                              },
                              s.status === "cancelled" ? "已取消停課" : "已標記停課"
                            );
                        },
                        danger: true,
                        },
                    ]}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={openCreateSheet}
        className="fixed bottom-24 right-5 h-14 w-14 rounded-full bg-[#007AFF] shadow-lg shadow-blue-500/30 flex items-center justify-center text-white active:scale-95 transition z-40"
        aria-label="新增課次"
      >
        <IconPlus className="h-8 w-8" />
      </button>

      <IOSSheet
        open={absentOpen}
        title="請假 / 缺席"
        subtitle={selected ? `${getSessionStudentName(selected)} · ${selected.dateISO} · ${selected.start}–${endTime(selected)}` : undefined}
        onClose={() => setAbsentOpen(false)}
        leftAction={{ label: "取消", onClick: () => setAbsentOpen(false) }}
      >
        <div className="space-y-4">
          <div>
            <div className={`text-[12px] font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>（可選）備註</div>
            <textarea
              value={absentNote}
              onChange={(e) => setAbsentNote(e.target.value)}
              placeholder="例如：已通知家長 / 交通延誤..."
              className={`mt-2 w-full min-h-[92px] rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] placeholder:text-[#8E8E93] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 placeholder:text-slate-400 focus:ring-[#C7DAFF]'
              }`}
            />
          </div>

          <div>
            <div className={`text-[12px] font-semibold ${isDark ? 'text-[#8E8E93]' : 'text-slate-500'}`}>缺席原因（點選即完成記錄）</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {reasonsSeed.map((r) => (
                <button
                  key={r.id}
                  onClick={() => saveAbsentByReason(r)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.99] ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 text-[#D1D1D6] hover:bg-[#2C2C2E]' : 'bg-[#F2F2F7] border-[#E5E5EA] text-slate-700 hover:bg-[#EDEDF3]'
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

      <IOSSheet
        open={makeupOpen}
        title={mkPurpose === "makeup" ? "安排補課" : "安排加課"}
        subtitle={selected ? `${getSessionStudentName(selected)} · 原課 ${selected.dateISO} ${selected.start}–${endTime(selected)}` : undefined}
        onClose={() => setMakeupOpen(false)}
        leftAction={{ label: "取消", onClick: () => setMakeupOpen(false) }}
        rightAction={{ label: "完成", onClick: createMakeup, emphasize: true }}
      >
        <div className="space-y-3">
          <FieldRow label="日期">
            <input
              type="date"
              value={mkDate}
              onChange={(e) => setMkDate(e.target.value)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
              }`}
            />
          </FieldRow>

          <FieldRow label="開始時間">
            <input
              type="time"
              value={mkStart}
              onChange={(e) => setMkStart(e.target.value)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
              }`}
            />
          </FieldRow>

          <FieldRow label="用途">
            <select
              value={mkPurpose}
              onChange={(e) => setMkPurpose(e.target.value as any)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
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

      <IOSSheet
        open={editOpen}
        title="編輯課次"
        subtitle={selected ? `${getSessionStudentName(selected)} · ${selected.dateISO}` : undefined}
        onClose={() => setEditOpen(false)}
        leftAction={{ label: "取消", onClick: () => setEditOpen(false) }}
        rightAction={{ label: "完成", onClick: saveEdit, emphasize: true }}
      >
        <div className="space-y-3">
          <FieldRow label="開始時間">
            <input
              type="time"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
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

      <IOSSheet
        open={deleteOpen}
        title="刪除課次？"
        subtitle={
          deleteTarget
            ? `${getSessionStudentName(deleteTarget)} · ${deleteTarget.dateISO} · ${deleteTarget.start}–${endTime(deleteTarget)}`
            : undefined
        }
        onClose={() => setDeleteOpen(false)}
        leftAction={{ label: "取消", onClick: () => setDeleteOpen(false) }}
        rightAction={{ label: "刪除", onClick: confirmDelete, danger: true }}
      >
        <div className="space-y-3">
          <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
            isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#D1D1D6]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-700'
          }`}>
            這個操作無法復原。確認要刪除{deleteTarget?.kind === "makeup" ? "補課" : deleteTarget?.kind === "extra" ? "加課" : "課次"}嗎？
          </div>

          <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
            isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#8E8E93]' : 'bg-white ring-[#E5E5EA] text-slate-600'
          }`}>
            {deleteTarget?.kind === "regular"
              ? "這是常規排程。若只是今天不上課、仍想保留排程與歷史紀錄，建議用「標記停課」。"
              : "若你想保留記錄但不授課，建議用「標記停課」。"}
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={createOpen}
        title="新增臨時課次"
        onClose={() => setCreateOpen(false)}
        leftAction={{ label: "取消", onClick: () => setCreateOpen(false) }}
        rightAction={{ label: "新增", onClick: handleCreateSession, emphasize: true }}
      >
        <div className="space-y-3">
          <FieldRow label="學生">
             <select
              value={createStudentId}
              onChange={(e) => setCreateStudentId(Number(e.target.value))}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
              }`}
            >
              {schedulableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="日期">
            <input
              type="date"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
              }`}
            />
          </FieldRow>

          <FieldRow label="開始時間">
            <input
              type="time"
              value={createStart}
              onChange={(e) => setCreateStart(e.target.value)}
              className={`rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isDark ? 'bg-[#1C1C1E] border-white/10 text-[#F2F2F7] focus:ring-white/20' : 'bg-white border-[#E5E5EA] text-slate-800 focus:ring-[#C7DAFF]'
              }`}
            />
          </FieldRow>

          <FieldRow label="時長">
            <DurationInput value={createDuration} onChange={setCreateDuration} />
          </FieldRow>

          <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
            isDark ? 'bg-[#1C1C1E] ring-white/10 text-[#8E8E93]' : 'bg-[#F2F2F7] ring-[#E5E5EA] text-slate-600'
          }`}>
            將新增為「額外加課」（Extra）。時長可直接輸入分鐘數，或用 ± 微調。
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={globalSheetOpen}
        title="設定全局事件"
        onClose={() => setGlobalSheetOpen(false)}
        leftAction={{ label: "取消", onClick: () => setGlobalSheetOpen(false) }}
        rightAction={{ label: "完成", onClick: saveGlobalEvent, emphasize: true }}
      >
        <div className="space-y-4">
          <div className={`rounded-2xl p-1 flex ring-1 ${isDark ? 'bg-[#1C1C1E] ring-white/10' : 'bg-[#F2F2F7] ring-[#E5E5EA]'}`}>
            {(["停課", "假期"] as const).map(l => (
              <button
                key={l}
                onClick={() =>
                  setEditingGlobal(p => ({
                    ...p,
                    label: l,
                    leaveReason: l === "停課" ? (p.leaveReason || "病假") : undefined,
                  }))
                }
                className={`flex-1 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  editingGlobal.label === l 
                    ? (isDark ? "bg-[#2C2C2E] shadow-sm ring-1 ring-white/10 text-[#F2F2F7]" : "bg-white shadow-sm ring-1 ring-black/5 text-slate-900") 
                    : (isDark ? "text-[#8E8E93]" : "text-slate-500")
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <FieldRow label="模式">
            <select
              value={editingGlobal.mode}
              onChange={e => setEditingGlobal(p => ({ ...p, mode: e.target.value as any }))}
              className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
              }`}
            >
              <option value="allDay">全日</option>
              <option value="timeRange">指定時段</option>
            </select>
          </FieldRow>

          {editingGlobal.label === "停課" && (
            <FieldRow label="停課原因">
              <select
                value={editingGlobal.leaveReason || ""}
                onChange={e =>
                  setEditingGlobal(p => ({
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
                {closureReasonsSeed.map(reason => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </FieldRow>
          )}

          {editingGlobal.mode === "timeRange" && (
            <>
              <FieldRow label="開始">
                <input
                  type="time"
                  value={editingGlobal.start || ""}
                  onChange={e => setEditingGlobal(p => ({ ...p, start: e.target.value }))}
                  className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                    isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                  }`}
                />
              </FieldRow>
              <FieldRow label="結束">
                <input
                  type="time"
                  value={editingGlobal.end || ""}
                  onChange={e => setEditingGlobal(p => ({ ...p, end: e.target.value }))}
                  className={`bg-transparent text-sm font-semibold focus:outline-none text-right ${
                    isDark ? 'text-[#F2F2F7]' : 'text-slate-900'
                  }`}
                />
              </FieldRow>
            </>
          )}

          {currentGlobalEvent && (
            <button
              onClick={deleteGlobalEvent}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-bold ring-1 transition ${
                isDark ? 'bg-[#1C1C1E] text-rose-400 ring-white/10 active:bg-[#2C2C2E]' : 'bg-white text-rose-600 ring-[#E5E5EA] active:bg-rose-50'
              }`}
            >
              取消此事件
            </button>
          )}
          
          <div className={`text-xs px-2 ${isDark ? 'text-[#8E8E93]' : 'text-slate-400'}`}>
            {editingGlobal.mode === "allDay"
              ? `設定後，當日課次將標記為${editingGlobal.label}，並防止誤按出席/缺席。`
              : `設定後，僅重疊時段內的課次將標記為${editingGlobal.label}，並防止誤按出席/缺席。`}
          </div>
        </div>
      </IOSSheet>
    </>
  );
}
