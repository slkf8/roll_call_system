/// <reference types="node" />

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { fillExcelTemplate } from "../../api/exportsApi";
import { fetchMonthlyStatistics } from "../../api/statisticsApi";
import type { MonthlyStatistics } from "../../api/statisticsApi";
import DataPage from "../DataPage";
import type {
  GlobalEvent,
  Session,
  StudentProfile,
  StudentScheduleRule,
} from "../../shared/appShared";
import {
  buildMaterialsReasonString,
  isValidMaterialsReasonString,
  MATERIALS_REASON_MAX_LEN,
} from "../../shared/appShared";

vi.mock("../../api/statisticsApi", () => ({
  fetchMonthlyStatistics: vi.fn(),
}));

vi.mock("../../api/exportsApi", () => ({
  fillExcelTemplate: vi.fn(),
}));

type Snapshot = {
  selectedDate: string;
  students: StudentProfile[];
  sessions: Session[];
  toasts: string[];
};

const selectedDate = "2026-11-15";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function makeMonthlyStatistics(overrides: Partial<MonthlyStatistics> = {}): MonthlyStatistics {
  const base: MonthlyStatistics = {
    month: "2026-11",
    from: "2026-11-01",
    to: "2026-11-30",
    summary: {
      teacherServiceTotal: 42,
      monthlySessionCount: 99,
      presentCount: 77,
      absentCount: 8,
      pendingCount: 6,
      cancelledCount: 5,
      scheduleRuleCount: 3,
      globalEventCount: 2,
      materialsCount: 0,
    },
    students: [
      {
        studentId: 101,
        studentName: "後端統計學生",
        birthday: "2014-04-05",
        school: "後端學校",
        status: "active",
        regularPresentCount: 10,
        makeupPresentCount: 2,
        extraPresentCount: 1,
        totalPresentCount: 13,
        materialsCount: 0,
      },
    ],
    warnings: [],
  };

  return {
    ...base,
    ...overrides,
    summary: {
      ...base.summary,
      ...(overrides.summary ?? {}),
    },
    students: overrides.students ?? base.students,
    warnings: overrides.warnings ?? base.warnings,
  };
}

function makeStudents(): StudentProfile[] {
  return [
    {
      id: 1,
      name: "陳小明",
      birthday: "2012-03-08",
      school: "培正中學",
      status: "active",
    },
    {
      id: 2,
      name: "李小欣",
      birthday: "2011-11-21",
      school: "聖羅撒女子中學",
      status: "active",
    },
    {
      id: 3,
      name: "王家朗",
      birthday: "2012-03-08",
      school: "澳門坊眾學校",
      status: "inactive",
    },
  ];
}

function makeSessions(): Session[] {
  return [
    {
      id: 1,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-11-01",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 2,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-11-08",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 3,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-11-15",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "makeup",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 4,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-11-22",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "extra",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 5,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-11-29",
      start: "10:00",
      durationMin: 60,
      status: "absent",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 6,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO: "2026-10-25",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 7,
      studentId: 2,
      student: { id: 2, name: "李小欣" },
      dateISO: "2026-11-03",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 8,
      studentId: 2,
      student: { id: 2, name: "李小欣" },
      dateISO: "2026-11-10",
      start: "10:00",
      durationMin: 60,
      status: "pending",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
    {
      id: 9,
      studentId: 3,
      student: { id: 3, name: "王家朗" },
      dateISO: "2026-11-05",
      start: "10:00",
      durationMin: 60,
      status: "present",
      kind: "regular",
      materialsProvided: false,
      materialsReasonCode: null,
    },
  ];
}

function dateToExcelSerial(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function setCell(
  worksheet: XLSX.WorkSheet,
  address: string,
  value: string | number,
  type?: XLSX.ExcelDataType
) {
  worksheet[address] = {
    t: type ?? (typeof value === "number" ? "n" : "s"),
    v: value,
  };
}

function createSyntheticTemplateWorkbook({
  mode = "all",
}: {
  mode?: "all" | "chenOnly" | "duplicateChen" | "dateCells" | "none";
} = {}) {
  const worksheet: XLSX.WorkSheet = {};

  setCell(worksheet, "C3", "姓名");
  setCell(worksheet, "E3", "出生日期");
  setCell(worksheet, "AC1", "11月各情況次數");
  setCell(worksheet, "AC2", "個別");
  setCell(worksheet, "AG2", "2人小組");
  setCell(worksheet, "AH2", "3人小組");
  setCell(worksheet, "AC3", "直接服務");
  setCell(worksheet, "AG3", "直接服務");
  setCell(worksheet, "AH3", "直接服務");
  setCell(worksheet, "AJ3", "備註");

  if (mode === "all" || mode === "chenOnly" || mode === "duplicateChen") {
    setCell(worksheet, "C6", "陳小明");
    setCell(worksheet, "E6", "08/03/2012");
    setCell(worksheet, "AC6", 3);
    setCell(worksheet, "AG6", 99);
    setCell(worksheet, "AH6", 88);
    setCell(worksheet, "AJ6", "不要改");
  }

  if (mode === "all" || mode === "duplicateChen" || mode === "dateCells") {
    setCell(worksheet, "C7", "李小欣");
    if (mode === "dateCells") {
      worksheet.E7 = { t: "d", v: new Date("2011-11-20T15:59:50.000Z"), w: "21/11/2011" };
    } else {
      setCell(worksheet, "E7", "2011-11-21");
    }
    setCell(worksheet, "AG7", 77);
    setCell(worksheet, "AH7", 66);
    setCell(worksheet, "AJ7", "不要改");

    setCell(worksheet, "C8", "王家朗");
    if (mode === "dateCells") {
      worksheet.E8 = { t: "d", v: new Date("2012-03-07T15:59:50.000Z"), w: "08/03/2012" };
    } else {
      setCell(worksheet, "E8", dateToExcelSerial("2012-03-08"));
    }
    setCell(worksheet, "AC8", 0);
    setCell(worksheet, "AG8", 55);
    setCell(worksheet, "AH8", 44);
    setCell(worksheet, "AJ8", "不要改");
  }

  if (mode === "duplicateChen") {
    setCell(worksheet, "C9", "陳小明");
    setCell(worksheet, "E9", "08/03/2012");
    setCell(worksheet, "AC9", 5);
  }

  worksheet["!ref"] = "A1:AJ9";
  worksheet["!merges"] = [XLSX.utils.decode_range("AC1:AI1")];

  return {
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: worksheet,
    },
  } satisfies XLSX.WorkBook;
}

function workbookToFile(workbook: XLSX.WorkBook, filename: string) {
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new File([output], filename, { type: xlsxMime });
}

// Replacement for the previous on-disk official-template.xlsx fixture.
// Builds a multi-month synthetic workbook (9月 / 10月 / 11月) that mirrors
// the real official monthly statistics template shape -- 3-row hierarchical
// header with merged month sections, three subgroups (個別 / 2人小組 /
// 3人小組) each with 直接服務 + 視像 leaves, plus a 備註 column. No real
// student data is included; the few visible names match other synthetic
// fixtures already in this file.
// Mirrors the real official monthly-statistics template: a 3-row hierarchical
// header where every month is a 7-column block:
//   +0 個別>直接服務     +1 個別>出席會議   +2 個別>視像
//   +3 個別>配合圖文資料提供諮詢/建議
//   +4 2人小組>直接服務  +5 3人小組>直接服務
//   +6 視像或配合圖文資料提供諮詢/建議原因 (row2:row3 merged)
// Real layout: 9月 O..U, 10月 V..AB, 11月 AC..AI. No real student data.
function createOfficialLikeTemplateWorkbook({
  slash = "/",
  includeTargetMonth = true,
}: { slash?: "/" | "／"; includeTargetMonth?: boolean } = {}) {
  const worksheet: XLSX.WorkSheet = {};
  const consult = `配合圖文資料提供諮詢${slash}建議`;
  const reasonLabel = `視像或配合圖文資料提供諮詢${slash}建議原因`;

  const colAt = (start: string, offset: number) =>
    XLSX.utils.encode_col(XLSX.utils.decode_col(start) + offset);

  const allMonths: Array<{ label: string; startCol: string }> = [
    { label: "9月各情況次數", startCol: "O" },
    { label: "10月各情況次數", startCol: "V" },
    { label: "11月各情況次數", startCol: "AC" },
  ];
  // Target month (selectedDate default = 2026-11). Dropping it lets us assert
  // that medium/low materials candidates are NOT auto-selected.
  const months = includeTargetMonth ? allMonths : allMonths.slice(0, 2);

  const merges: XLSX.Range[] = [];

  for (const m of months) {
    const c = (offset: number) => colAt(m.startCol, offset);
    // Row 1: month label merged across the whole 7-column block.
    setCell(worksheet, `${c(0)}1`, m.label);
    merges.push(XLSX.utils.decode_range(`${c(0)}1:${c(6)}1`));
    // Row 2: 個別 spans the first 4 leaf columns; 2人小組 / 3人小組 single;
    // the reason column label spans row2:row3.
    setCell(worksheet, `${c(0)}2`, "個別");
    merges.push(XLSX.utils.decode_range(`${c(0)}2:${c(3)}2`));
    setCell(worksheet, `${c(4)}2`, "2人小組");
    setCell(worksheet, `${c(5)}2`, "3人小組");
    setCell(worksheet, `${c(6)}2`, reasonLabel);
    merges.push(XLSX.utils.decode_range(`${c(6)}2:${c(6)}3`));
    // Row 3: leaf labels.
    setCell(worksheet, `${c(0)}3`, "直接服務");
    setCell(worksheet, `${c(1)}3`, "出席會議");
    setCell(worksheet, `${c(2)}3`, "視像");
    setCell(worksheet, `${c(3)}3`, consult);
    setCell(worksheet, `${c(4)}3`, "直接服務");
    setCell(worksheet, `${c(5)}3`, "直接服務");
  }

  // Entity-level leaf labels (row 3, same convention as the basic synthetic).
  setCell(worksheet, "C3", "姓名");
  setCell(worksheet, "E3", "出生日期");

  // Synthetic student rows (names match other fixtures in this file).
  setCell(worksheet, "C6", "陳小明");
  setCell(worksheet, "E6", "08/03/2012");
  setCell(worksheet, "C7", "李小欣");
  setCell(worksheet, "E7", "2011-11-21");
  setCell(worksheet, "C8", "王家朗");
  setCell(worksheet, "E8", dateToExcelSerial("2012-03-08"));

  const lastCol = colAt(months[months.length - 1].startCol, 6);
  worksheet["!ref"] = `A1:${lastCol}8`;
  worksheet["!merges"] = merges;

  return {
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: worksheet },
  } satisfies XLSX.WorkBook;
}

