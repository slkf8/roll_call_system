/// <reference types="node" />

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
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

function loadFixtureWorkbook() {
  const fixturePath = "src/pages/__tests__/fixtures/official-template.xlsx";
  const buffer = readFileSync(fixturePath);
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

function fixtureWorkbookToFile() {
  return workbookToFile(loadFixtureWorkbook(), "official-template.xlsx");
}

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
  const container = labelNode.parentElement;
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

function getSelect(label: string) {
  return screen.getByLabelText(label) as HTMLSelectElement;
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

    const leeRow = getRowByCell(section, "李小欣");
    expect(within(leeRow).getAllByText("1")).toHaveLength(2);
    expect(within(leeRow).getAllByText("0")).toHaveLength(2);

    const wongRow = getRowByCell(section, "王家朗");
    expect(within(wongRow).getAllByText("1")).toHaveLength(2);
    expect(within(wongRow).getAllByText("0")).toHaveLength(2);
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

  it("reads the real official template fixture and produces direct-service candidates", async () => {
    const { user, container } = renderDataPage();

    await uploadTemplate(user, container, fixtureWorkbookToFile());

    expect(screen.getByText("目前模板：official-template.xlsx")).toBeInTheDocument();
    expect(getSelect("工作表").value).toBeTruthy();
    expect(getSelect("姓名欄").value).toBeTruthy();
    expect(getSelect("出生日期欄").value).toBeTruthy();

    const directServiceSelect = getSelect("個別 / 直接服務欄");
    const optionTexts = Array.from(directServiceSelect.options).map((option) => option.textContent ?? "");
    expect(optionTexts.some((text) => text.includes("直接服務"))).toBe(true);
    expect(optionTexts.some((text) => text.includes("11月"))).toBe(true);
  });
});
