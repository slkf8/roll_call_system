import { useContext, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createStudent } from "../api/studentsApi";
import type { Session, StudentProfile, StudentScheduleRule } from "../shared/appShared";
import {
  studentProfilesSeed,
  todayISO,
  ThemeContext,
  HeaderBar,
  SegmentedControl,
  IOSSheet,
  FieldRow,
  DurationInput,
  Menu,
  IconUsers,
} from "../shared/appShared";

type StudentFilter = "all" | "active" | "scheduled_deactivation" | "inactive";
type EditorMode = "create" | "edit";
type RuleEditorMode = "create" | "edit";

type PendingAction =
  | { kind: "deactivate_immediate"; student: StudentProfile }
  | { kind: "deactivate_scheduled"; student: StudentProfile; date: string }
  | { kind: "restore"; student: StudentProfile };

type DraftStudent = {
  id?: number;
  name: string;
  birthday: string;
  school: string;
};

type RuleDraft = {
  weekday: StudentScheduleRule["weekday"];
  start: string;
  durationMin: number;
  isActive: boolean;
};

type StudentsPageProps = {
  selectedDate?: string;
  students?: StudentProfile[];
  setStudents?: Dispatch<SetStateAction<StudentProfile[]>>;
  isStudentsBackendAvailable?: boolean;
  studentScheduleRules?: StudentScheduleRule[];
  setStudentScheduleRules?: Dispatch<SetStateAction<StudentScheduleRule[]>>;
  sessions?: Session[];
  setSessions?: Dispatch<SetStateAction<Session[]>>;
  setToast?: Dispatch<SetStateAction<string>>;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getNextStudentId(list: StudentProfile[]) {
  return list.reduce((max, item) => Math.max(max, item.id), 1000) + 1;
}

function getNextRuleId(list: StudentScheduleRule[]) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function getNextSessionId(list: Session[]) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function toSessionStudent(profile: { id: number; name: string }) {
  return {
    id: profile.id,
    name: profile.name,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getMonthRemainingDates(anchorISO: string) {
  const [year, month, day] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month || !day) return [];

  const cursor = new Date(year, month - 1, day);
  if (Number.isNaN(cursor.getTime())) return [];

  const dates: Array<{ date: Date; dateISO: string }> = [];
  const targetMonth = cursor.getMonth();

  while (cursor.getMonth() === targetMonth) {
    dates.push({
      date: new Date(cursor),
      dateISO: formatDateISO(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function isWithinMonthRemaining(dateISO: string, anchorISO: string) {
  const [year, month, day] = anchorISO.split("-").map((item) => Number(item));
  if (!year || !month || !day) return false;

  const endOfMonth = new Date(year, month, 0);
  const endISO = formatDateISO(endOfMonth);
  const monthPrefix = `${year}-${pad2(month)}-`;

  return dateISO.startsWith(monthPrefix) && dateISO >= anchorISO && dateISO <= endISO;
}

function formatWeekdayLabel(weekday: StudentScheduleRule["weekday"]) {
  const labels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"] as const;
  return labels[weekday];
}

function createDefaultRuleDraft(): RuleDraft {
  return {
    weekday: 1,
    start: "16:00",
    durationMin: 60,
    isActive: true,
  };
}

function formatStatus(status: StudentProfile["status"]) {
  if (status === "active") return "啟用中";
  if (status === "scheduled_deactivation") return "已設定停用";
  return "已停用";
}

function getStatusBadgeClasses(isDark: boolean, status: StudentProfile["status"]) {
  if (status === "active") {
    return isDark
      ? "bg-[#0A84FF]/16 text-[#4DA3FF] ring-1 ring-[#0A84FF]/25"
      : "bg-[#007AFF]/10 text-[#007AFF] ring-1 ring-[#007AFF]/15";
  }

  if (status === "scheduled_deactivation") {
    return isDark
      ? "bg-amber-500/14 text-amber-300 ring-1 ring-amber-500/20"
      : "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20";
  }

  return isDark
    ? "bg-[#2C2C2E] text-[#8E8E93] ring-1 ring-white/5"
    : "bg-[#F2F2F7] text-[#636366] ring-1 ring-[#E5E5EA]";
}

function matchesQuery(student: StudentProfile, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [student.name, student.birthday, student.school, String(student.id)].some((value) =>
    value.toLowerCase().includes(q)
  );
}

function findDuplicates(list: StudentProfile[], draft: DraftStudent, excludeId?: number) {
  return list.filter(
    (item) =>
      item.id !== excludeId &&
      item.name.trim() === draft.name.trim() &&
      item.birthday.trim() === draft.birthday.trim()
  );
}

function statusDescription(student: StudentProfile) {
  if (student.status === "scheduled_deactivation" && student.deactivateOn) {
    return `將於 ${student.deactivateOn} 起停用，並移除當日及之後的已排課課次`;
  }

  if (student.status === "inactive") {
    return "已停用，不可用於新增排課";
  }

  return "";
}

export default function StudentsPage({
  selectedDate,
  students,
  setStudents,
  isStudentsBackendAvailable = false,
  studentScheduleRules,
  setStudentScheduleRules,
  sessions,
  setSessions,
  setToast,
}: StudentsPageProps) {
  const isDark = useContext(ThemeContext);

  const [localStudents, setLocalStudents] = useState<StudentProfile[]>(studentProfilesSeed);
  const [localRules, setLocalRules] = useState<StudentScheduleRule[]>([]);

  const safeStudents = students ?? localStudents;
  const safeSetStudents = setStudents ?? setLocalStudents;
  const safeRules = studentScheduleRules ?? localRules;
  const safeSetRules = setStudentScheduleRules ?? setLocalRules;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StudentFilter>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [draft, setDraft] = useState<DraftStudent>({
    name: "",
    birthday: "",
    school: "",
  });

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateList, setDuplicateList] = useState<StudentProfile[]>([]);
  const [pendingDraftSave, setPendingDraftSave] = useState<(() => void | Promise<void>) | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledDateError, setScheduledDateError] = useState("");

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [ruleEditorMode, setRuleEditorMode] = useState<RuleEditorMode>("create");
  const [editingRule, setEditingRule] = useState<StudentScheduleRule | null>(null);
  const [ruleOwnerStudent, setRuleOwnerStudent] = useState<StudentProfile | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(createDefaultRuleDraft());
  const [ruleDeleteTarget, setRuleDeleteTarget] = useState<StudentScheduleRule | null>(null);
  const [ruleDeleteOpen, setRuleDeleteOpen] = useState(false);

  const todayStr = todayISO();

  function getCurrentHHMM() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isFutureLinkedSession(session: Session, studentId: number) {
    if (session.studentId !== studentId) return false;

    const nowHHMM = getCurrentHHMM();

    return (
      session.dateISO > todayStr ||
      (session.dateISO === todayStr && session.start >= nowHHMM)
    );
  }

  function countImmediateImpactedSessions(studentId: number) {
    if (!sessions) return null;
    return sessions.filter((session) => isFutureLinkedSession(session, studentId)).length;
  }

  function countScheduledImpactedSessions(studentId: number, dateISO: string) {
    if (!sessions || !dateISO) return null;
    return sessions.filter(
      (session) => session.studentId === studentId && session.dateISO >= dateISO
    ).length;
  }

  function syncLinkedSessionNames(studentId: number, nextName: string) {
    if (!setSessions) return;

    setSessions((current) =>
      current.map((item) =>
        item.studentId === studentId
          ? {
              ...item,
              student: {
                ...item.student,
                name: nextName,
              },
            }
          : item
      )
    );
  }

  function removeImmediateLinkedSessions(studentId: number) {
    if (!sessions || !setSessions) return 0;

    const impacted = sessions.filter((session) =>
      isFutureLinkedSession(session, studentId)
    ).length;

    setSessions((current) =>
      current.filter((session) => !isFutureLinkedSession(session, studentId))
    );

    return impacted;
  }

  function removeScheduledLinkedSessions(studentId: number, dateISO: string) {
    if (!sessions || !setSessions || !dateISO) return 0;

    const impacted = sessions.filter(
      (session) => session.studentId === studentId && session.dateISO >= dateISO
    ).length;

    setSessions((current) =>
      current.filter(
        (session) => !(session.studentId === studentId && session.dateISO >= dateISO)
      )
    );

    return impacted;
  }

  function getRulesForStudent(studentId: number) {
    return safeRules
      .filter((rule) => rule.studentId === studentId)
      .slice()
      .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  }

  function buildRegularSessionsForStudent(
    student: StudentProfile,
    activeRules: StudentScheduleRule[],
    baseSessions: Session[],
    anchorISO: string
  ) {
    const dates = getMonthRemainingDates(anchorISO);
    const existingRegularKeys = new Set(
      baseSessions
        .filter((session) => session.kind === "regular")
        .map(
          (session) =>
            `${session.studentId ?? ""}|${session.dateISO}|${session.start}|${session.kind}`
        )
    );

    let nextId = getNextSessionId(baseSessions);
    let skippedCount = 0;
    const generatedSessions: Session[] = [];

    for (const rule of activeRules) {
      for (const target of dates) {
        if (target.date.getDay() !== rule.weekday) continue;

        const key = `${student.id}|${target.dateISO}|${rule.start}|regular`;
        if (existingRegularKeys.has(key)) {
          skippedCount++;
          continue;
        }

        existingRegularKeys.add(key);
        generatedSessions.push({
          id: nextId,
          studentId: student.id,
          student: toSessionStudent(student),
          dateISO: target.dateISO,
          start: rule.start,
          durationMin: rule.durationMin,
          status: "pending",
          kind: "regular",
        });
        nextId++;
      }
    }

    return {
      generatedSessions,
      skippedCount,
    };
  }

  function generateRegularSessionsForStudent(student: StudentProfile) {
    if (student.status !== "active") {
      setToast?.("只有啟用中的學生可生成 regular 課次");
      return;
    }

    const activeRules = safeRules.filter(
      (rule) => rule.studentId === student.id && rule.isActive
    );

    if (activeRules.length === 0) {
      setToast?.("此學生沒有可用的固定課表規則");
      return;
    }

    if (!selectedDate) {
      setToast?.("缺少月份資訊，無法生成 regular 課次");
      return;
    }

    if (!setSessions) {
      setToast?.("缺少課次資料，無法生成 regular 課次");
      return;
    }

    const currentSessions = sessions ?? [];
    const { generatedSessions, skippedCount } = buildRegularSessionsForStudent(
      student,
      activeRules,
      currentSessions,
      selectedDate
    );

    if (generatedSessions.length === 0) {
      setToast?.("本月剩餘日期沒有可新增的 regular 課次");
      return;
    }

    setSessions((current) => [...current, ...generatedSessions]);

    if (skippedCount > 0) {
      setToast?.(`已生成 ${generatedSessions.length} 堂 regular 課次，略過 ${skippedCount} 堂已存在課次`);
    } else {
      setToast?.(`已生成 ${generatedSessions.length} 堂 regular 課次`);
    }
  }

  function clearRemainingRegularSessionsForStudent(student: StudentProfile) {
    if (!selectedDate) {
      setToast?.("缺少月份資訊，無法清除 regular 課次");
      return;
    }

    if (!sessions || !setSessions) {
      setToast?.("缺少課次資料，無法清除 regular 課次");
      return;
    }

    const removedCount = sessions.filter(
      (session) =>
        session.studentId === student.id &&
        session.kind === "regular" &&
        isWithinMonthRemaining(session.dateISO, selectedDate)
    ).length;

    if (removedCount === 0) {
      setToast?.("本月剩餘日期沒有可清除的 regular 課次");
      return;
    }

    setSessions((current) =>
      current.filter(
        (session) =>
          !(
            session.studentId === student.id &&
            session.kind === "regular" &&
            isWithinMonthRemaining(session.dateISO, selectedDate)
          )
      )
    );

    setToast?.(`已清除 ${removedCount} 堂 regular 課次`);
  }

  function regenerateRegularSessionsForStudent(student: StudentProfile) {
    if (student.status !== "active") {
      setToast?.("只有啟用中的學生可生成 regular 課次");
      return;
    }

    const activeRules = safeRules.filter(
      (rule) => rule.studentId === student.id && rule.isActive
    );

    if (activeRules.length === 0) {
      setToast?.("本月剩餘日期沒有可重新生成的 regular 課次");
      return;
    }

    if (!selectedDate) {
      setToast?.("缺少月份資訊，無法生成 regular 課次");
      return;
    }

    if (!setSessions) {
      setToast?.("缺少課次資料，無法生成 regular 課次");
      return;
    }

    const baseSessions = sessions ?? [];
    const keptSessions = baseSessions.filter(
      (session) =>
        !(
          session.studentId === student.id &&
          session.kind === "regular" &&
          isWithinMonthRemaining(session.dateISO, selectedDate)
        )
    );

    const { generatedSessions } = buildRegularSessionsForStudent(
      student,
      activeRules,
      keptSessions,
      selectedDate
    );

    if (generatedSessions.length === 0) {
      setToast?.("本月剩餘日期沒有可重新生成的 regular 課次");
      return;
    }

    setSessions([...keptSessions, ...generatedSessions]);
    setToast?.(`已重新生成 ${generatedSessions.length} 堂 regular 課次`);
  }

  function closeRuleEditor() {
    setRuleEditorOpen(false);
    setRuleEditorMode("create");
    setEditingRule(null);
    setRuleOwnerStudent(null);
    setRuleDraft(createDefaultRuleDraft());
  }

  function openRuleCreateSheet(student: StudentProfile) {
    setRuleEditorMode("create");
    setEditingRule(null);
    setRuleOwnerStudent(student);
    setRuleDraft(createDefaultRuleDraft());
    setRuleEditorOpen(true);
  }

  function openRuleEditSheet(student: StudentProfile, rule: StudentScheduleRule) {
    setRuleEditorMode("edit");
    setEditingRule(rule);
    setRuleOwnerStudent(student);
    setRuleDraft({
      weekday: rule.weekday,
      start: rule.start,
      durationMin: rule.durationMin,
      isActive: rule.isActive,
    });
    setRuleEditorOpen(true);
  }

  function saveRuleDraft() {
    if (!ruleOwnerStudent || !ruleDraft.start.trim() || ruleDraft.durationMin <= 0) {
      setToast?.("請輸入有效的上課時間與時長");
      return;
    }

    if (ruleEditorMode === "create") {
      safeSetRules((current) => [
        ...current,
        {
          id: getNextRuleId(current),
          studentId: ruleOwnerStudent.id,
          weekday: ruleDraft.weekday,
          start: ruleDraft.start,
          durationMin: ruleDraft.durationMin,
          isActive: ruleDraft.isActive,
        },
      ]);
      setToast?.("已新增固定課表規則");
    } else if (editingRule) {
      safeSetRules((current) =>
        current.map((item) =>
          item.id === editingRule.id
            ? {
                ...item,
                studentId: ruleOwnerStudent.id,
                weekday: ruleDraft.weekday,
                start: ruleDraft.start,
                durationMin: ruleDraft.durationMin,
                isActive: ruleDraft.isActive,
              }
            : item
        )
      );
      setToast?.("已更新固定課表規則");
    }

    closeRuleEditor();
  }

  function toggleRuleActive(rule: StudentScheduleRule, isActive: boolean) {
    safeSetRules((current) =>
      current.map((item) => (item.id === rule.id ? { ...item, isActive } : item))
    );
    setToast?.(isActive ? "已恢復固定課表規則" : "已停用固定課表規則");
  }

  function openRuleDeleteSheet(rule: StudentScheduleRule) {
    setRuleDeleteTarget(rule);
    setRuleDeleteOpen(true);
  }

  function closeRuleDeleteSheet() {
    setRuleDeleteTarget(null);
    setRuleDeleteOpen(false);
  }

  function confirmRuleDelete() {
    if (!ruleDeleteTarget) return;

    safeSetRules((current) => current.filter((item) => item.id !== ruleDeleteTarget.id));
    setToast?.("已刪除固定課表規則");
    closeRuleDeleteSheet();
  }

  function closeDuplicateSheet() {
    setDuplicateOpen(false);
    setDuplicateList([]);
    setPendingDraftSave(null);
  }

  const summary = useMemo(() => {
    return {
      all: safeStudents.length,
      active: safeStudents.filter((item) => item.status === "active").length,
      scheduled: safeStudents.filter((item) => item.status === "scheduled_deactivation").length,
      inactive: safeStudents.filter((item) => item.status === "inactive").length,
    };
  }, [safeStudents]);

  const filteredStudents = useMemo(() => {
    const statusOrder: Record<StudentProfile["status"], number> = {
      active: 0,
      scheduled_deactivation: 1,
      inactive: 2,
    };
    return safeStudents
      .filter((student) => (filter === "all" ? true : student.status === filter))
      .filter((student) => matchesQuery(student, query))
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.id - b.id);
  }, [safeStudents, filter, query]);

  const pageBg = isDark ? "bg-[#111214] text-white" : "bg-[#F2F2F7] text-[#1C1C1E]";
  const cardClass = isDark
    ? "rounded-[24px] bg-[#1C1C1E] ring-1 ring-white/10 shadow-sm"
    : "rounded-[24px] bg-white ring-1 ring-[#E5E5EA] shadow-sm";

  const inputClass = isDark
    ? "w-full rounded-2xl border border-white/10 bg-[#2C2C2E] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-[#8E8E93] focus:border-white/15 focus:ring-2 focus:ring-white/10"
    : "w-full rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3 text-[15px] text-[#1C1C1E] outline-none transition placeholder:text-[#8E8E93] focus:border-[#C7DAFF] focus:ring-2 focus:ring-[#C7DAFF]";

  const secondaryButtonClass = isDark
    ? "rounded-full bg-[#2C2C2E] px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#3A3A3C]"
    : "rounded-full bg-[#F2F2F7] px-4 py-2.5 text-[14px] font-medium text-[#1C1C1E] ring-1 ring-[#E5E5EA] transition hover:bg-[#EAEAEE]";

  const primaryButtonClass = isDark
    ? "rounded-full bg-[#0A84FF] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110"
    : "rounded-full bg-[#007AFF] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105";

  const dangerButtonClass = isDark
    ? "rounded-full bg-red-500/12 px-4 py-2.5 text-[14px] font-medium text-red-300 transition hover:bg-red-500/18"
    : "rounded-full bg-red-500/10 px-4 py-2.5 text-[14px] font-medium text-red-600 transition hover:bg-red-500/15";

  const compactButtonClass = isDark
    ? "rounded-full bg-[#2C2C2E] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#3A3A3C]"
    : "rounded-full bg-[#F2F2F7] px-3 py-1.5 text-[12px] font-medium text-[#1C1C1E] ring-1 ring-[#E5E5EA] transition hover:bg-[#EAEAEE]";

  const compactDangerButtonClass = isDark
    ? "rounded-full bg-red-500/12 px-3 py-1.5 text-[12px] font-medium text-red-300 transition hover:bg-red-500/18"
    : "rounded-full bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-600 transition hover:bg-red-500/15";

  function openCreateSheet() {
    setEditorMode("create");
    setEditingStudent(null);
    setDraft({ name: "", birthday: "", school: "" });
    setEditorOpen(true);
  }

  function openEditSheet(student: StudentProfile) {
    setEditorMode("edit");
    setEditingStudent(student);
    setDraft({
      id: student.id,
      name: student.name,
      birthday: student.birthday,
      school: student.school,
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingStudent(null);
    setDraft({ name: "", birthday: "", school: "" });
  }

  async function executeDraftSave() {
    if (!draft.name.trim() || !draft.birthday.trim() || !draft.school.trim()) return;

    if (editorMode === "create") {
      const payload = {
        name: draft.name.trim(),
        birthday: draft.birthday,
        school: draft.school.trim(),
        status: "active" as const,
      };

      if (isStudentsBackendAvailable) {
        try {
          const createdStudent = await createStudent(payload);
          safeSetStudents((current) => [...current, createdStudent]);
        } catch (error) {
          console.warn("Create student failed", error);
          setToast?.("新增學生失敗，請確認後端是否正常");
          return;
        }
      } else {
        safeSetStudents((current) => [
          ...current,
          {
            id: getNextStudentId(current),
            ...payload,
          },
        ]);
      }
    } else if (editingStudent) {
      const nextName = draft.name.trim();

      safeSetStudents((current) =>
        current.map((item) =>
          item.id === editingStudent.id
            ? {
                ...item,
                name: nextName,
                birthday: draft.birthday,
                school: draft.school.trim(),
              }
            : item
        )
      );

      syncLinkedSessionNames(editingStudent.id, nextName);
    }

    closeDuplicateSheet();
    closeEditor();
  }

  async function handleSubmitDraft() {
    if (!draft.name.trim() || !draft.birthday.trim() || !draft.school.trim()) return;

    const duplicates = findDuplicates(safeStudents, draft, editingStudent?.id);
    if (duplicates.length > 0) {
      setDuplicateList(duplicates);
      setPendingDraftSave(() => executeDraftSave);
      setDuplicateOpen(true);
      return;
    }

    await executeDraftSave();
  }

  function openAction(student: StudentProfile, action: string) {
    if (action === "edit") {
      openEditSheet(student);
      return;
    }

    if (action === "cancel_schedule") {
      if (editingStudent?.id === student.id) {
        closeEditor();
      }

      safeSetStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? {
                ...item,
                status: "active",
                deactivateMode: undefined,
                deactivateOn: undefined,
              }
            : item
        )
      );

      setToast?.("已取消停用設定，先前已移除的課次不會自動恢復");
      return;
    }

    if (action === "schedule_deactivation" || action === "change_deactivation") {
      if (editingStudent?.id === student.id) {
        closeEditor();
      }

      setPendingAction({
        kind: "deactivate_scheduled",
        student,
        date: student.deactivateOn || todayStr,
      });
      setScheduledDate(student.deactivateOn || todayStr);
      setScheduledDateError("");
      setConfirmOpen(true);
      return;
    }

    if (action === "deactivate_now") {
      if (editingStudent?.id === student.id) {
        closeEditor();
      }

      setScheduledDateError("");
      setPendingAction({ kind: "deactivate_immediate", student });
      setConfirmOpen(true);
      return;
    }

    if (action === "restore") {
      if (editingStudent?.id === student.id) {
        closeEditor();
      }

      setScheduledDateError("");
      setPendingAction({ kind: "restore", student });
      setConfirmOpen(true);
    }
  }

  function applyPendingAction() {
    if (!pendingAction) return;

    if (pendingAction.kind === "deactivate_immediate") {
      const target = pendingAction.student;
      const removedCount = removeImmediateLinkedSessions(target.id);

      safeSetStudents((current) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                status: "inactive",
                deactivateMode: "immediate",
                deactivateOn: undefined,
              }
            : item
        )
      );

      setToast?.(`已立即停用，移除 ${removedCount} 堂已關聯未來課次`);
    }

    if (pendingAction.kind === "deactivate_scheduled") {
      const trimmed = scheduledDate.trim();
      if (!trimmed) {
        setScheduledDateError("請先選擇停用日期");
        return;
      }
      if (trimmed < todayStr) {
        setScheduledDateError("停用日期不可早於今天");
        return;
      }

      const target = pendingAction.student;
      const removedCount = removeScheduledLinkedSessions(target.id, trimmed);

      safeSetStudents((current) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                status: "scheduled_deactivation",
                deactivateMode: "scheduled",
                deactivateOn: trimmed,
              }
            : item
        )
      );

      setToast?.(`已設定停用，移除 ${removedCount} 堂已關聯課次`);
    }

    if (pendingAction.kind === "restore") {
      const target = pendingAction.student;

      safeSetStudents((current) =>
        current.map((item) =>
          item.id === target.id
            ? {
                ...item,
                status: "active",
                deactivateMode: undefined,
                deactivateOn: undefined,
              }
            : item
        )
      );

      setToast?.("已恢復學生，先前已移除的課次不會自動恢復");
    }

    setConfirmOpen(false);
    setPendingAction(null);
    setScheduledDate("");
    setScheduledDateError("");
  }

  function closeConfirmSheet() {
    setConfirmOpen(false);
    setPendingAction(null);
    setScheduledDate("");
    setScheduledDateError("");
  }

  function getMenuItems(student: StudentProfile) {
    if (student.status === "active") {
      return [
        {
          label: "查看 / 編輯資料",
          onClick: () => {
            openAction(student, "edit");
          },
        },
        {
          label: "立即停用",
          onClick: () => {
            openAction(student, "deactivate_now");
          },
          danger: true,
        },
        {
          label: "指定日期停用",
          onClick: () => {
            openAction(student, "schedule_deactivation");
          },
        },
      ];
    }

    if (student.status === "scheduled_deactivation") {
      return [
        {
          label: "查看 / 編輯資料",
          onClick: () => {
            openAction(student, "edit");
          },
        },
        {
          label: "修改停用日期",
          onClick: () => {
            openAction(student, "change_deactivation");
          },
        },
        {
          label: "取消停用設定",
          onClick: () => {
            openAction(student, "cancel_schedule");
          },
        },
        {
          label: "立即停用",
          onClick: () => {
            openAction(student, "deactivate_now");
          },
          danger: true,
        },
      ];
    }

    return [
      {
        label: "查看 / 編輯資料",
        onClick: () => {
          openAction(student, "edit");
        },
      },
      {
        label: "恢復學生",
        onClick: () => {
          openAction(student, "restore");
        },
      },
    ];
  }

  const impactedCount =
    pendingAction?.kind === "deactivate_immediate"
      ? countImmediateImpactedSessions(pendingAction.student.id)
      : pendingAction?.kind === "deactivate_scheduled"
      ? countScheduledImpactedSessions(pendingAction.student.id, scheduledDate.trim())
      : null;

  return (
    <div className={cx("min-h-screen", pageBg)}>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <HeaderBar
          title="管理學生"
          icon={<IconUsers className="h-6 w-6" />}
          right={
            <button type="button" onClick={openCreateSheet} className={primaryButtonClass}>
              新增學生
            </button>
          }
        />

        <div className="mt-3 px-1 text-sm text-[#8E8E93]">
          管理學生主檔、停用狀態與排課來源
        </div>

        <div className="mt-5 grid gap-4">
          <div className={cardClass}>
            <div className="p-4">
              <div className="text-[13px] font-medium text-[#8E8E93]">搜尋</div>
              <div className="mt-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋姓名 / 生日 / 學校 / ID"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="p-4">
              <div className="text-[13px] font-medium text-[#8E8E93]">狀態篩選</div>
              <div className="mt-3">
                <SegmentedControl
                  value={filter}
                  onChange={(value) => setFilter(value as StudentFilter)}
                  options={[
                    { value: "all", label: "全部" },
                    { value: "active", label: "啟用中" },
                    { value: "scheduled_deactivation", label: "已設定停用" },
                    { value: "inactive", label: "已停用" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "全部學生", value: summary.all },
              { label: "啟用中", value: summary.active },
              { label: "已設定停用", value: summary.scheduled },
              { label: "已停用", value: summary.inactive },
            ].map((item) => (
              <div key={item.label} className={cardClass}>
                <div className="px-4 py-4">
                  <div className="text-[13px] text-[#8E8E93]">{item.label}</div>
                  <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em]">
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {safeStudents.length === 0 ? (
              <div className={cardClass}>
                <div className="py-10 text-center">
                  <div className="text-[18px] font-semibold">尚未建立任何學生</div>
                  <div className="mt-2 text-[14px] text-[#8E8E93]">
                    建立第一位學生後，這裡會作為排課來源與主檔管理入口。
                  </div>
                  <div className="mt-5">
                    <button type="button" onClick={openCreateSheet} className={primaryButtonClass}>
                      新增第一位學生
                    </button>
                  </div>
                </div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className={cardClass}>
                <div className="py-10 text-center">
                  <div className="text-[18px] font-semibold">找不到符合條件的學生</div>
                  <div className="mt-2 text-[14px] text-[#8E8E93]">
                    請調整搜尋關鍵字或切換狀態篩選後再查看。
                  </div>
                </div>
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div key={student.id} className={cx(cardClass, "relative p-0")}>
                  <button
                    type="button"
                    onClick={() => openEditSheet(student)}
                    className="block w-full px-4 py-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-4 pr-12">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[17px] font-semibold tracking-[-0.02em]">
                            {student.name}
                          </div>
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-[12px] font-medium",
                              getStatusBadgeClasses(isDark, student.status)
                            )}
                          >
                            {formatStatus(student.status)}
                          </span>
                        </div>

                        <div className="mt-2 text-[13px] text-[#8E8E93]">
                          {student.birthday} · {student.school} · #{student.id}
                        </div>

                        {statusDescription(student) ? (
                          <div className="mt-3 text-[13px] leading-5 text-[#8E8E93]">
                            {statusDescription(student)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <div className="absolute right-4 top-4">
                    <div className="relative pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuOpenId((cur) => (cur === student.id ? null : student.id))
                        }
                        className={cx(
                          "flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition",
                          isDark
                            ? "bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]"
                            : "bg-[#F2F2F7] text-[#1C1C1E] ring-1 ring-[#E5E5EA] hover:bg-[#EAEAEE]"
                        )}
                      >
                        ⋯
                      </button>

                      <Menu
                        open={menuOpenId === student.id}
                        onClose={() => setMenuOpenId(null)}
                        items={getMenuItems(student)}
                      />
                    </div>
                  </div>

                  <div
                    className={cx(
                      "border-t px-4 py-4",
                      isDark ? "border-white/10" : "border-[#E5E5EA]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-medium text-[#8E8E93]">固定課表</div>
                        <div className="mt-1 text-[13px] text-[#8E8E93]">
                          共 {getRulesForStudent(student.id).length} 條規則
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => generateRegularSessionsForStudent(student)}
                          className={compactButtonClass}
                        >
                          生成本月 regular 課次
                        </button>
                        <button
                          type="button"
                          onClick={() => clearRemainingRegularSessionsForStudent(student)}
                          className={compactDangerButtonClass}
                        >
                          清除本月 regular
                        </button>
                        <button
                          type="button"
                          onClick={() => regenerateRegularSessionsForStudent(student)}
                          className={compactButtonClass}
                        >
                          重新生成本月 regular
                        </button>
                        <button
                          type="button"
                          onClick={() => openRuleCreateSheet(student)}
                          className={compactButtonClass}
                        >
                          新增固定課表
                        </button>
                      </div>
                    </div>

                    {getRulesForStudent(student.id).length === 0 ? (
                      <div className="mt-4 text-[13px] leading-6 text-[#8E8E93]">
                        尚未設定固定課表規則。
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {getRulesForStudent(student.id).map((rule) => (
                          <div
                            key={rule.id}
                            className={cx(
                              "rounded-2xl px-4 py-3 ring-1",
                              isDark
                                ? "bg-[#2C2C2E] ring-white/10"
                                : "bg-[#F2F2F7] ring-[#E5E5EA]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-[14px] font-semibold">
                                    {formatWeekdayLabel(rule.weekday)}
                                  </div>
                                  <div className="text-[13px] text-[#8E8E93]">{rule.start}</div>
                                  <div className="text-[13px] text-[#8E8E93]">
                                    {rule.durationMin} 分鐘
                                  </div>
                                  <span
                                    className={cx(
                                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                      rule.isActive
                                        ? isDark
                                          ? "bg-[#0A84FF]/16 text-[#4DA3FF] ring-1 ring-[#0A84FF]/25"
                                          : "bg-[#007AFF]/10 text-[#007AFF] ring-1 ring-[#007AFF]/15"
                                        : isDark
                                        ? "bg-[#3A3A3C] text-[#8E8E93] ring-1 ring-white/10"
                                        : "bg-[#E5E5EA] text-[#636366] ring-1 ring-[#D1D1D6]"
                                    )}
                                  >
                                    {rule.isActive ? "啟用中" : "已停用"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openRuleEditSheet(student, rule)}
                                  className={compactButtonClass}
                                >
                                  編輯
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleRuleActive(rule, !rule.isActive)}
                                  className={compactButtonClass}
                                >
                                  {rule.isActive ? "停用" : "恢復"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRuleDeleteSheet(rule)}
                                  className={compactDangerButtonClass}
                                >
                                  刪除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <IOSSheet
        open={editorOpen}
        title={editorMode === "create" ? "新增學生" : "學生資料"}
        subtitle={editorMode === "create" ? "建立新的學生主檔" : "查看與編輯學生基本資料"}
        onClose={closeEditor}
        leftAction={{ label: "取消", onClick: closeEditor }}
        rightAction={{
          label: editorMode === "create" ? "建立" : "儲存",
          onClick: () => {
            if (!draft.name.trim() || !draft.birthday.trim() || !draft.school.trim()) return;
            void handleSubmitDraft();
          },
          emphasize: true,
        }}
      >
        <div className="space-y-5">
          <div className={cardClass}>
            <div className="p-4">
              <div className="mb-4 text-[16px] font-semibold">基本資料</div>
              <div className="grid gap-4">
                <FieldRow label="姓名">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                  />
                </FieldRow>

                <FieldRow label="生日">
                  <input
                    type="date"
                    value={draft.birthday}
                    onChange={(e) => setDraft((prev) => ({ ...prev, birthday: e.target.value }))}
                    className={inputClass}
                  />
                </FieldRow>

                <FieldRow label="學校">
                  <input
                    type="text"
                    value={draft.school}
                    onChange={(e) => setDraft((prev) => ({ ...prev, school: e.target.value }))}
                    className={inputClass}
                  />
                </FieldRow>

                <FieldRow label="ID">
                  <input
                    type="text"
                    readOnly
                    value={editingStudent ? String(editingStudent.id) : "建立後自動產生"}
                    className={cx(inputClass, "opacity-80")}
                  />
                </FieldRow>

                <FieldRow label="狀態">
                  <input
                    type="text"
                    readOnly
                    value={editingStudent ? formatStatus(editingStudent.status) : "建立後預設為啟用中"}
                    className={cx(inputClass, "opacity-80")}
                  />
                </FieldRow>
              </div>
            </div>
          </div>

          {editingStudent ? (
            <div className={cardClass}>
              <div className="p-4">
                <div className="mb-4 text-[16px] font-semibold">狀態管理</div>
                <div className="space-y-3">
                  {editingStudent.status === "active" ? (
                    <>
                      <div className="text-[14px] text-[#8E8E93]">
                        停用後會影響未來排課；恢復後不會自動恢復之前移除的未來課次。
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "deactivate_now")}
                          className={dangerButtonClass}
                        >
                          立即停用
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "schedule_deactivation")}
                          className={secondaryButtonClass}
                        >
                          指定日期停用
                        </button>
                      </div>
                    </>
                  ) : null}

                  {editingStudent.status === "scheduled_deactivation" ? (
                    <>
                      <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-[14px] text-[#8E8E93]">
                        停用日期：{editingStudent.deactivateOn || "尚未設定"}
                      </div>
                      <div className="text-[14px] text-[#8E8E93]">
                        當日及之後的已排課課次將被移除。
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "change_deactivation")}
                          className={secondaryButtonClass}
                        >
                          修改停用日期
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "cancel_schedule")}
                          className={secondaryButtonClass}
                        >
                          取消停用設定
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "deactivate_now")}
                          className={dangerButtonClass}
                        >
                          立即停用
                        </button>
                      </div>
                    </>
                  ) : null}

                  {editingStudent.status === "inactive" ? (
                    <>
                      <div className="text-[14px] text-[#8E8E93]">
                        恢復後可重新用於排課；先前已移除的未來課次不會自動恢復。
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openAction(editingStudent, "restore")}
                          className={secondaryButtonClass}
                        >
                          恢復學生
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className={cardClass}>
            <div className="p-4">
              <div className="mb-2 text-[16px] font-semibold">固定課表規則</div>
              <div className="text-[14px] leading-6 text-[#8E8E93]">
                規則請於學生卡片下方管理；regular 課次自動生成將於後續階段開放。
              </div>
            </div>
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={ruleEditorOpen}
        title={ruleEditorMode === "create" ? "新增固定課表" : "編輯固定課表"}
        subtitle={ruleOwnerStudent ? `${ruleOwnerStudent.name} · 固定課表規則` : "固定課表規則"}
        onClose={closeRuleEditor}
        leftAction={{ label: "取消", onClick: closeRuleEditor }}
        rightAction={{
          label: "儲存",
          onClick: saveRuleDraft,
          emphasize: true,
        }}
      >
        <div className="space-y-5">
          <div className={cardClass}>
            <div className="p-4">
              <div className="mb-4 text-[16px] font-semibold">規則設定</div>
              <div className="grid gap-4">
                <FieldRow label="星期">
                  <div className="w-full text-left">
                    <select
                      value={ruleDraft.weekday}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          weekday: Number(e.target.value) as StudentScheduleRule["weekday"],
                        }))
                      }
                      className={inputClass}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {formatWeekdayLabel(weekday as StudentScheduleRule["weekday"])}
                        </option>
                      ))}
                    </select>
                  </div>
                </FieldRow>

                <FieldRow label="開始時間">
                  <div className="w-full text-left">
                    <input
                      type="time"
                      value={ruleDraft.start}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({ ...prev, start: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </FieldRow>

                <FieldRow label="時長">
                  <DurationInput
                    value={ruleDraft.durationMin}
                    onChange={(value) =>
                      setRuleDraft((prev) => ({ ...prev, durationMin: value }))
                    }
                  />
                </FieldRow>

                <FieldRow label="狀態">
                  <input
                    type="text"
                    readOnly
                    value={ruleDraft.isActive ? "啟用中" : "已停用"}
                    className={cx(inputClass, "opacity-80")}
                  />
                </FieldRow>
              </div>
            </div>
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={ruleDeleteOpen}
        title="刪除固定課表規則"
        subtitle="請確認是否刪除這條固定課表規則。"
        onClose={closeRuleDeleteSheet}
        leftAction={{ label: "取消", onClick: closeRuleDeleteSheet }}
        rightAction={{
          label: "確認刪除",
          onClick: confirmRuleDelete,
          danger: true,
        }}
      >
        {ruleDeleteTarget ? (
          <div className="space-y-4">
            <div className={cardClass}>
              <div className="p-4">
                <div className="space-y-2 text-[14px] leading-6 text-[#8E8E93]">
                  <div>星期：{formatWeekdayLabel(ruleDeleteTarget.weekday)}</div>
                  <div>開始時間：{ruleDeleteTarget.start}</div>
                  <div>時長：{ruleDeleteTarget.durationMin} 分鐘</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </IOSSheet>

      <IOSSheet
        open={duplicateOpen}
        title="重覆提醒"
        subtitle="系統內已有相同姓名與生日的學生，請確認是否仍要繼續。"
        onClose={closeDuplicateSheet}
        leftAction={{ label: "返回檢查", onClick: closeDuplicateSheet }}
        rightAction={{
          label: editorMode === "create" ? "仍然建立" : "仍然儲存",
          onClick: () => {
            void pendingDraftSave?.();
          },
          emphasize: true,
        }}
      >
        <div className="space-y-3">
          {duplicateList.map((item) => (
            <div key={item.id} className={cardClass}>
              <div className="p-4">
                <div className="text-[16px] font-semibold">{item.name}</div>
                <div className="mt-2 text-[14px] leading-6 text-[#8E8E93]">
                  生日：{item.birthday}
                  <br />
                  學校：{item.school}
                  <br />
                  ID：#{item.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </IOSSheet>

      <IOSSheet
        open={confirmOpen}
        title={
          pendingAction?.kind === "deactivate_immediate"
            ? "立即停用"
            : pendingAction?.kind === "deactivate_scheduled"
            ? "指定日期停用"
            : "恢復學生"
        }
        subtitle="請確認這次狀態變更。"
        onClose={closeConfirmSheet}
        leftAction={{ label: "取消", onClick: closeConfirmSheet }}
        rightAction={{
          label:
            pendingAction?.kind === "restore"
              ? "確認恢復"
              : pendingAction?.kind === "deactivate_scheduled"
              ? "確認設定"
              : "確認停用",
          onClick: () => {
            applyPendingAction();
          },
          emphasize: true,
        }}
      >
        {pendingAction ? (
          <div className="space-y-4">
            <div className={cardClass}>
              <div className="p-4">
                <div className="text-[17px] font-semibold">{pendingAction.student.name}</div>
                <div className="mt-2 text-[14px] leading-6 text-[#8E8E93]">
                  生日：{pendingAction.student.birthday}
                  <br />
                  學校：{pendingAction.student.school}
                </div>
              </div>
            </div>

            {pendingAction.kind === "deactivate_immediate" ? (
              <div className={cardClass}>
                <div className="p-4">
                  <div className="space-y-3 text-[14px] leading-6 text-[#8E8E93]">
                    <div>受影響未來課次數量：{impactedCount ?? "—"}</div>
                    <div>立即停用後，將移除現在之後所有已排課課次。</div>
                    <div>恢復後不會自動還原這些課次。</div>
                  </div>
                </div>
              </div>
            ) : null}

            {pendingAction.kind === "deactivate_scheduled" ? (
              <div className={cardClass}>
                <div className="p-4">
                  <div className="space-y-4">
                    <FieldRow label="停用日期">
                      <div className="w-full text-left">
                        <input
                          type="date"
                          value={scheduledDate}
                          min={todayStr}
                          onChange={(e) => {
                            setScheduledDate(e.target.value);
                            if (scheduledDateError) setScheduledDateError("");
                          }}
                          className={inputClass}
                        />
                        {scheduledDateError ? (
                          <div className="mt-2 text-xs text-red-500">{scheduledDateError}</div>
                        ) : null}
                      </div>
                    </FieldRow>

                    <div className="space-y-2 text-[14px] leading-6 text-[#8E8E93]">
                      <div>停用將於指定日期 00:00 生效。</div>
                      <div>當日及之後的已排課課次將被移除。</div>
                      <div>受影響未來課次數量：{impactedCount ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {pendingAction.kind === "restore" ? (
              <div className={cardClass}>
                <div className="p-4">
                  <div className="space-y-2 text-[14px] leading-6 text-[#8E8E93]">
                    <div>恢復後可重新用於排課。</div>
                    <div>先前已移除的未來課次不會自動恢復。</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </IOSSheet>
    </div>
  );
}