function officialLikeWorkbookToFile(
  options: { slash?: "/" | "／"; includeTargetMonth?: boolean } = {}
) {
  // Keep the original filename so the UI assertion below still matches.
  return workbookToFile(createOfficialLikeTemplateWorkbook(options), "official-template.xlsx");
}

// One absent + materials-provided session for a student in 2026-11.
function matSession(
  id: number,
  studentId: number,
  dateISO: string,
  start: string,
  code: 1 | 2 | 3 | 4 | 5 | 6 | null,
  provided = true
): Session {
  return {
    id,
    studentId,
    student: { id: studentId, name: "" },
    dateISO,
    start,
    durationMin: 60,
    status: "absent",
    kind: "regular",
    materialsProvided: provided,
    materialsReasonCode: code,
  };
}

const getMaterialsSelect = () => screen.getByLabelText(/教材次數/) as HTMLSelectElement;
const getReasonSelect = () => screen.getByLabelText(/建議原因欄/) as HTMLSelectElement;

async function uploadTemplate(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  file: File
) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!input) throw new Error("Template input not found");
  await user.upload(input, file);
  await screen.findByText(`目前模板：${file.name}`);
}

async function readExportedWorkbook(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: "array" });
}

function DataPageHarness({
  initialStudents = makeStudents(),
  initialSessions = makeSessions(),
  initialSelectedDate = selectedDate,
  onSnapshot,
}: {
  initialStudents?: StudentProfile[];
  initialSessions?: Session[];
  initialSelectedDate?: string;
  onSnapshot: (snapshot: Snapshot) => void;
}) {
  const [selected, setSelected] = useState(initialSelectedDate);
  const [students] = useState(initialStudents);
  const [sessions] = useState(initialSessions);
  const [toasts, setToasts] = useState<string[]>([]);

  const setTheme: Dispatch<SetStateAction<"light" | "dark">> = () => undefined;
  const setToast: Dispatch<SetStateAction<string>> = (value) => {
    setToasts((current) => {
      const previous = current.length > 0 ? current[current.length - 1] : "";
      const next = typeof value === "function" ? value(previous) : value;
      return next ? [...current, next] : current;
    });
  };

  useEffect(() => {
    onSnapshot({ selectedDate: selected, students, sessions, toasts });
  }, [selected, students, sessions, toasts, onSnapshot]);

  return (
    <DataPage
      setTheme={setTheme}
      selectedDate={selected}
      setSelectedDate={setSelected}
      students={students}
      studentScheduleRules={[] as StudentScheduleRule[]}
      sessions={sessions}
      globalEvents={[] as GlobalEvent[]}
      setToast={setToast}
    />
  );
}

function renderDataPage(options: {
  initialStudents?: StudentProfile[];
  initialSessions?: Session[];
  initialSelectedDate?: string;
} = {}) {
  let snapshot: Snapshot = {
    selectedDate,
    students: [],
    sessions: [],
    toasts: [],
  };
  const user = userEvent.setup();

  const result = render(
    <DataPageHarness
      {...options}
      onSnapshot={(nextSnapshot) => {
        Object.assign(snapshot, nextSnapshot);
      }}
    />
  );

  return {
    ...result,
    user,
    get snapshot() {
      return snapshot;
    },
  };
}

function getValueNearLabel(label: string) {
  const labelNode = screen.getAllByText(label)[0];
  const container =
    labelNode.closest("button") ??
    (labelNode.parentElement?.textContent?.trim() === label
      ? labelNode.parentElement.parentElement
      : labelNode.parentElement);
  if (!container) throw new Error(`Container not found for ${label}`);
  return within(container);
}

function getRowByCell(container: HTMLElement, text: string) {
  const cell = within(container).getByText(text);
  const row = cell.closest("tr");
  if (!row) throw new Error(`Row not found for ${text}`);
  return row;
}

function getSectionByHeading(text: string) {
  const heading = screen.getByText(text);
  const section = heading.closest("section");
  if (!section) throw new Error(`Section not found for ${text}`);
  return section as HTMLElement;
}

function getServiceStatsSheet() {
  const title = screen.getByText("老師服務統計");
  const sheet = title.closest(".fixed");
  if (!sheet) throw new Error("Service stats sheet not found");
  return sheet as HTMLElement;
}

function getSelect(label: string) {
  return screen.getByLabelText(label) as HTMLSelectElement;
}

const SCHOOL_YEAR_KEY = "rollcall-reason6-schoolyear";

