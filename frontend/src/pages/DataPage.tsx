import { Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as XLSX from "xlsx";
import { fillExcelTemplate } from "../api/exportsApi";
import type { ExcelFillTemplatePayload } from "../api/exportsApi";
import { fetchMonthlyStatistics } from "../api/statisticsApi";
import type { MonthlyStatistics, MonthlyStatisticsStudentRow } from "../api/statisticsApi";
import type {
  GlobalEvent,
  Session,
  StudentProfile,
  StudentScheduleRule,
} from "../shared/appShared";
import {
  HeaderBar,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IOSSheet,
  ThemeContext,
  ThemeToggle,
  pad2,
  parseISO,
  todayISO,
} from "../shared/appShared";

type DataPageProps = {
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  selectedDate: string;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  students: StudentProfile[];
  studentScheduleRules: StudentScheduleRule[];
  sessions: Session[];
  globalEvents: GlobalEvent[];
  setToast: Dispatch<SetStateAction<string>>;
};

type MonthRange = {
  monthStartISO: string;
  monthEndISO: string;
};

type StudentAttendanceRow = {
  student: StudentProfile;
  regularPresentCount: number;
  makeupPresentCount: number;
  extraPresentCount: number;
  totalPresentCount: number;
};

type TemplateColumnCandidate = {
  column: string;
  columnIndex: number;
  label: string;
  path: string[];
  confidence: "high" | "medium" | "low";
};

type TemplateColumnOption = {
  column: string;
  columnIndex: number;
  label: string;
};

type MatchedStudentRow = {
  student: StudentProfile;
  attendanceRow: StudentAttendanceRow;
  excelRow: number;
  targetColumn: string;
  cellAddress: string;
  originalValue: string;
  value: number;
};

type DuplicatedMatch = {
  student: StudentProfile;
  attendanceRow: StudentAttendanceRow;
  excelRows: number[];
};

type WorksheetData = {
  worksheet: XLSX.WorkSheet;
  range: XLSX.Range | null;
  maxHeaderRows: number;
};

type XlsxPopulateSheet = {
  cell: (address: string) => {
    value: (nextValue: number) => void;
  };
};

type XlsxPopulateWorkbook = {
  sheet: (name: string) => XlsxPopulateSheet | undefined;
  outputAsync: () => Promise<Blob | ArrayBuffer | Uint8Array>;
};

type XlsxPopulateModule = {
  fromDataAsync: (data: ArrayBuffer) => Promise<XlsxPopulateWorkbook>;
};

type ColumnAnalysis = {
  availableColumns: TemplateColumnOption[];
  nameColumn: string;
  birthdayColumn: string;
  directServiceColumn: string;
  columnCandidates: TemplateColumnCandidate[];
};

const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function loadXlsxPopulate() {
  // @ts-expect-error xlsx-populate browser bundle does not publish TypeScript declarations.
  const mod = await import("xlsx-populate/browser/xlsx-populate-no-encryption");
  return (mod.default ?? mod) as XlsxPopulateModule;
}

function parseMonthAnchor(dateISO: string) {
  const parsed = parseISO(dateISO);
  if (Number.isNaN(parsed.getTime())) return parseISO(todayISO());
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function formatMonthLabel(dateISO: string) {
  const anchor = parseMonthAnchor(dateISO);
  return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
}

function formatMonthShortLabel(dateISO: string) {
  const anchor = parseMonthAnchor(dateISO);
  return `${anchor.getMonth() + 1}月`;
}

function formatMonthToken(dateISO: string) {
  const anchor = parseMonthAnchor(dateISO);
  return `${anchor.getFullYear()}-${pad2(anchor.getMonth() + 1)}`;
}

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addMonthsISO(dateISO: string, delta: number) {
  const anchor = parseMonthAnchor(dateISO);
  anchor.setMonth(anchor.getMonth() + delta);
  return formatDateISO(anchor);
}

function getMonthRange(dateISO: string): MonthRange {
  const anchor = parseMonthAnchor(dateISO);
  const monthStartISO = formatDateISO(anchor);
  const monthEndISO = formatDateISO(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  return { monthStartISO, monthEndISO };
}

function isInRange(dateISO: string, range: MonthRange) {
  return dateISO >= range.monthStartISO && dateISO <= range.monthEndISO;
}

function formatStatus(status: StudentProfile["status"]) {
  if (status === "active") return "啟用中";
  if (status === "scheduled_deactivation") return "已設定停用";
  return "已停用";
}

function formatSessionStatusLabel(status: Session["status"]) {
  if (status === "present") return "已出席";
  if (status === "absent") return "缺席";
  if (status === "pending") return "待處理";
  if (status === "cancelled") return "已取消";
  return status;
}

// Tailwind 安全色票（iOS-style 軟色 + ring），不引入新 theme tokens。
function getSessionStatusBadgeClass(
  status: Session["status"],
  isDark: boolean
) {
  if (status === "present") {
    return isDark
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
      : "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20";
  }
  if (status === "absent") {
    return isDark
      ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/25"
      : "bg-red-500/10 text-red-700 ring-1 ring-red-500/20";
  }
  if (status === "pending") {
    return isDark
      ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
      : "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20";
  }
  // cancelled
  return isDark
    ? "bg-white/5 text-[#8E8E93] ring-1 ring-white/10"
    : "bg-slate-200/60 text-slate-500 ring-1 ring-slate-300/60";
}

function getSessionKindBadgeClass(kind: Session["kind"], isDark: boolean) {
  if (kind === "regular") {
    return isDark
      ? "bg-[#0A84FF]/16 text-[#4DA3FF] ring-1 ring-[#0A84FF]/25"
      : "bg-[#007AFF]/10 text-[#007AFF] ring-1 ring-[#007AFF]/15";
  }
  if (kind === "makeup") {
    return isDark
      ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25"
      : "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20";
  }
  // extra
  return isDark
    ? "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25"
    : "bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/20";
}

function sortStudents(a: StudentProfile, b: StudentProfile) {
  const order: Record<StudentProfile["status"], number> = {
    active: 0,
    scheduled_deactivation: 1,
    inactive: 2,
  };

  return order[a.status] - order[b.status] || a.id - b.id;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function displayCellValue(value: unknown) {
  if (value instanceof Date) return formatDateISO(value);
  return String(value ?? "").trim();
}

function getCellAddress(rowIndex: number, colIndex: number) {
  return XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
}

function findMergeForCell(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  colIndex: number
) {
  const merges = worksheet["!merges"] ?? [];
  return merges.find(
    (merge) =>
      rowIndex >= merge.s.r &&
      rowIndex <= merge.e.r &&
      colIndex >= merge.s.c &&
      colIndex <= merge.e.c
  );
}

function getCell(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  colIndex: number
) {
  const directCell = worksheet[getCellAddress(rowIndex, colIndex)] as XLSX.CellObject | undefined;
  if (directCell) return directCell;

  const merge = findMergeForCell(worksheet, rowIndex, colIndex);
  if (!merge) return undefined;

  return worksheet[getCellAddress(merge.s.r, merge.s.c)] as XLSX.CellObject | undefined;
}

function getCellText(worksheet: XLSX.WorkSheet, rowIndex: number, colIndex: number) {
  const cell = getCell(worksheet, rowIndex, colIndex);
  if (!cell) return "";

  const text = typeof cell.w === "string" && cell.w.trim() ? cell.w : displayCellValue(cell.v);
  return text.trim();
}

function getCellRawValue(worksheet: XLSX.WorkSheet, rowIndex: number, colIndex: number) {
  const cell = getCell(worksheet, rowIndex, colIndex);
  if (cell?.t === "d" && cell.w) return cell.w;
  return cell?.v ?? cell?.w ?? "";
}

function getCellDisplayValue(worksheet: XLSX.WorkSheet, cellAddress: string) {
  const cell = worksheet[cellAddress] as XLSX.CellObject | undefined;
  if (!cell) return "-";
  if (cell.f) return cell.w ? `${cell.w}（公式）` : `=${cell.f}`;
  if (cell.w != null && String(cell.w).trim()) return String(cell.w).trim();
  if (cell.v != null) return displayCellValue(cell.v);
  return "-";
}

function buildColumnHeaderPath(
  worksheet: XLSX.WorkSheet,
  colIndex: number,
  maxHeaderRows: number
) {
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) return [];

  const lastHeaderRow = Math.min(range.e.r, maxHeaderRows - 1);
  const path: string[] = [];
  const seen = new Set<string>();

  for (let rowIndex = range.s.r; rowIndex <= lastHeaderRow; rowIndex += 1) {
    const text = getCellText(worksheet, rowIndex, colIndex);
    const normalized = normalizeText(text);
    if (!text || seen.has(normalized)) continue;
    path.push(text);
    seen.add(normalized);
  }

  return path;
}

function columnLabel(column: string, path: string[]) {
  return `${column}：${path.length > 0 ? path.join(" > ") : "空白欄"}`;
}

function scoreColumn(path: string[], keywords: string[]) {
  const normalizedPath = normalizeText(path.join(">"));
  return keywords.reduce((score, keyword) => {
    return normalizedPath.includes(normalizeText(keyword)) ? score + 1 : score;
  }, 0);
}

function getPreferredCandidate(candidates: TemplateColumnCandidate[]) {
  return (
    candidates.find((candidate) => candidate.confidence === "high") ??
    candidates.find((candidate) => candidate.confidence === "medium") ??
    candidates.find((candidate) => candidate.confidence === "low")
  );
}

function analyzeWorksheetColumns(
  worksheet: XLSX.WorkSheet,
  targetMonthLabel: string,
  maxHeaderRows = 15
): ColumnAnalysis {
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    return {
      availableColumns: [],
      nameColumn: "",
      birthdayColumn: "",
      directServiceColumn: "",
      columnCandidates: [],
    };
  }

  const availableColumns: TemplateColumnOption[] = [];
  const columnCandidates: TemplateColumnCandidate[] = [];
  let bestName: { column: string; score: number } | null = null;
  let bestBirthday: { column: string; score: number } | null = null;

  for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
    const column = XLSX.utils.encode_col(colIndex);
    const path = buildColumnHeaderPath(worksheet, colIndex, maxHeaderRows);
    const normalizedPath = normalizeText(path.join(">"));

    availableColumns.push({
      column,
      columnIndex: colIndex,
      label: columnLabel(column, path),
    });

    const nameScore = scoreColumn(path, ["學生姓名", "服務使用者", "兒童姓名", "姓名"]);
    if (nameScore > 0 && (!bestName || nameScore > bestName.score)) {
      bestName = { column, score: nameScore };
    }

    const birthdayScore = scoreColumn(path, ["出生日期", "生日", "出生", "birth"]);
    if (birthdayScore > 0 && (!bestBirthday || birthdayScore > bestBirthday.score)) {
      bestBirthday = { column, score: birthdayScore };
    }

    const hasTargetMonth = normalizedPath.includes(normalizeText(targetMonthLabel));
    const hasIndividual = normalizedPath.includes("個別");
    const hasDirectService = normalizedPath.includes("直接服務");

    if (hasDirectService) {
      const confidence: TemplateColumnCandidate["confidence"] =
        hasTargetMonth && hasIndividual ? "high" : hasTargetMonth ? "medium" : "low";

      columnCandidates.push({
        column,
        columnIndex: colIndex,
        label: columnLabel(column, path),
        path,
        confidence,
      });
    }
  }

  const preferredCandidate = getPreferredCandidate(columnCandidates);

  return {
    availableColumns,
    nameColumn: bestName?.column ?? "",
    birthdayColumn: bestBirthday?.column ?? "",
    directServiceColumn: preferredCandidate?.column ?? "",
    columnCandidates,
  };
}

function normalizeBirthday(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const adjusted = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    return `${adjusted.getUTCFullYear()}-${pad2(adjusted.getUTCMonth() + 1)}-${pad2(
      adjusted.getUTCDate()
    )}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    }
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const yyyyMMdd = raw.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (yyyyMMdd) {
    return `${yyyyMMdd[1]}-${pad2(Number(yyyyMMdd[2]))}-${pad2(Number(yyyyMMdd[3]))}`;
  }

  const ddMMyyyy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddMMyyyy) {
    return `${ddMMyyyy[3]}-${pad2(Number(ddMMyyyy[2]))}-${pad2(Number(ddMMyyyy[1]))}`;
  }

  const mmDDyy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (mmDDyy) {
    return `20${mmDDyy[3]}-${pad2(Number(mmDDyy[1]))}-${pad2(Number(mmDDyy[2]))}`;
  }

  return raw;
}

function buildMatchKey(name: string, birthday: string) {
  return `${normalizeName(name)}|${normalizeBirthday(birthday)}`;
}

function matchStudentsToWorksheet({
  worksheet,
  range,
  nameColumn,
  birthdayColumn,
  directServiceColumn,
  attendanceRows,
}: {
  worksheet: XLSX.WorkSheet;
  range: XLSX.Range | null;
  nameColumn: string;
  birthdayColumn: string;
  directServiceColumn: string;
  attendanceRows: StudentAttendanceRow[];
}) {
  const matchedRows: MatchedStudentRow[] = [];
  const unmatchedStudents: StudentAttendanceRow[] = [];
  const duplicatedMatches: DuplicatedMatch[] = [];

  if (!range || !nameColumn || !birthdayColumn || !directServiceColumn) {
    return { matchedRows, unmatchedStudents, duplicatedMatches };
  }

  const nameColumnIndex = XLSX.utils.decode_col(nameColumn);
  const birthdayColumnIndex = XLSX.utils.decode_col(birthdayColumn);
  const excelRowsByStudentKey = new Map<string, number[]>();

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const excelName = getCellText(worksheet, rowIndex, nameColumnIndex);
    if (!excelName || normalizeText(excelName).includes("姓名")) continue;

    const excelBirthday = normalizeBirthday(
      getCellRawValue(worksheet, rowIndex, birthdayColumnIndex)
    );
    const key = buildMatchKey(excelName, excelBirthday);
    const existing = excelRowsByStudentKey.get(key) ?? [];
    excelRowsByStudentKey.set(key, [...existing, rowIndex + 1]);
  }

  attendanceRows.forEach((attendanceRow) => {
    const key = buildMatchKey(attendanceRow.student.name, attendanceRow.student.birthday);
    const excelRows = excelRowsByStudentKey.get(key) ?? [];

    if (excelRows.length === 1) {
      const cellAddress = `${directServiceColumn}${excelRows[0]}`;

      matchedRows.push({
        student: attendanceRow.student,
        attendanceRow,
        excelRow: excelRows[0],
        targetColumn: directServiceColumn,
        cellAddress,
        originalValue: getCellDisplayValue(worksheet, cellAddress),
        value: attendanceRow.totalPresentCount,
      });
      return;
    }

    if (excelRows.length > 1) {
      duplicatedMatches.push({
        student: attendanceRow.student,
        attendanceRow,
        excelRows,
      });
      return;
    }

    unmatchedStudents.push(attendanceRow);
  });

  return { matchedRows, unmatchedStudents, duplicatedMatches };
}

function readWorkbookFromFile(file: File) {
  return new Promise<{ workbook: XLSX.WorkBook; arrayBuffer: ArrayBuffer }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result;
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error("無法讀取檔案內容"));
          return;
        }
        const arrayBuffer = result.slice(0);
        resolve({
          workbook: XLSX.read(result, { type: "array", cellDates: true }),
          arrayBuffer,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案時發生錯誤"));
    reader.readAsArrayBuffer(file);
  });
}

function uniqueDirectServiceOptions(
  candidates: TemplateColumnCandidate[],
  availableColumns: TemplateColumnOption[]
) {
  const options: TemplateColumnOption[] = candidates.map((candidate) => ({
    column: candidate.column,
    columnIndex: candidate.columnIndex,
    label: `${candidate.label}（${candidate.confidence}）`,
  }));
  const used = new Set(options.map((option) => option.column));

  availableColumns.forEach((option) => {
    if (!used.has(option.column)) options.push(option);
  });

  return options;
}

function buildExportFileName(templateFileName: string, selectedDate: string) {
  const baseName = templateFileName.replace(/\.(xlsx|xls)$/i, "") || "官方模板";
  const anchor = parseMonthAnchor(selectedDate);
  const monthToken = `${anchor.getFullYear()}-${pad2(anchor.getMonth() + 1)}`;
  return `${baseName}_${monthToken}_已填寫.xlsx`;
}

function getColumnLetters(cellAddress?: string) {
  return cellAddress?.match(/^[A-Z]+/)?.[0] ?? "—";
}

function statisticsStudentRowToAttendanceRow(
  row: MonthlyStatisticsStudentRow
): StudentAttendanceRow {
  return {
    student: {
      id: row.studentId,
      name: row.studentName,
      birthday: row.birthday,
      school: row.school,
      status: row.status as StudentProfile["status"],
    },
    regularPresentCount: row.regularPresentCount,
    makeupPresentCount: row.makeupPresentCount,
    extraPresentCount: row.extraPresentCount,
    totalPresentCount: row.totalPresentCount,
  };
}

export default function DataPage({
  setTheme,
  selectedDate,
  setSelectedDate,
  students,
  studentScheduleRules,
  sessions,
  globalEvents,
  setToast,
}: DataPageProps) {
  const isDark = useContext(ThemeContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateFileName, setTemplateFileName] = useState("");
  const [templateArrayBuffer, setTemplateArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [worksheetData, setWorksheetData] = useState<WorksheetData | null>(null);
  const [nameColumn, setNameColumn] = useState("");
  const [birthdayColumn, setBirthdayColumn] = useState("");
  const [directServiceColumn, setDirectServiceColumn] = useState("");
  const [columnCandidates, setColumnCandidates] = useState<TemplateColumnCandidate[]>([]);
  const [availableColumns, setAvailableColumns] = useState<TemplateColumnOption[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedStudentRow[]>([]);
  const [unmatchedStudents, setUnmatchedStudents] = useState<StudentAttendanceRow[]>([]);
  const [duplicatedMatches, setDuplicatedMatches] = useState<DuplicatedMatch[]>([]);
  const [templateReadError, setTemplateReadError] = useState("");
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [backendStatistics, setBackendStatistics] = useState<MonthlyStatistics | null>(null);
  const [isStatisticsBackendAvailable, setIsStatisticsBackendAvailable] = useState(false);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);

  const monthRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const monthLabel = formatMonthLabel(selectedDate);
  const monthShortLabel = formatMonthShortLabel(selectedDate);
  const monthToken = formatMonthToken(selectedDate);

  const monthlySessions = useMemo(
    () => sessions.filter((session) => isInRange(session.dateISO, monthRange)),
    [sessions, monthRange]
  );

  // 每學生明細展開狀態（in-memory，不持久化；月份切換時清空）。
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<number>>(
    () => new Set()
  );

  useEffect(() => {
    setExpandedStudentIds(new Set());
  }, [monthToken]);

  function toggleStudentExpanded(studentId: number) {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  // 預先按 studentId 分組並依日期 + 開始時間升序排序，
  // 展開時直接 .get(studentId) 即可，避免每次展開都重算。
  const sessionsByStudentId = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const session of monthlySessions) {
      if (session.studentId == null) continue;
      const list = map.get(session.studentId);
      if (list) {
        list.push(session);
      } else {
        map.set(session.studentId, [session]);
      }
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.dateISO.localeCompare(b.dateISO) || a.start.localeCompare(b.start)
      );
    }
    return map;
  }, [monthlySessions]);

  const localAttendanceRows = useMemo<StudentAttendanceRow[]>(() => {
    return [...students].sort(sortStudents).map((student) => {
      const studentMonthlyPresentSessions = monthlySessions.filter(
        (session) => session.studentId === student.id && session.status === "present"
      );

      const regularPresentCount = studentMonthlyPresentSessions.filter(
        (session) => session.kind === "regular"
      ).length;
      const makeupPresentCount = studentMonthlyPresentSessions.filter(
        (session) => session.kind === "makeup"
      ).length;
      const extraPresentCount = studentMonthlyPresentSessions.filter(
        (session) => session.kind === "extra"
      ).length;

      return {
        student,
        regularPresentCount,
        makeupPresentCount,
        extraPresentCount,
        totalPresentCount: regularPresentCount + makeupPresentCount + extraPresentCount,
      };
    });
  }, [students, monthlySessions]);

  const localTeacherServiceTotal = localAttendanceRows.reduce(
    (total, row) => total + row.totalPresentCount,
    0
  );

  const monthlyPresentCount = monthlySessions.filter(
    (session) => session.status === "present"
  ).length;
  const monthlyAbsentCount = monthlySessions.filter(
    (session) => session.status === "absent"
  ).length;
  const monthlyPendingCount = monthlySessions.filter(
    (session) => session.status === "pending"
  ).length;

  useEffect(() => {
    let cancelled = false;

    fetchMonthlyStatistics(monthToken)
      .then((result) => {
        if (cancelled) return;
        setBackendStatistics(result);
        setIsStatisticsBackendAvailable(true);
        setStatisticsError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setBackendStatistics(null);
        setIsStatisticsBackendAvailable(false);
        setStatisticsError("統計資料暫時無法從後端載入，已使用本地資料");
        console.warn("Backend statistics unavailable, using local data", error);
      });

    return () => {
      cancelled = true;
    };
  }, [monthToken]);

  const displayAttendanceRows = useMemo(
    () =>
      isStatisticsBackendAvailable && backendStatistics
        ? backendStatistics.students.map(statisticsStudentRowToAttendanceRow)
        : localAttendanceRows,
    [backendStatistics, isStatisticsBackendAvailable, localAttendanceRows]
  );

  const displaySummary =
    isStatisticsBackendAvailable && backendStatistics
      ? backendStatistics.summary
      : {
          teacherServiceTotal: localTeacherServiceTotal,
          monthlySessionCount: monthlySessions.length,
          presentCount: monthlyPresentCount,
          absentCount: monthlyAbsentCount,
          pendingCount: monthlyPendingCount,
          cancelledCount: monthlySessions.filter((session) => session.status === "cancelled")
            .length,
          scheduleRuleCount: studentScheduleRules.length,
          globalEventCount: globalEvents.length,
        };

  const directServiceOptions = useMemo(
    () => uniqueDirectServiceOptions(columnCandidates, availableColumns),
    [columnCandidates, availableColumns]
  );

  useEffect(() => {
    if (!worksheetData) {
      setMatchedRows([]);
      setUnmatchedStudents([]);
      setDuplicatedMatches([]);
      return;
    }

    const result = matchStudentsToWorksheet({
      worksheet: worksheetData.worksheet,
      range: worksheetData.range,
      nameColumn,
      birthdayColumn,
      directServiceColumn,
      attendanceRows: localAttendanceRows,
    });

    setMatchedRows(result.matchedRows);
    setUnmatchedStudents(result.unmatchedStudents);
    setDuplicatedMatches(result.duplicatedMatches);
  }, [worksheetData, nameColumn, birthdayColumn, directServiceColumn, localAttendanceRows]);

  function applyWorksheet(nextWorkbook: XLSX.WorkBook, sheetName: string) {
    const worksheet = nextWorkbook.Sheets[sheetName];
    const range = worksheet?.["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;

    if (!worksheet || !range) {
      setWorksheetData(null);
      setAvailableColumns([]);
      setColumnCandidates([]);
      setNameColumn("");
      setBirthdayColumn("");
      setDirectServiceColumn("");
      return;
    }

    const maxHeaderRows = 15;
    const analysis = analyzeWorksheetColumns(worksheet, monthShortLabel, maxHeaderRows);

    setWorksheetData({ worksheet, range, maxHeaderRows });
    setAvailableColumns(analysis.availableColumns);
    setColumnCandidates(analysis.columnCandidates);
    setNameColumn(analysis.nameColumn);
    setBirthdayColumn(analysis.birthdayColumn);
    setDirectServiceColumn(analysis.directServiceColumn);
  }

  async function handleTemplateFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setTemplateReadError("");

    try {
      const { workbook: nextWorkbook, arrayBuffer } = await readWorkbookFromFile(file);
      const nextSheetNames = nextWorkbook.SheetNames ?? [];
      const firstSheetName = nextSheetNames[0] ?? "";

      setTemplateFileName(file.name);
      setTemplateArrayBuffer(arrayBuffer.slice(0));
      setWorkbook(nextWorkbook);
      setSheetNames(nextSheetNames);
      setSelectedSheetName(firstSheetName);

      if (firstSheetName) {
        applyWorksheet(nextWorkbook, firstSheetName);
        setToast("已讀取 xlsx 模板");
      } else {
        setWorksheetData(null);
        setTemplateReadError("模板內找不到工作表");
      }
    } catch {
      setTemplateFileName(file.name);
      setTemplateArrayBuffer(null);
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheetName("");
      setWorksheetData(null);
      setAvailableColumns([]);
      setColumnCandidates([]);
      setNameColumn("");
      setBirthdayColumn("");
      setDirectServiceColumn("");
      setTemplateReadError("無法讀取此 xlsx 模板，請確認檔案格式是否正確");
      setToast("無法讀取此 xlsx 模板");
    } finally {
      event.target.value = "";
    }
  }

  function handleSheetChange(nextSheetName: string) {
    setSelectedSheetName(nextSheetName);
    if (workbook) applyWorksheet(workbook, nextSheetName);
  }

  const pageBg = isDark ? "bg-[#111214] text-white" : "bg-[#F2F2F7] text-[#1C1C1E]";
  const cardClass = isDark
    ? "rounded-[24px] bg-[#1C1C1E] ring-1 ring-white/10 shadow-sm"
    : "rounded-[24px] bg-white ring-1 ring-[#E5E5EA] shadow-sm";
  const mutedTextClass = isDark ? "text-[#8E8E93]" : "text-slate-500";
  const tableHeadClass = isDark
    ? "border-white/10 bg-[#2C2C2E] text-[#D1D1D6]"
    : "border-[#E5E5EA] bg-[#F2F2F7] text-slate-600";
  const tableCellClass = isDark ? "border-white/10" : "border-[#E5E5EA]";
  const softButtonClass = isDark
    ? "rounded-full bg-[#2C2C2E] px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#3A3A3C]"
    : "rounded-full bg-[#F2F2F7] px-4 py-2.5 text-[14px] font-medium text-[#1C1C1E] ring-1 ring-[#E5E5EA] transition hover:bg-[#EAEAEE]";
  const disabledButtonClass = isDark
    ? "rounded-full bg-[#2C2C2E] px-4 py-2.5 text-[14px] font-semibold text-[#8E8E93] opacity-70"
    : "rounded-full bg-[#E5E5EA] px-4 py-2.5 text-[14px] font-semibold text-slate-500 opacity-80";
  const selectClass = isDark
    ? "w-full rounded-2xl border border-white/10 bg-[#2C2C2E] px-4 py-3 text-[15px] text-white outline-none"
    : "w-full rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3 text-[15px] text-[#1C1C1E] outline-none";

  const serviceCards = [
    { label: "本月出席次數", value: displaySummary.presentCount },
    { label: "本月缺席次數", value: displaySummary.absentCount },
    { label: "未完成點名", value: displaySummary.pendingCount },
    { label: "本月課次總數", value: displaySummary.monthlySessionCount },
  ];

  const canExportFilledTemplate = Boolean(
    templateArrayBuffer && selectedSheetName && directServiceColumn && matchedRows.length > 0
  );
  const exportTargetColumn = getColumnLetters(matchedRows[0]?.cellAddress);

  function handleOpenExportConfirm() {
    setIsExportConfirmOpen(true);
  }

  async function handleConfirmExport() {
    setIsExportConfirmOpen(false);
    await exportFilledTemplate();
  }

  function downloadFilledTemplate(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFileName(templateFileName, selectedDate);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportFilledTemplateWithBackend() {
    if (!templateArrayBuffer) {
      throw new Error("Template buffer is required");
    }

    const templateBlob = new Blob([templateArrayBuffer.slice(0)], {
      type: XLSX_MEDIA_TYPE,
    });
    const payload: ExcelFillTemplatePayload = {
      worksheetName: selectedSheetName,
      month: monthToken,
      writes: matchedRows.map((row) => ({
        cellAddress: row.cellAddress,
        value: row.value,
        studentId: row.student.id,
        studentName: row.student.name,
        birthday: row.student.birthday || null,
        reason: "direct_service_count",
      })),
      options: {
        preserveTemplate: true,
      },
    };

    return fillExcelTemplate(templateBlob, payload);
  }

  async function exportFilledTemplateLocally() {
    if (!templateArrayBuffer) {
      throw new Error("Template buffer is required");
    }

    const XlsxPopulate = await loadXlsxPopulate();
    const populatedWorkbook = await XlsxPopulate.fromDataAsync(templateArrayBuffer.slice(0));
    const sheet = populatedWorkbook.sheet(selectedSheetName);

    if (!sheet) {
      throw new Error("Selected worksheet not found");
    }

    matchedRows.forEach((row) => {
      sheet.cell(row.cellAddress).value(row.value);
    });

    const output = await populatedWorkbook.outputAsync();
    if (output instanceof Blob) {
      return output;
    }
    if (output instanceof Uint8Array) {
      const outputBuffer = new ArrayBuffer(output.byteLength);
      new Uint8Array(outputBuffer).set(output);
      return new Blob([outputBuffer], {
        type: XLSX_MEDIA_TYPE,
      });
    }
    return new Blob([output], {
      type: XLSX_MEDIA_TYPE,
    });
  }

  async function exportFilledTemplate() {
    if (!templateArrayBuffer) {
      setToast("請先選擇 xlsx 模板");
      return;
    }

    if (!selectedSheetName) {
      setToast("請先選擇工作表");
      return;
    }

    if (!directServiceColumn) {
      setToast("請先選擇要填入的欄位");
      return;
    }

    if (matchedRows.length === 0) {
      setToast("沒有可填入的匹配學生");
      return;
    }

    try {
      const blob = await exportFilledTemplateWithBackend();
      downloadFilledTemplate(blob);
      setToast(`已匯出並填入 ${matchedRows.length} 筆資料`);
      return;
    } catch (backendError) {
      console.warn("Backend Excel export failed, using local export", backendError);
      setToast("後端匯出失敗，已使用本地匯出");
    }

    try {
      const blob = await exportFilledTemplateLocally();
      downloadFilledTemplate(blob);
      setToast(`已匯出並填入 ${matchedRows.length} 筆資料`);
    } catch (error) {
      console.error("Export filled template failed", error);
      setToast("匯出失敗，請確認模板格式是否正確");
    }
  }

  return (
    <>
    <div className={pageBg}>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <HeaderBar
          title="數據與匯出"
          icon={<IconFile className="h-6 w-6" />}
          right={
            <ThemeToggle
              isDark={isDark}
              interactive
              onSelect={(nextTheme) => setTheme(nextTheme)}
            />
          }
        />
        <div className={`mt-3 px-1 text-sm ${mutedTextClass}`}>
          查看出席統計，並填入官方 Excel 模板
        </div>

        <div className="mt-5 grid gap-4">
          <section className={cardClass}>
            <div className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={`text-[13px] font-medium ${mutedTextClass}`}>目標月份</div>
                  <div className="mt-1 text-[28px] font-extrabold tracking-[-0.03em]">
                    {monthLabel}
                  </div>
                  <div className={`mt-1 text-[13px] ${mutedTextClass}`}>
                    {monthRange.monthStartISO} 至 {monthRange.monthEndISO}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={softButtonClass}
                    onClick={() => setSelectedDate(addMonthsISO(selectedDate, -1))}
                  >
                    <span className="inline-flex items-center gap-1">
                      <IconChevronLeft className="h-4 w-4" />
                      上一個月
                    </span>
                  </button>
                  <button
                    type="button"
                    className={softButtonClass}
                    onClick={() => setSelectedDate(todayISO())}
                  >
                    回到本月
                  </button>
                  <button
                    type="button"
                    className={softButtonClass}
                    onClick={() => setSelectedDate(addMonthsISO(selectedDate, 1))}
                  >
                    <span className="inline-flex items-center gap-1">
                      下一個月
                      <IconChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="grid gap-3 lg:grid-cols-[1.25fr_2fr]">
              <div className={cardClass}>
                <div className="p-5">
                  <div className={`text-[13px] font-medium ${mutedTextClass}`}>
                    老師服務總次數
                  </div>
                  <div className="mt-3 text-[48px] font-extrabold leading-none tracking-[-0.06em]">
                    {displaySummary.teacherServiceTotal}
                  </div>
                  <div className={`mt-3 text-[13px] leading-5 ${mutedTextClass}`}>
                    由每位學生的 regular / makeup / extra 出席合計加總。
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {serviceCards.map((item) => (
                  <div key={item.label} className={cardClass}>
                    <div className="p-4">
                      <div className={`text-[12px] font-medium leading-5 ${mutedTextClass}`}>
                        {item.label}
                      </div>
                      <div className="mt-2 text-[26px] font-bold tracking-[-0.04em]">
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[18px] font-bold tracking-[-0.02em]">
                    每學生出席次數
                  </div>
                  <div className={`mt-1 text-[13px] ${mutedTextClass}`}>
                    用於填寫「個別 / 直接服務」欄
                    {statisticsError ? (
                      <div className="mt-1 text-[12px] text-[#ff9500]">
                        {statisticsError}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="text-[13px] font-semibold text-[#007AFF]">
                  個別直接服務合計：{displaySummary.teacherServiceTotal} 次
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[13px]">
                  <thead>
                    <tr>
                      {["學生", "生日", "學校", "狀態", "regular", "makeup", "extra", "合計"].map(
                        (label) => (
                          <th
                            key={label}
                            className={`border-b px-3 py-3 font-semibold first:rounded-tl-2xl last:rounded-tr-2xl ${tableHeadClass}`}
                          >
                            {label}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {displayAttendanceRows.map((row) => {
                      const expanded = expandedStudentIds.has(row.student.id);
                      const detailSessions =
                        sessionsByStudentId.get(row.student.id) ?? [];
                      const detailRowId = `student-detail-${row.student.id}`;
                      const hoverRowClass = isDark
                        ? "cursor-pointer hover:bg-white/[0.04]"
                        : "cursor-pointer hover:bg-black/[0.03]";
                      return (
                        <Fragment key={row.student.id}>
                          <tr
                            onClick={() => toggleStudentExpanded(row.student.id)}
                            aria-expanded={expanded}
                            aria-controls={detailRowId}
                            className={hoverRowClass}
                          >
                            <td className={`border-b px-3 py-3 font-semibold ${tableCellClass}`}>
                              <span className="inline-flex items-center gap-1">
                                <span
                                  aria-hidden="true"
                                  className={`text-[12px] ${mutedTextClass}`}
                                >
                                  {expanded ? "▴" : "▾"}
                                </span>
                                {row.student.name}
                              </span>
                            </td>
                            <td className={`border-b px-3 py-3 ${mutedTextClass} ${tableCellClass}`}>
                              {row.student.birthday || "-"}
                            </td>
                            <td className={`border-b px-3 py-3 ${mutedTextClass} ${tableCellClass}`}>
                              {row.student.school || "-"}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {formatStatus(row.student.status)}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {row.regularPresentCount}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {row.makeupPresentCount}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {row.extraPresentCount}
                            </td>
                            <td className={`border-b px-3 py-3 font-bold ${tableCellClass}`}>
                              {row.totalPresentCount}
                            </td>
                          </tr>
                          {expanded ? (
                            <tr id={detailRowId}>
                              <td
                                colSpan={8}
                                className={`border-b px-3 py-4 ${tableCellClass} ${
                                  isDark ? "bg-[#161618]" : "bg-[#FAFAFB]"
                                }`}
                              >
                                <div className={`text-[13px] font-semibold`}>
                                  本月課次紀錄（共 {detailSessions.length} 筆，含待處理 / 已取消）
                                </div>
                                {detailSessions.length === 0 ? (
                                  <div
                                    className={`mt-2 text-[13px] ${mutedTextClass}`}
                                  >
                                    本月無課次紀錄。
                                  </div>
                                ) : (
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full border-separate border-spacing-0 text-left text-[12.5px]">
                                      <thead>
                                        <tr>
                                          {["日期", "開始時間", "時長", "kind", "status"].map(
                                            (label) => (
                                              <th
                                                key={label}
                                                className={`border-b px-3 py-2 font-semibold ${tableHeadClass}`}
                                              >
                                                {label}
                                              </th>
                                            )
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detailSessions.map((session) => (
                                          <tr key={session.id}>
                                            <td className={`border-b px-3 py-2 ${tableCellClass}`}>
                                              {session.dateISO}
                                            </td>
                                            <td className={`border-b px-3 py-2 ${tableCellClass}`}>
                                              {session.start}
                                            </td>
                                            <td className={`border-b px-3 py-2 ${tableCellClass}`}>
                                              {session.durationMin} 分鐘
                                            </td>
                                            <td className={`border-b px-3 py-2 ${tableCellClass}`}>
                                              <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getSessionKindBadgeClass(
                                                  session.kind,
                                                  isDark
                                                )}`}
                                              >
                                                {session.kind}
                                              </span>
                                            </td>
                                            <td className={`border-b px-3 py-2 ${tableCellClass}`}>
                                              <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getSessionStatusBadgeClass(
                                                  session.status,
                                                  isDark
                                                )}`}
                                              >
                                                {formatSessionStatusLabel(session.status)}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {displayAttendanceRows.length === 0 ? (
                <div className={`py-8 text-center text-[14px] ${mutedTextClass}`}>
                  尚未建立學生資料。
                </div>
              ) : null}
            </div>
          </section>

          <section className={cardClass}>
            <div className="p-4">
              <div className="text-[18px] font-bold tracking-[-0.02em]">
                官方 Excel 模板填寫
              </div>
              <div className={`mt-1 text-[13px] leading-5 ${mutedTextClass}`}>
                選擇官方模板後，系統會識別工作表、欄位與學生行，並預覽「個別 / 直接服務」將填入的數字。
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div
                  className={`rounded-2xl p-4 ring-1 ${
                    isDark ? "bg-[#2C2C2E] ring-white/10" : "bg-[#F2F2F7] ring-[#E5E5EA]"
                  }`}
                >
                  <div className="text-[15px] font-semibold">模板檔案</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleTemplateFileChange}
                    />
                    <button
                      type="button"
                      className={softButtonClass}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      選擇 xlsx 模板
                    </button>
                    <span className={`text-[13px] ${mutedTextClass}`}>
                      目前模板：{templateFileName || "尚未選擇"}
                    </span>
                  </div>

                  {templateReadError ? (
                    <div className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] text-red-500">
                      {templateReadError}
                    </div>
                  ) : null}

                  <div
                    className={`mt-4 rounded-2xl p-4 ${
                      isDark ? "bg-[#1C1C1E]" : "bg-white"
                    }`}
                  >
                    <div className="text-[13px] font-semibold">目標項目</div>
                    <div className={`mt-2 space-y-1 text-[13px] ${mutedTextClass}`}>
                      <div>目標月份：{monthLabel}</div>
                      <div>填寫項目：個別 / 直接服務</div>
                      <div>已接入固定課表規則：{studentScheduleRules.length} 條</div>
                      <div>已接入全局事件資料：{globalEvents.length} 筆</div>
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <div className={`mb-2 text-[13px] font-medium ${mutedTextClass}`}>工作表</div>
                    <select
                      className={selectClass}
                      value={selectedSheetName}
                      onChange={(event) => handleSheetChange(event.target.value)}
                      disabled={sheetNames.length === 0}
                    >
                      {sheetNames.length === 0 ? (
                        <option value="">尚未載入工作表</option>
                      ) : (
                        sheetNames.map((sheetName) => (
                          <option key={sheetName} value={sheetName}>
                            {sheetName}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>

                <div
                  className={`rounded-2xl p-4 ring-1 ${
                    isDark ? "bg-[#2C2C2E] ring-white/10" : "bg-[#F2F2F7] ring-[#E5E5EA]"
                  }`}
                >
                  <div className="text-[15px] font-semibold">欄位確認</div>

                  <div className="mt-3 grid gap-3">
                    <label>
                      <div className={`mb-2 text-[13px] font-medium ${mutedTextClass}`}>姓名欄</div>
                      <select
                        className={selectClass}
                        value={nameColumn}
                        onChange={(event) => setNameColumn(event.target.value)}
                        disabled={availableColumns.length === 0}
                      >
                        <option value="">請選擇姓名欄</option>
                        {availableColumns.map((column) => (
                          <option key={column.column} value={column.column}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <div className={`mb-2 text-[13px] font-medium ${mutedTextClass}`}>
                        出生日期欄
                      </div>
                      <select
                        className={selectClass}
                        value={birthdayColumn}
                        onChange={(event) => setBirthdayColumn(event.target.value)}
                        disabled={availableColumns.length === 0}
                      >
                        <option value="">請選擇出生日期欄</option>
                        {availableColumns.map((column) => (
                          <option key={column.column} value={column.column}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <div className={`mb-2 text-[13px] font-medium ${mutedTextClass}`}>
                        個別 / 直接服務欄
                      </div>
                      <select
                        className={selectClass}
                        value={directServiceColumn}
                        onChange={(event) => setDirectServiceColumn(event.target.value)}
                        disabled={directServiceOptions.length === 0}
                      >
                        <option value="">請選擇欄位</option>
                        {directServiceOptions.map((column) => (
                          <option key={column.column} value={column.column}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={`mt-3 text-[12px] leading-5 ${mutedTextClass}`}>
                    {columnCandidates.length > 0
                      ? `已識別 ${columnCandidates.length} 個「直接服務」候選欄位，優先選取符合 ${monthShortLabel} / 個別 / 直接服務的欄位。`
                      : "未能自動識別候選欄位，請手動選擇欄位。"}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div
                  className={`rounded-2xl p-4 ring-1 ${
                    isDark ? "bg-[#2C2C2E] ring-white/10" : "bg-[#F2F2F7] ring-[#E5E5EA]"
                  }`}
                >
                  <div className="text-[15px] font-semibold">學生匹配結果</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ["成功匹配", matchedRows.length],
                      ["未匹配", unmatchedStudents.length],
                      ["多重匹配", duplicatedMatches.length],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className={`rounded-2xl p-3 ${isDark ? "bg-[#1C1C1E]" : "bg-white"}`}
                      >
                        <div className={`text-[12px] ${mutedTextClass}`}>{label}</div>
                        <div className="mt-1 text-[22px] font-bold">{value}</div>
                      </div>
                    ))}
                  </div>
                  {!worksheetData ? (
                    <div className={`mt-3 text-[13px] ${mutedTextClass}`}>
                      尚未載入模板，暫無匹配結果
                    </div>
                  ) : null}
                </div>

                <div
                  className={`rounded-2xl p-4 ring-1 ${
                    isDark ? "bg-[#2C2C2E] ring-white/10" : "bg-[#F2F2F7] ring-[#E5E5EA]"
                  }`}
                >
                  <div className="text-[15px] font-semibold">匹配問題</div>
                  {unmatchedStudents.length === 0 && duplicatedMatches.length === 0 ? (
                    <div className={`mt-3 text-[13px] ${mutedTextClass}`}>
                      {worksheetData ? "目前沒有未匹配或多重匹配項目。" : "載入模板後會顯示匹配問題。"}
                    </div>
                  ) : null}

                  {unmatchedStudents.length > 0 ? (
                    <div className="mt-3">
                      <div className={`text-[13px] font-semibold ${mutedTextClass}`}>
                        未匹配學生
                      </div>
                      <div className="mt-2 space-y-2">
                        {unmatchedStudents.map((row) => (
                          <div
                            key={row.student.id}
                            className={`rounded-2xl px-3 py-2 text-[13px] ${
                              isDark ? "bg-[#1C1C1E]" : "bg-white"
                            }`}
                          >
                            {row.student.name} · {row.student.birthday || "-"} ·{" "}
                            {row.student.school || "-"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {duplicatedMatches.length > 0 ? (
                    <div className="mt-3">
                      <div className={`text-[13px] font-semibold ${mutedTextClass}`}>
                        多重匹配
                      </div>
                      <div className="mt-2 space-y-2">
                        {duplicatedMatches.map((item) => (
                          <div
                            key={item.student.id}
                            className={`rounded-2xl px-3 py-2 text-[13px] ${
                              isDark ? "bg-[#1C1C1E]" : "bg-white"
                            }`}
                          >
                            {item.student.name} · {item.student.birthday || "-"} · Excel 行{" "}
                            {item.excelRows.join(", ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[15px] font-semibold">填入預覽</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-[13px]">
                    <thead>
                      <tr>
                        {["學生", "生日", "Excel 行", "欄位", "原本值", "將填入數字"].map((label) => (
                          <th
                            key={label}
                            className={`border-b px-3 py-3 font-semibold first:rounded-tl-2xl last:rounded-tr-2xl ${tableHeadClass}`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matchedRows.length > 0 ? (
                        matchedRows.map((row) => (
                          <tr key={row.student.id}>
                            <td className={`border-b px-3 py-3 font-semibold ${tableCellClass}`}>
                              {row.student.name}
                            </td>
                            <td className={`border-b px-3 py-3 ${mutedTextClass} ${tableCellClass}`}>
                              {row.student.birthday || "-"}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {row.excelRow}
                            </td>
                            <td className={`border-b px-3 py-3 ${tableCellClass}`}>
                              {row.cellAddress}
                            </td>
                            <td className={`border-b px-3 py-3 ${mutedTextClass} ${tableCellClass}`}>
                              {row.originalValue}
                            </td>
                            <td className={`border-b px-3 py-3 font-bold ${tableCellClass}`}>
                              {row.value}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className={`border-b px-3 py-8 text-center ${mutedTextClass} ${tableCellClass}`}
                          >
                            載入模板並選擇欄位後，這裡會顯示將填入的資料。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className={canExportFilledTemplate ? softButtonClass : disabledButtonClass}
                    disabled={!canExportFilledTemplate}
                    onClick={handleOpenExportConfirm}
                  >
                    匯出並填入官方模板
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
    <IOSSheet
      open={isExportConfirmOpen}
      title="匯出前確認"
      subtitle="請確認本次寫入範圍"
      leftAction={{ label: "取消", onClick: () => setIsExportConfirmOpen(false) }}
      rightAction={{
        label: "確認匯出",
        onClick: () => void handleConfirmExport(),
        emphasize: true,
      }}
      onClose={() => setIsExportConfirmOpen(false)}
    >
      <div className="space-y-4">
        <div className={`rounded-[20px] p-4 ${isDark ? "bg-[#111214]" : "bg-[#F2F2F7]"}`}>
          <div className="grid gap-3 text-[14px]">
            {[
              ["即將寫入", `${matchedRows.length} 筆資料`],
              ["工作表", selectedSheetName || "—"],
              ["目標月份", monthLabel],
              ["目標欄位", exportTargetColumn],
              ["成功匹配", matchedRows.length],
              ["未匹配", unmatchedStudents.length],
              ["多重匹配", duplicatedMatches.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className={mutedTextClass}>{label}</span>
                <span className="text-right font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[20px] p-4 text-[13px] leading-6 ${isDark ? "bg-[#111214] text-[#D1D1D6]" : "bg-[#F2F2F7] text-slate-600"}`}>
          系統只會修改成功匹配學生在目標欄位的數字。未匹配與多重匹配的學生不會寫入。
          不會新增行、刪除行，亦不會修改其他月份或其他欄位。
        </div>
      </div>
    </IOSSheet>
    </>
  );
}