// In-memory localStorage so override-display tests are deterministic regardless
// of the jsdom storage implementation. Must be installed before render (DataPage
// reads the override in a useState initializer).
function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMonthlyStatistics).mockRejectedValue(new Error("statistics unavailable"));
  vi.mocked(fillExcelTemplate).mockRejectedValue(new Error("backend export unavailable"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DataPage", () => {
  it("shows zero statistics and an empty student table with empty data", () => {
    renderDataPage({
      initialStudents: [],
      initialSessions: [],
      initialSelectedDate: "2026-05-01",
    });

    expect(getValueNearLabel("老師服務總次數").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("本月出席次數").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("本月缺席次數").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("未完成點名").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("0")).toBeInTheDocument();
    expect(screen.getByText("尚未建立學生資料。")).toBeInTheDocument();
  });

  it("shows monthly service statistics", () => {
    renderDataPage();

    expect(getValueNearLabel("老師服務總次數").getByText("6")).toBeInTheDocument();
    expect(getValueNearLabel("本月出席次數").getByText("6")).toBeInTheDocument();
    expect(getValueNearLabel("本月缺席次數").getByText("1")).toBeInTheDocument();
    expect(getValueNearLabel("未完成點名").getByText("1")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("8")).toBeInTheDocument();
  });

  it("renders a native date input overlay over the target month block", () => {
    renderDataPage();

    const input = screen.getByLabelText(/選擇目標月份，目前為 2026年11月/) as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input).toHaveValue("2026-11-15");

    const block = input.parentElement;
    expect(block).toHaveTextContent("目標月份");
    expect(block).toHaveTextContent("2026年11月");
    expect(block).toHaveTextContent("2026-11-01 至 2026-11-30");
    expect(block?.querySelector("svg")).toBeInTheDocument();

    const cls = input.getAttribute("class") ?? "";
    expect(cls).toContain("absolute");
    expect(cls).toContain("inset-0");
    expect(cls).toContain("h-full");
    expect(cls).toContain("w-full");
    expect(cls).toContain("cursor-pointer");
    expect(cls).toContain("opacity-0");
    expect(cls).not.toContain("pointer-events-none");
    expect(cls).not.toContain("w-0");
    expect(cls).not.toContain("h-0");
    expect(cls).not.toContain("-z-10");
    expect(input.getAttribute("tabindex")).not.toBe("-1");
    expect(screen.queryByText("選擇目標月份")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "完成" })).not.toBeInTheDocument();
  });

  it("updates the target month through the existing selectedDate data flow", async () => {
    const sessions: Session[] = [
      ...makeSessions(),
      {
        id: 40,
        studentId: 2,
        student: { id: 2, name: "李小欣" },
        dateISO: "2026-02-03",
        start: "10:00",
        durationMin: 60,
        status: "present",
        kind: "regular",
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { snapshot } = renderDataPage({ initialSessions: sessions });

    fireEvent.change(screen.getByLabelText(/選擇目標月份/), {
      target: { value: "2026-02-18" },
    });

    expect(snapshot.selectedDate).toBe("2026-02-01");
    expect(screen.getByLabelText(/選擇目標月份，目前為 2026年2月/)).toHaveValue("2026-02-01");
    expect(screen.getByText("2026年2月")).toBeInTheDocument();
    expect(screen.getByText("2026-02-01 至 2026-02-28")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("1")).toBeInTheDocument();
    const section = getSectionByHeading("每學生出席次數");
    expect(getRowByCell(section, "李小欣")).toHaveTextContent("1");
    await waitFor(() => expect(fetchMonthlyStatistics).toHaveBeenCalledWith("2026-02"));
  });

  it("keeps month navigation buttons working", async () => {
    const { user, snapshot } = renderDataPage();

    await user.click(screen.getByRole("button", { name: /上一個月/ }));
    expect(snapshot.selectedDate).toBe("2026-10-01");
    expect(screen.getByLabelText(/選擇目標月份，目前為 2026年10月/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /下一個月/ }));
    await user.click(screen.getByRole("button", { name: /下一個月/ }));
    expect(snapshot.selectedDate).toBe("2026-12-01");
    expect(screen.getByLabelText(/選擇目標月份，目前為 2026年12月/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "回到本月" }));
    expect(snapshot.selectedDate).not.toBe("2026-12-01");
  });

  it("does not POST or write localStorage when changing the target month", async () => {
    const store = installLocalStorage();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderDataPage();

    fireEvent.change(screen.getByLabelText(/選擇目標月份/), {
      target: { value: "2026-12-18" },
    });

    expect(store.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens the teacher-service range sheet from a clickable card with a chevron", async () => {
    const sessions: Session[] = [
      ...makeSessions(),
      {
        id: 20,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2027-01-10",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        materialsProvided: true,
        materialsReasonCode: 4,
      },
    ];
    const { user } = renderDataPage({ initialSessions: sessions });

    const card = screen.getByRole("button", { name: /老師服務總次數/ });
    expect(card.querySelector("svg")).toBeInTheDocument();

    await user.click(card);

    expect(screen.getByText("老師服務統計")).toBeInTheDocument();
    expect(screen.getByLabelText("開始月份")).toHaveValue("2026-09");
    expect(screen.getByLabelText("結束月份")).toHaveValue("2027-08");
    const statsCard = getValueNearLabel("累積服務總次數");
    expect(statsCard.getByText("8")).toBeInTheDocument();
    expect(statsCard.getByText(/正常出席\s+7\s+· 教材\s+1/)).toBeInTheDocument();
  });

  it("updates range totals when the teacher-service sheet months change", async () => {
    const sessions: Session[] = [
      ...makeSessions(),
      {
        id: 20,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2025-12-10",
        start: "10:00",
        durationMin: 60,
        status: "present",
        kind: "extra",
        materialsProvided: false,
        materialsReasonCode: null,
      },
      {
        id: 21,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-01-10",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        materialsProvided: true,
        materialsReasonCode: 6,
      },
    ];
    const { user } = renderDataPage({
      initialSelectedDate: "2026-11-15",
      initialSessions: sessions,
    });

    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    expect(getValueNearLabel("累積服務總次數").getByText("7")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("開始月份"), { target: { value: "2025-12" } });
    fireEvent.change(screen.getByLabelText("結束月份"), { target: { value: "2026-01" } });

    const statsCard = getValueNearLabel("累積服務總次數");
    expect(statsCard.getByText("2")).toBeInTheDocument();
    expect(statsCard.getByText(/正常出席\s+1\s+· 教材\s+1/)).toBeInTheDocument();
  });

  it("blocks invalid teacher-service ranges and resets to the default when reopened", async () => {
    const { user } = renderDataPage({ initialSelectedDate: "2026-01-15" });

    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    expect(screen.getByLabelText("開始月份")).toHaveValue("2025-09");
    expect(screen.getByLabelText("結束月份")).toHaveValue("2026-08");

    fireEvent.change(screen.getByLabelText("開始月份"), { target: { value: "2026-02" } });
    fireEvent.change(screen.getByLabelText("結束月份"), { target: { value: "2026-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("開始月份不可晚於結束月份");
    expect(within(getServiceStatsSheet()).queryByText("累積服務總次數")).not.toBeInTheDocument();
    expect(within(getServiceStatsSheet()).queryByText(/正常出席\s+0\s+· 教材\s+0/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.getByText("老師服務統計")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("結束月份"), { target: { value: "2027-02" } });
    expect(screen.getByRole("alert")).toHaveTextContent("月份範圍最多 12 個月");
    expect(within(getServiceStatsSheet()).queryByText("累積服務總次數")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    expect(screen.getByLabelText("開始月份")).toHaveValue("2025-09");
    expect(screen.getByLabelText("結束月份")).toHaveValue("2026-08");
  });

  it("treats empty teacher-service month fields as invalid without showing stats", async () => {
    const { user } = renderDataPage({ initialSelectedDate: "2026-01-15" });

    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    expect(screen.getByLabelText("開始月份")).toHaveValue("2025-09");
    expect(screen.getByLabelText("結束月份")).toHaveValue("2026-08");

    fireEvent.change(screen.getByLabelText("開始月份"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("請選擇有效月份");
    expect(within(getServiceStatsSheet()).queryByText("累積服務總次數")).not.toBeInTheDocument();
    expect(within(getServiceStatsSheet()).queryByText(/正常出席\s+0\s+· 教材\s+0/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.getByText("老師服務統計")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("開始月份"), { target: { value: "2025-09" } });
    fireEvent.change(screen.getByLabelText("結束月份"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("請選擇有效月份");
    expect(within(getServiceStatsSheet()).queryByText("累積服務總次數")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByText("老師服務統計")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    expect(screen.getByLabelText("開始月份")).toHaveValue("2025-09");
    expect(screen.getByLabelText("結束月份")).toHaveValue("2026-08");
    expect(screen.getByText("累積服務總次數")).toBeInTheDocument();
  });

  it("does not persist teacher-service range changes or call POST", async () => {
    const store = installLocalStorage();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { user } = renderDataPage();

    await user.click(screen.getByRole("button", { name: /老師服務總次數/ }));
    fireEvent.change(screen.getByLabelText("開始月份"), { target: { value: "2026-10" } });
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(store.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the student attendance table headers sticky", () => {
    renderDataPage();

    const section = getSectionByHeading("每學生出席次數");
    const headers = within(section).getAllByRole("columnheader");
    expect(headers[0]).toHaveClass("sticky", "top-0", "z-10");
    const table = headers[0].closest("table");
    expect(table).toHaveClass("w-full", "table-fixed");
    expect(table?.parentElement).not.toHaveClass("overflow-x-auto");
    expect(headers.map((header) => header.textContent)).toEqual([
      "學生",
      "生日",
      "學校",
      "狀態",
      "regular",
      "makeup",
      "extra",
      "教材",
      "合計",
    ]);
  });

  it("loads backend statistics for the selected month", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(makeMonthlyStatistics());

    renderDataPage({ initialSelectedDate: "2026-06-15" });

    await waitFor(() => expect(fetchMonthlyStatistics).toHaveBeenCalledWith("2026-06"));
  });

  it("uses backend statistics for summary cards when available", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(makeMonthlyStatistics());

    renderDataPage();

    await waitFor(() =>
      expect(getValueNearLabel("老師服務總次數").getByText("42")).toBeInTheDocument()
    );
    expect(getValueNearLabel("本月出席次數").getByText("77")).toBeInTheDocument();
    expect(getValueNearLabel("本月缺席次數").getByText("8")).toBeInTheDocument();
    expect(getValueNearLabel("未完成點名").getByText("6")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("99")).toBeInTheDocument();
  });

  it("uses backend statistics for per-student rows when available", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(makeMonthlyStatistics());

    renderDataPage();

    const section = getSectionByHeading("每學生出席次數");
    await within(section).findByText("後端統計學生");

    const backendRow = getRowByCell(section, "後端統計學生");
    expect(within(backendRow).getByText("2014-04-05")).toBeInTheDocument();
    expect(within(backendRow).getByText("後端學校")).toBeInTheDocument();
    expect(within(backendRow).getByText("10")).toBeInTheDocument();
    expect(within(backendRow).getByText("2")).toBeInTheDocument();
    expect(within(backendRow).getByText("13")).toBeInTheDocument();
  });

  it("treats empty backend statistics as a valid empty result", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(
      makeMonthlyStatistics({
        summary: {
          teacherServiceTotal: 0,
          monthlySessionCount: 0,
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0,
          cancelledCount: 0,
          scheduleRuleCount: 0,
          globalEventCount: 0,
          materialsCount: 0,
        },
        students: [],
      })
    );

    renderDataPage();

    await waitFor(() =>
      expect(getValueNearLabel("老師服務總次數").getByText("0")).toBeInTheDocument()
    );
    const section = getSectionByHeading("每學生出席次數");
    expect(within(section).queryByText("陳小明")).not.toBeInTheDocument();
    expect(screen.getByText("尚未建立學生資料。")).toBeInTheDocument();
  });

  it("falls back to local statistics when backend statistics fails", async () => {
    renderDataPage();

    await screen.findByText("統計資料暫時無法從後端載入，已使用本地資料");

    expect(getValueNearLabel("老師服務總次數").getByText("6")).toBeInTheDocument();
    expect(getValueNearLabel("本月出席次數").getByText("6")).toBeInTheDocument();
    expect(getValueNearLabel("本月缺席次數").getByText("1")).toBeInTheDocument();
    expect(getValueNearLabel("未完成點名").getByText("1")).toBeInTheDocument();
    expect(getValueNearLabel("本月課次總數").getByText("8")).toBeInTheDocument();
    expect(screen.getByText("陳小明")).toBeInTheDocument();
  });

  it("shows per-student attendance counts", () => {
    renderDataPage();

    const section = getSectionByHeading("每學生出席次數");
    expect(within(getRowByCell(section, "陳小明")).getAllByText("1")).toHaveLength(2);
    expect(within(getRowByCell(section, "陳小明")).getByText("2")).toBeInTheDocument();
    expect(within(getRowByCell(section, "陳小明")).getByText("4")).toBeInTheDocument();

    // 新增「教材」欄（此資料集皆為 0），每列多一個 "0" 儲存格。
    const leeRow = getRowByCell(section, "李小欣");
    expect(within(leeRow).getAllByText("1")).toHaveLength(2);
    expect(within(leeRow).getAllByText("0")).toHaveLength(3);

    const wongRow = getRowByCell(section, "王家朗");
    expect(within(wongRow).getAllByText("1")).toHaveLength(2);
    expect(within(wongRow).getAllByText("0")).toHaveLength(3);
  });

  it("reads a synthetic template and detects worksheet and columns", async () => {
    const { user, container, snapshot } = renderDataPage();
    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");

    await uploadTemplate(user, container, file);

    expect(getSelect("工作表").value).toBe("Sheet1");
    expect(getSelect("姓名欄").value).toBe("C");
    expect(getSelect("出生日期欄").value).toBe("E");
    expect(getSelect("個別 / 直接服務欄").value).toBe("AC");
    const optionTexts = Array.from(getSelect("個別 / 直接服務欄").options).map(
      (option) => option.textContent ?? ""
    );
    expect(optionTexts.some((text) => /AC：11月各情況次數 > 個別 > 直接服務/.test(text))).toBe(
      true
    );
    expect(optionTexts.some((text) => /AG：11月各情況次數 > 2人小組 > 直接服務/.test(text))).toBe(
      true
    );
    expect(optionTexts.some((text) => /AH：11月各情況次數 > 3人小組 > 直接服務/.test(text))).toBe(
      true
    );
    await waitFor(() => expect(snapshot.toasts).toContain("已讀取 xlsx 模板"));
  });

  it("matches students by name and birthday and shows original and next values", async () => {
    const { user, container } = renderDataPage();
    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");

    await uploadTemplate(user, container, file);

    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());
    expect(getValueNearLabel("未匹配").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("多重匹配").getByText("0")).toBeInTheDocument();

    const officialSection = getSectionByHeading("官方 Excel 模板填寫");
    const chenRow = getRowByCell(officialSection, "AC6");
    expect(within(chenRow).getByText("陳小明")).toBeInTheDocument();
    expect(within(chenRow).getByText("6")).toBeInTheDocument();
    expect(within(chenRow).getByText("3")).toBeInTheDocument();
    expect(within(chenRow).getByText("4")).toBeInTheDocument();

    const leeRow = getRowByCell(officialSection, "AC7");
    expect(within(leeRow).getByText("李小欣")).toBeInTheDocument();
    expect(within(leeRow).getByText("-")).toBeInTheDocument();
    expect(within(leeRow).getByText("1")).toBeInTheDocument();

    const wongRow = getRowByCell(officialSection, "AC8");
    expect(within(wongRow).getByText("王家朗")).toBeInTheDocument();
    expect(within(wongRow).getByText("0")).toBeInTheDocument();
    expect(within(wongRow).getByText("1")).toBeInTheDocument();
  });

  it("matches Excel date cells using their displayed birthday text", async () => {
    const { user, container } = renderDataPage();
    const file = workbookToFile(
      createSyntheticTemplateWorkbook({ mode: "dateCells" }),
      "date-cells-template.xlsx"
    );

    await uploadTemplate(user, container, file);

    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("2")).toBeInTheDocument());
    expect(screen.getByText("AC7")).toBeInTheDocument();
    expect(screen.getByText("AC8")).toBeInTheDocument();
  });

  it("shows unmatched students", async () => {
    const { user, container } = renderDataPage();
    const file = workbookToFile(
      createSyntheticTemplateWorkbook({ mode: "chenOnly" }),
      "chen-only-template.xlsx"
    );

    await uploadTemplate(user, container, file);

    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("1")).toBeInTheDocument());
    expect(getValueNearLabel("未匹配").getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/李小欣 · 2011-11-21/)).toBeInTheDocument();
    expect(screen.getByText(/王家朗 · 2012-03-08/)).toBeInTheDocument();
  });

  it("shows duplicated student matches without previewing the duplicated student", async () => {
    const { user, container } = renderDataPage();
    const file = workbookToFile(
      createSyntheticTemplateWorkbook({ mode: "duplicateChen" }),
      "duplicate-template.xlsx"
    );

    await uploadTemplate(user, container, file);

    await waitFor(() => expect(getValueNearLabel("多重匹配").getByText("1")).toBeInTheDocument());
    expect(screen.getByText(/陳小明 · 2012-03-08 · Excel 行 6, 9/)).toBeInTheDocument();
    const officialSection = getSectionByHeading("官方 Excel 模板填寫");
    expect(within(officialSection).queryByText("AC6")).not.toBeInTheDocument();
  });

  it("opens export confirmation before downloading and can cancel", async () => {
    const { user, container } = renderDataPage();
    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");
    const createObjectURL = vi.fn(() => "blob:mock");

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });

    await uploadTemplate(user, container, file);
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));

    expect(screen.getByText("匯出前確認")).toBeInTheDocument();
    expect(screen.getByText("3 筆資料")).toBeInTheDocument();
    expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument();
    expect(getValueNearLabel("未匹配").getByText("0")).toBeInTheDocument();
    expect(getValueNearLabel("多重匹配").getByText("0")).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByText("匯出前確認")).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("uses backend export first and downloads the backend blob", async () => {
    const { user, container, snapshot } = renderDataPage();
    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");
    const backendBlob = new Blob(["backend-filled"], { type: xlsxMime });
    let exportedBlob: Blob | null = null;
    let downloadName = "";
    vi.mocked(fillExcelTemplate).mockResolvedValue(backendBlob);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:mock";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(
      this: HTMLAnchorElement
    ) {
      downloadName = this.download;
    });

    await uploadTemplate(user, container, file);
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());
    expect(screen.getByText("AC6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));
    await user.click(screen.getByRole("button", { name: "確認匯出" }));

    await waitFor(() => expect(exportedBlob).toBe(backendBlob));
    expect(downloadName).toBe("synthetic-template_2026-11_已填寫.xlsx");
    expect(fillExcelTemplate).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        worksheetName: "Sheet1",
        month: "2026-11",
        writes: expect.arrayContaining([
          expect.objectContaining({
            cellAddress: "AC6",
            value: 4,
            studentId: 1,
            studentName: "陳小明",
            birthday: "2012-03-08",
            reason: "direct_service_count",
          }),
        ]),
        options: {
          preserveTemplate: true,
        },
      })
    );
    expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument();
    expect(screen.getByText("AC6")).toBeInTheDocument();
    await waitFor(() => expect(snapshot.toasts).toContain("已匯出並填入 3 筆資料"));
  });

  it("exports a filled workbook and only writes matched target cells", async () => {
    const { user, container, snapshot } = renderDataPage();
    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");
    let exportedBlob: Blob | null = null;
    let downloadName = "";

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:mock";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(
      this: HTMLAnchorElement
    ) {
      downloadName = this.download;
    });

    await uploadTemplate(user, container, file);
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));
    expect(exportedBlob).toBeNull();
    expect(screen.getByText("匯出前確認")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認匯出" }));

    await waitFor(() => expect(exportedBlob).not.toBeNull());
    expect(downloadName).toBe("synthetic-template_2026-11_已填寫.xlsx");
    expect(fillExcelTemplate).toHaveBeenCalled();
    await waitFor(() => expect(snapshot.toasts).toContain("後端匯出失敗，已使用本地匯出"));
    await waitFor(() => expect(snapshot.toasts).toContain("已匯出並填入 3 筆資料"));

    const blob = exportedBlob;
    if (!blob) throw new Error("Expected exported blob");
    const exportedWorkbook = await readExportedWorkbook(blob);
    const worksheet = exportedWorkbook.Sheets.Sheet1;
    expect(worksheet.AC6.v).toBe(4);
    expect(worksheet.AC7.v).toBe(1);
    expect(worksheet.AC8.v).toBe(1);
    expect(worksheet.AG6.v).toBe(99);
    expect(worksheet.AH6.v).toBe(88);
    expect(worksheet.AJ6.v).toBe("不要改");
    expect(worksheet.AG7.v).toBe(77);
    expect(worksheet.AH7.v).toBe(66);
    expect(worksheet.AJ7.v).toBe("不要改");
    expect(worksheet.AG8.v).toBe(55);
    expect(worksheet.AH8.v).toBe(44);
    expect(worksheet.AJ8.v).toBe("不要改");
    expect(worksheet.C6.v).toBe("陳小明");
    expect(worksheet.C7.v).toBe("李小欣");
    expect(worksheet.C8.v).toBe("王家朗");
  });

  it("keeps export disabled before a template is matched", async () => {
    const { user, container } = renderDataPage();

    expect(screen.getByRole("button", { name: "匯出並填入官方模板" })).toBeDisabled();

    const file = workbookToFile(
      createSyntheticTemplateWorkbook({ mode: "none" }),
      "unmatched-template.xlsx"
    );
    await uploadTemplate(user, container, file);

    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("0")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "匯出並填入官方模板" })).toBeDisabled();
  });

  it("reads an official-style multi-month synthetic workbook and produces direct-service candidates", async () => {
    const { user, container } = renderDataPage();

    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    expect(screen.getByText("目前模板：official-template.xlsx")).toBeInTheDocument();
    expect(getSelect("工作表").value).toBeTruthy();
    expect(getSelect("姓名欄").value).toBeTruthy();
    expect(getSelect("出生日期欄").value).toBeTruthy();

    const directServiceSelect = getSelect("個別 / 直接服務欄");
    const optionTexts = Array.from(directServiceSelect.options).map((option) => option.textContent ?? "");
    expect(optionTexts.some((text) => text.includes("直接服務"))).toBe(true);
    expect(optionTexts.some((text) => text.includes("11月"))).toBe(true);
  });

  // ------------------------------------------------------------
  // Phase 2：教材欄位偵測 / 預覽 / 匯出 / 原因 formatter
  // ------------------------------------------------------------

  describe("materials reason formatter", () => {
    it("orders pairs by date then start, keeps same-day duplicates, no spaces", () => {
      const sessions = [
        matSession(1, 1, "2026-11-18", "10:00", 2),
        matSession(2, 1, "2026-11-03", "09:00", 4),
        matSession(3, 1, "2026-11-03", "14:00", 4), // same day duplicate kept
      ];
      expect(buildMaterialsReasonString(sessions, "2026-11-01", "2026-11-30")).toBe("3-4;3-4;18-2");
    });

    it("excludes out-of-month / present / not-provided / invalid-code sessions", () => {
      const sessions = [
        matSession(1, 1, "2026-10-31", "09:00", 4), // out of month
        matSession(2, 1, "2026-11-05", "09:00", null), // missing code
        matSession(3, 1, "2026-11-06", "09:00", 4, false), // not provided
        { ...matSession(4, 1, "2026-11-07", "09:00", 4), status: "present" as const },
        matSession(5, 1, "2026-11-08", "09:00", 3), // valid
      ];
      expect(buildMaterialsReasonString(sessions, "2026-11-01", "2026-11-30")).toBe("8-3");
    });

    it("returns empty string when there is no valid materials record", () => {
      expect(buildMaterialsReasonString([], "2026-11-01", "2026-11-30")).toBe("");
    });

    it("validates reason strings the same way the backend does", () => {
      expect(isValidMaterialsReasonString("3-4")).toBe(true);
      expect(isValidMaterialsReasonString("3-4;18-2")).toBe(true);
      expect(isValidMaterialsReasonString("")).toBe(false);
      expect(isValidMaterialsReasonString("3-7")).toBe(false);
      expect(isValidMaterialsReasonString("0-4")).toBe(false);
      expect(isValidMaterialsReasonString("32-4")).toBe(false);
      expect(isValidMaterialsReasonString("3-4;")).toBe(false);
      expect(isValidMaterialsReasonString("生病")).toBe(false);
      expect(isValidMaterialsReasonString(";".padEnd(MATERIALS_REASON_MAX_LEN + 10, "3-4;3-4"))).toBe(
        false
      );
    });
  });

  it("auto-detects all three target columns by high confidence", async () => {
    const { user, container } = renderDataPage();
    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    expect(getSelect("個別 / 直接服務欄").value).toBe("AC");
    expect(getMaterialsSelect().value).toBe("AF");
    expect(getReasonSelect().value).toBe("AI");
  });

  it("does not auto-select medium/low materials candidates (high only)", async () => {
    const { user, container } = renderDataPage();
    // Target month (11月) absent → only 9月/10月 materials columns exist.
    await uploadTemplate(user, container, officialLikeWorkbookToFile({ includeTargetMonth: false }));

    expect(getMaterialsSelect().value).toBe("");
    expect(getReasonSelect().value).toBe("");
    // The columns are still offered for manual selection.
    const matOptions = Array.from(getMaterialsSelect().options).map((o) => o.textContent ?? "");
    expect(matOptions.some((t) => t.includes("配合圖文資料提供諮詢"))).toBe(true);
  });

  it("normalizes full-width ／ to half-width / when detecting columns", async () => {
    const { user, container } = renderDataPage();
    await uploadTemplate(user, container, officialLikeWorkbookToFile({ slash: "／" }));

    expect(getMaterialsSelect().value).toBe("AF");
    expect(getReasonSelect().value).toBe("AI");
  });

  it("does not match 11月 columns when the target month is 1月", async () => {
    const ws: XLSX.WorkSheet = {};
    setCell(ws, "C3", "姓名");
    setCell(ws, "E3", "出生日期");
    setCell(ws, "H1", "11月各情況次數");
    setCell(ws, "H2", "個別");
    setCell(ws, "H3", "直接服務");
    setCell(ws, "J1", "1月各情況次數");
    setCell(ws, "J2", "個別");
    setCell(ws, "J3", "直接服務");
    setCell(ws, "C6", "陳小明");
    setCell(ws, "E6", "08/03/2012");
    ws["!ref"] = "A1:J6";
    const wb = { SheetNames: ["Sheet1"], Sheets: { Sheet1: ws } } satisfies XLSX.WorkBook;

    const { user, container } = renderDataPage({ initialSelectedDate: "2026-01-15" });
    await uploadTemplate(user, container, workbookToFile(wb, "jan-template.xlsx"));

    expect(getSelect("個別 / 直接服務欄").value).toBe("J");
  });

  it("allows manually switching the materials columns", async () => {
    const { user, container } = renderDataPage();
    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    await user.selectOptions(getMaterialsSelect(), "Y"); // 10月 個別 配合圖文
    expect(getMaterialsSelect().value).toBe("Y");
  });

  it("previews three columns and skips writes when a student has no materials", async () => {
    const sessions = [
      matSession(1, 1, "2026-11-03", "09:00", 4),
      matSession(2, 1, "2026-11-18", "10:00", 2),
    ]; // 陳小明 (id 1) has materials; others have none
    const { user, container } = renderDataPage({ initialSessions: sessions });
    await uploadTemplate(user, container, officialLikeWorkbookToFile());
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());

    const officialSection = getSectionByHeading("官方 Excel 模板填寫");
    const chenRow = await waitFor(() => getRowByCell(officialSection, "AF6"));
    expect(within(chenRow).getByText("2")).toBeInTheDocument(); // materials count
    expect(within(chenRow).getByText("3-4;18-2")).toBeInTheDocument(); // reason

    const leeRow = getRowByCell(officialSection, "AF7");
    expect(within(leeRow).getAllByText("不寫入（保留原值）").length).toBe(2);
  });

  it("writes materials count and reason consistently via backend then fallback", async () => {
    const sessions = [
      matSession(1, 1, "2026-11-03", "09:00", 4),
      matSession(2, 1, "2026-11-18", "10:00", 2),
    ];
    const { user, container, snapshot } = renderDataPage({ initialSessions: sessions });
    let exportedBlob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:mock";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await uploadTemplate(user, container, officialLikeWorkbookToFile());
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));
    await user.click(screen.getByRole("button", { name: "確認匯出" }));

    // Backend received the materials + reason writes.
    await waitFor(() => expect(fillExcelTemplate).toHaveBeenCalled());
    const payload = vi.mocked(fillExcelTemplate).mock.calls[0][1];
    expect(payload.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cellAddress: "AC6", value: 0, reason: "direct_service_count" }),
        expect.objectContaining({ cellAddress: "AF6", value: 2, reason: "materials_count" }),
        expect.objectContaining({ cellAddress: "AI6", value: "3-4;18-2", reason: "materials_reason" }),
      ])
    );
    // No materials writes for students without materials.
    expect(payload.writes.some((w) => w.cellAddress === "AF7")).toBe(false);
    expect(payload.writes.some((w) => w.cellAddress === "AI7")).toBe(false);

    // Backend mock rejects (beforeEach) → fallback produced the same three cells.
    await waitFor(() => expect(snapshot.toasts).toContain("後端匯出失敗，已使用本地匯出"));
    await waitFor(() => expect(exportedBlob).not.toBeNull());
    const blob = exportedBlob;
    if (!blob) throw new Error("Expected exported blob");
    const exported = await readExportedWorkbook(blob);
    const ws = exported.Sheets.Sheet1;
    expect(ws.AC6.v).toBe(0);
    expect(ws.AF6.v).toBe(2);
    expect(ws.AI6.v).toBe("3-4;18-2");
    expect(ws.AF7).toBeUndefined();
    expect(ws.AI7).toBeUndefined();
  });

  it("blocks export when materials exist but a target column is missing", async () => {
    const sessions = [matSession(1, 1, "2026-11-03", "09:00", 4)];
    const { user, container, snapshot } = renderDataPage({ initialSessions: sessions });
    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    await user.selectOptions(getReasonSelect(), ""); // remove reason column
    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));

    expect(screen.queryByText("匯出前確認")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(snapshot.toasts).toContain(
        "本月存在教材服務，但尚未設定完整的教材次數欄與原因欄。請選擇對應欄位後再匯出。"
      )
    );
  });

  it("blocks export when two target columns collide", async () => {
    const sessions = [matSession(1, 1, "2026-11-03", "09:00", 4)];
    const { user, container, snapshot } = renderDataPage({ initialSessions: sessions });
    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    await user.selectOptions(getMaterialsSelect(), "AC"); // same as direct service
    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));

    expect(screen.queryByText("匯出前確認")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(snapshot.toasts).toContain(
        "直接服務欄、教材次數欄與原因欄不能使用同一個 Excel 欄位。"
      )
    );
  });

  it("blocks export when a flagged materials session has an invalid reason code", async () => {
    const sessions = [matSession(1, 1, "2026-11-03", "09:00", null)]; // provided but no code
    const { user, container, snapshot } = renderDataPage({ initialSessions: sessions });
    await uploadTemplate(user, container, officialLikeWorkbookToFile());

    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));

    expect(screen.queryByText("匯出前確認")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(snapshot.toasts).toContain("部分教材服務缺少有效申報原因，請先檢查教材紀錄。")
    );
  });

  it("allows direct-only export with a notice when no materials and columns missing", async () => {
    // Basic synthetic template has no materials columns; default sessions have
    // no materials → degrade to direct-only.
    const { user, container, snapshot } = renderDataPage();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:mock") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const file = workbookToFile(createSyntheticTemplateWorkbook(), "synthetic-template.xlsx");
    await uploadTemplate(user, container, file);
    await waitFor(() => expect(getValueNearLabel("成功匹配").getByText("3")).toBeInTheDocument());

    expect(
      screen.getByText("未偵測到教材相關欄位。本月沒有教材服務，將只填寫直接服務欄位。")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "匯出並填入官方模板" }));
    expect(screen.getByText("匯出前確認")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "確認匯出" }));
    await waitFor(() => expect(snapshot.toasts).toContain("已匯出並填入 3 筆資料"));
  });

  // ------------------------------------------------------------
  // Phase 4-6B：每學生統計明細展開
  // ------------------------------------------------------------

  it("collapses every per-student session detail by default", () => {
    renderDataPage();

    // 「本月課次紀錄」標題只會在展開時出現。
    expect(screen.queryByText(/本月課次紀錄/)).not.toBeInTheDocument();
    // 既有 row 仍存在。
    const section = getSectionByHeading("每學生出席次數");
    expect(within(section).getByText("陳小明")).toBeInTheDocument();
    // 預設 row 標 aria-expanded=false
    const chenRow = getRowByCell(section, "陳小明");
    expect(chenRow.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands a student row to show this month's session detail (sorted by date+start)", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");
    const chenRow = getRowByCell(section, "陳小明");

    await user.click(chenRow);

    // 標題與筆數出現（含待處理 / 已取消的提示語）。
    const headings = screen.getAllByText(/本月課次紀錄（共 5 筆，含待處理 \/ 已取消）/);
    expect(headings.length).toBeGreaterThan(0);

    // 明細表頭存在。
    expect(screen.getAllByText("日期").length).toBeGreaterThan(0);
    expect(screen.getAllByText("開始時間").length).toBeGreaterThan(0);
    expect(screen.getAllByText("時長").length).toBeGreaterThan(0);
    expect(screen.getAllByText("kind").length).toBeGreaterThan(0);
    expect(screen.getAllByText("status").length).toBeGreaterThan(0);

    // 5 個明細日期都在表中。
    for (const dateISO of [
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]) {
      expect(screen.getAllByText(dateISO).length).toBeGreaterThan(0);
    }
    // 10 月的紀錄不顯示。
    expect(screen.queryByText("2026-10-25")).not.toBeInTheDocument();

    // 排序由 dateISO + start 升序：第一筆日期應為 2026-11-01。
    const dateCells = screen.getAllByText(/^2026-11-\d{2}$/);
    expect(dateCells[0].textContent).toBe("2026-11-01");
  });

  it("re-collapses the detail when the same row is clicked again", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");
    const chenRow = getRowByCell(section, "陳小明");

    await user.click(chenRow);
    expect(screen.queryByText(/本月課次紀錄/)).toBeInTheDocument();

    await user.click(chenRow);
    expect(screen.queryByText(/本月課次紀錄/)).not.toBeInTheDocument();
    expect(chenRow.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows Chinese status labels and English kind labels in the detail badges", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));

    // 陳小明 5 筆 = present(3) absent(1) + kinds regular(3) makeup(1) extra(1)
    expect(screen.getAllByText("已出席").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("缺席").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("regular").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("makeup").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("extra").length).toBeGreaterThanOrEqual(1);

    // 李小欣 有 1 個 pending — 展開後檢查。
    await user.click(getRowByCell(section, "李小欣"));
    expect(screen.getAllByText("待處理").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an empty-state message when an expanded student has no monthly sessions", async () => {
    const studentsOnly: StudentProfile[] = [
      {
        id: 999,
        name: "孤兒學生",
        birthday: "2010-01-01",
        school: "無課學校",
        status: "active",
      },
    ];
    const { user } = renderDataPage({ initialStudents: studentsOnly, initialSessions: [] });
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "孤兒學生"));

    expect(
      screen.getByText(/本月課次紀錄（共 0 筆，含待處理 \/ 已取消）/)
    ).toBeInTheDocument();
    expect(screen.getByText("本月無課次紀錄。")).toBeInTheDocument();
  });

  it("collapses all expanded rows when the selected month changes", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));
    expect(screen.queryByText(/本月課次紀錄/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /上一個月/ }));

    // 切月後展開狀態被清空 — 即使新月份仍有對應 row，也不應有 detail。
    expect(screen.queryByText(/本月課次紀錄/)).not.toBeInTheDocument();
  });

  it("expands multiple student rows independently", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));
    await user.click(getRowByCell(section, "李小欣"));

    // 兩個學生明細應同時可見。
    expect(
      screen.getByText(/本月課次紀錄（共 5 筆，含待處理 \/ 已取消）/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/本月課次紀錄（共 2 筆，含待處理 \/ 已取消）/)
    ).toBeInTheDocument();
  });

  it("does not render any interactive edit/delete control in the detail panel (read-only)", async () => {
    const { user } = renderDataPage();
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));

    // 明細區唯讀：沒有編輯 / 刪除 / 點名 / 跳轉按鈕。
    expect(screen.queryByRole("button", { name: "編輯" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "刪除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /點名/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the preset absent reason inside the same badge and never shows the note", async () => {
    const studentsOnly: StudentProfile[] = [
      { id: 1, name: "陳小明", birthday: "2012-03-08", school: "培正中學", status: "active" },
    ];
    const sessionsWithReason: Session[] = [
      {
        id: 50,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-11-12",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        reason: { id: 6, name: "天氣", code: "WEA" },
        note: "私密備註",
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { user } = renderDataPage({
      initialStudents: studentsOnly,
      initialSessions: sessionsWithReason,
    });
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));

    // status 與預設原因包在同一個 badge 內：缺席 · 天氣
    expect(screen.getByText("缺席 · 天氣")).toBeInTheDocument();
    // note 內容永不顯示。
    expect(screen.queryByText(/私密備註/)).not.toBeInTheDocument();
  });

  it("shows only 缺席 when the absent reason is not a preset (no custom reason text)", async () => {
    const studentsOnly: StudentProfile[] = [
      { id: 1, name: "陳小明", birthday: "2012-03-08", school: "培正中學", status: "active" },
    ];
    const sessionsWithCustomReason: Session[] = [
      {
        id: 51,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-11-13",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        reason: { id: 0, name: "自訂原因文字", code: "BACKEND_REASON" },
        note: "私密備註",
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { user } = renderDataPage({
      initialStudents: studentsOnly,
      initialSessions: sessionsWithCustomReason,
    });
    const section = getSectionByHeading("每學生出席次數");

    await user.click(getRowByCell(section, "陳小明"));

    // 只顯示「缺席」，非預設原因文字不顯示。
    expect(screen.getByText("缺席")).toBeInTheDocument();
    expect(screen.queryByText(/自訂原因文字/)).not.toBeInTheDocument();
    expect(screen.queryByText(/私密備註/)).not.toBeInTheDocument();
  });

  it("shows 正常出席 X · 教材 Y subtitle on the teacher-service card", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(
      makeMonthlyStatistics({
        summary: {
          teacherServiceTotal: 7,
          monthlySessionCount: 99,
          presentCount: 77,
          absentCount: 8,
          pendingCount: 6,
          cancelledCount: 5,
          scheduleRuleCount: 3,
          globalEventCount: 2,
          materialsCount: 2,
        },
      })
    );

    renderDataPage();

    await waitFor(() =>
      expect(getValueNearLabel("老師服務總次數").getByText("7")).toBeInTheDocument()
    );
    const card = screen.getByRole("button", { name: /老師服務總次數/ });
    expect(card.textContent).toContain("正常出席 5");
    expect(card.textContent).toContain("教材 2");
  });

  it("renders the 教材 column without adding it to the 合計", async () => {
    vi.mocked(fetchMonthlyStatistics).mockResolvedValue(
      makeMonthlyStatistics({
        students: [
          {
            studentId: 101,
            studentName: "教材統計學生",
            birthday: "2014-04-05",
            school: "後端學校",
            status: "active",
            regularPresentCount: 5,
            makeupPresentCount: 1,
            extraPresentCount: 0,
            totalPresentCount: 6,
            materialsCount: 2,
          },
        ],
      })
    );

    renderDataPage();

    const section = getSectionByHeading("每學生出席次數");
    await waitFor(() =>
      expect(within(section).getByText("教材統計學生")).toBeInTheDocument()
    );
    const row = getRowByCell(section, "教材統計學生");
    const cells = row.querySelectorAll("td");
    // name, birthday, school, status, regular, makeup, extra, 教材, 合計
    expect(cells[7].textContent).toBe("2"); // 教材
    expect(cells[8].textContent).toBe("6"); // 合計 = regular+makeup+extra（不含教材）
  });

  it("shows the materials badge in the detail panel, and — when none", async () => {
    const studentsOnly: StudentProfile[] = [
      { id: 1, name: "陳小明", birthday: "2012-03-08", school: "培正中學", status: "active" },
    ];
    const sessions: Session[] = [
      {
        id: 60,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-11-12",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        materialsProvided: true,
        materialsReasonCode: 4,
      },
      {
        id: 61,
        studentId: 1,
        student: { id: 1, name: "陳小明" },
        dateISO: "2026-11-20",
        start: "10:00",
        durationMin: 60,
        status: "absent",
        kind: "regular",
        materialsProvided: false,
        materialsReasonCode: null,
      },
    ];
    const { user } = renderDataPage({
      initialStudents: studentsOnly,
      initialSessions: sessions,
    });
    const section = getSectionByHeading("每學生出席次數");
    await user.click(getRowByCell(section, "陳小明"));

    expect(screen.getByText("教材 · 4 生病")).toBeInTheDocument();
    // 無教材的 session 在教材欄顯示 —。
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the reason-6 over-limit page warning and per-student pill", () => {
    const studentsOnly: StudentProfile[] = [
      { id: 1, name: "陳小明", birthday: "2012-03-08", school: "培正中學", status: "active" },
    ];
    const reason6 = (id: number, dateISO: string): Session => ({
      id,
      studentId: 1,
      student: { id: 1, name: "陳小明" },
      dateISO,
      start: "10:00",
      durationMin: 60,
      status: "absent",
      kind: "regular",
      materialsProvided: true,
      materialsReasonCode: 6,
    });
    renderDataPage({
      initialStudents: studentsOnly,
      // 目標月份 2026-11 → 學年 2026-09..2027-08；四筆皆落在此範圍內。
      initialSessions: [
        reason6(70, "2026-10-01"),
        reason6(71, "2026-11-01"),
        reason6(72, "2026-12-01"),
        reason6(73, "2027-01-01"),
      ],
    });

    const schoolYearSection = getSectionByHeading("原因 6 統計學年");
    expect(schoolYearSection.textContent).toContain("原因 6 次數提醒：1 名學生超過學年上限");

    const tableSection = getSectionByHeading("每學生出席次數");
    const row = getRowByCell(tableSection, "陳小明");
    expect(row.textContent).toContain("原因 6 · 4 次 · 超額 1 次");
  });

  it("applies an in-range school-year override and hides the not-applied note", () => {
    installLocalStorage({
      [SCHOOL_YEAR_KEY]: JSON.stringify({ startISO: "2026-01-01", endISO: "2026-12-31" }),
    });
    renderDataPage();

    const section = getSectionByHeading("原因 6 統計學年");
    expect(section.textContent).toContain("2026-01-01 至 2026-12-31");
    expect(section.textContent).not.toContain("目前月份不在自訂學年範圍內");
  });

  it("falls back to the default school year and shows the note when the month is outside the override", () => {
    installLocalStorage({
      [SCHOOL_YEAR_KEY]: JSON.stringify({ startISO: "2025-01-01", endISO: "2025-12-31" }),
    });
    renderDataPage();

    const section = getSectionByHeading("原因 6 統計學年");
    // 目標月份 2026-11 → 預設學年 2026-09..2027-08。
    expect(section.textContent).toContain("2026-09-01 至 2027-08-31");
    expect(section.textContent).toContain("目前月份不在自訂學年範圍內，已使用預設學年。");
  });

  it("restores the default school year when 恢復預設 is clicked", async () => {
    const store = installLocalStorage({
      [SCHOOL_YEAR_KEY]: JSON.stringify({ startISO: "2025-01-01", endISO: "2025-12-31" }),
    });
    const { user } = renderDataPage();

    const section = getSectionByHeading("原因 6 統計學年");
    expect(section.textContent).toContain("目前月份不在自訂學年範圍內");

    await user.click(within(section).getByRole("button", { name: "調整" }));
    await user.click(screen.getByRole("button", { name: "恢復預設" }));

    await waitFor(() => {
      const after = getSectionByHeading("原因 6 統計學年");
      expect(after.textContent).toContain("（預設 9/1–8/31）");
      expect(after.textContent).not.toContain("目前月份不在自訂學年範圍內");
    });
    expect(store.has(SCHOOL_YEAR_KEY)).toBe(false);
  });
});
