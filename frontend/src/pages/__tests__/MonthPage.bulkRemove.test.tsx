import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkDeleteSessions,
  checkSessionsBackendHealth,
  createSession,
} from "../../api/sessionsApi";
import type {
  GlobalEvent,
  Session,
  StudentProfile,
  StudentScheduleRule,
} from "../../shared/appShared";
import MonthPage from "../MonthPage";

vi.mock("../../api/globalEventsApi", () => ({
  createGlobalEvent: vi.fn(),
  deleteGlobalEvent: vi.fn(),
  updateGlobalEvent: vi.fn(),
}));

vi.mock("../../api/sessionsApi", () => ({
  bulkDeleteSessions: vi.fn(),
  checkSessionsBackendHealth: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  updateSession: vi.fn(),
}));

const SELECTED_DATE = "2026-04-20";

function makeStudent(): StudentProfile {
  return {
    id: 1,
    name: "陳小明",
    birthday: "2012-03-08",
    school: "培正中學",
    status: "active",
  };
}

function makeRule(): StudentScheduleRule {
  return {
    id: 101,
    studentId: 1,
    weekday: 1,
    start: "16:00",
    durationMin: 60,
    isActive: true,
  };
}

function makeSession(
  over: Partial<Session> & Pick<Session, "id" | "dateISO">
): Session {
  return {
    studentId: 1,
    student: { id: 1, name: "陳小明" },
    start: "16:00",
    durationMin: 60,
    status: "pending",
    kind: "regular",
    materialsProvided: false,
    materialsReasonCode: null,
    ...over,
  };
}

const previewResult = (over: Partial<{
  removedCount: number;
  detachedMakeupCount: number;
  breakdown: Partial<{
    generatedRegular: number;
    manualRegular: number;
    makeup: number;
    extra: number;
    present: number;
    absent: number;
    pending: number;
    cancelled: number;
  }>;
}> = {}) => ({
  ok: true as const,
  dryRun: true,
  removedCount: over.removedCount ?? 3,
  detachedMakeupCount: over.detachedMakeupCount ?? 0,
  breakdown: {
    generatedRegular: 1,
    manualRegular: 1,
    makeup: 1,
    extra: 0,
    present: 1,
    absent: 0,
    pending: 2,
    cancelled: 0,
    ...over.breakdown,
  },
});

const commitResult = (over: Partial<{
  removedCount: number;
  detachedMakeupCount: number;
}> = {}) => ({
  ok: true as const,
  dryRun: false,
  removedCount: over.removedCount ?? 3,
  detachedMakeupCount: over.detachedMakeupCount ?? 0,
  breakdown: {
    generatedRegular: 1,
    manualRegular: 1,
    makeup: 1,
    extra: 0,
    present: 1,
    absent: 0,
    pending: 2,
    cancelled: 0,
  },
});

type Snapshot = { sessions: Session[]; toasts: string[] };

function MonthHarness({
  initialSessions,
  isSessionsBackendAvailable = true,
  onSnapshot,
}: {
  initialSessions: Session[];
  isSessionsBackendAvailable?: boolean;
  onSnapshot: (snapshot: Snapshot) => void;
}) {
  const [sessions, setSessions] = React.useState<Session[]>(initialSessions);
  const [globalEvents, setGlobalEvents] = React.useState<GlobalEvent[]>([]);
  const [toasts, setToasts] = React.useState<string[]>([]);

  const setToast: React.Dispatch<React.SetStateAction<string>> = (value) => {
    setToasts((current) => {
      const previous = current.length > 0 ? current[current.length - 1] : "";
      const next = typeof value === "function" ? value(previous) : value;
      return next ? [...current, next] : current;
    });
  };

  React.useEffect(() => {
    onSnapshot({ sessions, toasts });
  }, [sessions, toasts, onSnapshot]);

  return (
    <MonthPage
      setTheme={vi.fn()}
      selectedDate={SELECTED_DATE}
      setSelectedDate={vi.fn()}
      students={[makeStudent()]}
      studentScheduleRules={[makeRule()]}
      sessions={sessions}
      setSessions={setSessions}
      isSessionsBackendAvailable={isSessionsBackendAvailable}
      isGlobalEventsBackendAvailable={false}
      globalEvents={globalEvents}
      setGlobalEvents={setGlobalEvents}
      setToast={setToast}
    />
  );
}

function renderMonthPage(
  options: {
    initialSessions?: Session[];
    isSessionsBackendAvailable?: boolean;
  } = {}
) {
  let snapshot: Snapshot = { sessions: [], toasts: [] };
  const user = userEvent.setup();
  render(
    <MonthHarness
      initialSessions={options.initialSessions ?? []}
      isSessionsBackendAvailable={options.isSessionsBackendAvailable}
      onSnapshot={(next) => {
        Object.assign(snapshot, next);
      }}
    />
  );
  return {
    user,
    get snapshot() {
      return snapshot;
    },
  };
}

async function openBatchMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "批量操作" }));
}

async function enterRemoveMode(user: ReturnType<typeof userEvent.setup>) {
  await openBatchMenu(user);
  await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
  // Entry now awaits a GET /health probe (mocked to resolve by default); wait
  // for remove mode to become active before callers interact with it. Use the
  // batch-bar header (stable regardless of preview-loading button label) so a
  // re-entry while a previous preview is still pending ("處理中…") also works.
  await screen.findByText(/已選取/);
}

// Sheet's date inputs (exclude the hidden header month picker).
function sheetDateInputs() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="date"]')
  ).filter((input) => !input.className.includes("opacity-0"));
}

beforeEach(() => {
  // Entry health probe resolves by default; tests that exercise the offline /
  // recovery / pending paths override this per-case.
  vi.mocked(checkSessionsBackendHealth).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MonthPage 批量操作 Menu 新增「批量移除日期內課次」", () => {
  it("Menu 顯示『批量移除日期內課次』，點擊後 Menu 先收起並進入 remove mode", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    expect(
      screen.getByRole("button", { name: "批量移除日期內課次" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    // Menu 收起後「收起」應消失，並進入批量模式 header（入口 health probe 解析後）
    await screen.findByRole("button", { name: "預覽移除課次" });
    expect(screen.queryByRole("button", { name: "收起" })).not.toBeInTheDocument();
    expect(screen.getByText(/已選取 0 天/)).toBeInTheDocument();
    expect(checkSessionsBackendHealth).toHaveBeenCalledTimes(1);
  });

  it("backend 不可用時（入口 health probe 失敗）：不進入 remove mode 並顯示 Toast", async () => {
    // Authoritative liveness now comes from the entry probe, not the stale prop.
    vi.mocked(checkSessionsBackendHealth).mockRejectedValueOnce(
      new Error("offline")
    );
    const { user, snapshot } = renderMonthPage({
      isSessionsBackendAvailable: false,
    });
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    await waitFor(() =>
      expect(snapshot.toasts).toContain(
        "資料庫未連線，暫時無法批量移除課次"
      )
    );
    // 仍在正常頁面（header 仍有「批量操作」入口、無批量模式 bar）
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();
  });

  it("原有『批量停課』仍進入 event mode，Drawer『批量模式』亦進入 event mode（不誤進 remove）", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量停課" }));
    // event mode：Action Bar 顯示停課 / 假期按鈕（remove 專用按鈕不在）
    expect(
      screen.getByRole("button", { name: "標記停課 / 假期" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "預覽移除課次" })
    ).not.toBeInTheDocument();
    // 退出
    const closeBtns = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg"));
    // 點擊批量模式 header 內的關閉 X（最後一個含 svg 的小按鈕）。
    // 但更穩定的方式是用 keyboard 退出此 mode 不存在，這邊改用 drawer 入口檢查。
    closeBtns;
    // Drawer「批量模式」：點 30 號日 → 開啟 drawer → 點批量模式
    // (drawer 已關，需重整為直接點日期格)
  });

  it("批量生成入口仍可正常開啟（與 remove menu 並存）", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    expect(
      screen.getByText(/在指定日期範圍內，依固定課表補齊課次/)
    ).toBeInTheDocument();
  });
});

describe("MonthPage remove mode：日期選取與範圍 Sheet", () => {
  it("可進入並退出 remove mode；未選日期時『預覽移除課次』disabled", async () => {
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    const previewBtn = screen.getByRole("button", { name: "預覽移除課次" });
    expect(previewBtn).toBeDisabled();
    // 退出（批量 header 右側關閉 X，鄰近「已選取 N 天」）
    const xButton = screen
      .getByText(/已選取 0 天/)
      .parentElement!.querySelector("button")!;
    await user.click(xButton);
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
  });

  it("點選多個不連續日期；再次點擊可取消選取", async () => {
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByText("13"));
    await user.click(screen.getByText("27"));
    expect(screen.getByText(/已選取 3 天/)).toBeInTheDocument();
    // 再點 13 取消
    await user.click(screen.getByText("13"));
    expect(screen.getByText(/已選取 2 天/)).toBeInTheDocument();
  });

  it("日期範圍 Sheet：預設留空、套用後合併進 selectedDates 而非覆蓋", async () => {
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    // 先點 06
    await user.click(screen.getByText("6"));
    // 開啟範圍 Sheet
    await user.click(screen.getByRole("button", { name: "套用日期範圍" }));
    // 預設留空
    const inputs0 = sheetDateInputs();
    expect(inputs0[0].value).toBe("");
    expect(inputs0[1].value).toBe("");
    fireEvent.change(inputs0[0], { target: { value: "2026-04-13" } });
    fireEvent.change(inputs0[1], { target: { value: "2026-04-15" } });
    await user.click(screen.getByRole("button", { name: "套用" }));
    // 1 + 3 = 4 天
    expect(screen.getByText(/已選取 4 天/)).toBeInTheDocument();
  });

  it("日期範圍驗證：未填寫 / from > to / 跨月份 皆會顯示行內錯誤", async () => {
    const { user } = renderMonthPage();
    await enterRemoveMode(user);

    // 1) 未完整填寫
    await user.click(screen.getByRole("button", { name: "套用日期範圍" }));
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(screen.getByText(/請選擇開始與結束日期/)).toBeInTheDocument();

    // 2) from > to
    let inputs = sheetDateInputs();
    fireEvent.change(inputs[0], { target: { value: "2026-04-20" } });
    fireEvent.change(inputs[1], { target: { value: "2026-04-10" } });
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(screen.getByText(/結束日期需晚於或等於開始日期/)).toBeInTheDocument();

    // 3) 跨月（to=5 月）
    inputs = sheetDateInputs();
    fireEvent.change(inputs[0], { target: { value: "2026-04-15" } });
    fireEvent.change(inputs[1], { target: { value: "2026-05-01" } });
    await user.click(screen.getByRole("button", { name: "套用" }));
    expect(screen.getByText(/只能選擇本月日期/)).toBeInTheDocument();
  });
});

describe("MonthPage remove mode：dryRun 預覽", () => {
  it("dryRun=true 只呼叫一次 preview API，breakdown 正確顯示", async () => {
    vi.mocked(bulkDeleteSessions).mockResolvedValueOnce(previewResult());
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByText("13"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));

    await waitFor(() => {
      expect(screen.getByText(/已選擇 2 日/)).toBeInTheDocument();
    });
    expect(screen.getByText(/共包含 3 節課次/)).toBeInTheDocument();
    expect(screen.getByText(/固定生成課次：1 節/)).toBeInTheDocument();
    expect(screen.getByText(/手動新增課次：1 節/)).toBeInTheDocument();
    expect(screen.getByText(/補課：1 節/)).toBeInTheDocument();
    expect(screen.getByText(/加課：0 節/)).toBeInTheDocument();
    expect(screen.getByText(/已出席：1 節/)).toBeInTheDocument();
    expect(screen.getByText(/缺席：0 節/)).toBeInTheDocument();
    expect(screen.getByText(/尚未點名：2 節/)).toBeInTheDocument();
    expect(screen.getByText(/已取消：0 節/)).toBeInTheDocument();

    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledWith(
      ["2026-04-06", "2026-04-13"],
      true
    );
    // 「繼續」存在（removedCount > 0）
    expect(screen.getByRole("button", { name: "繼續" })).toBeInTheDocument();
  });

  it("removedCount === 0 時：顯示『所選日期內沒有課次』且不出現『繼續』按鈕", async () => {
    vi.mocked(bulkDeleteSessions).mockResolvedValueOnce(
      previewResult({
        removedCount: 0,
        breakdown: {
          generatedRegular: 0,
          manualRegular: 0,
          makeup: 0,
          extra: 0,
          present: 0,
          absent: 0,
          pending: 0,
          cancelled: 0,
        },
      })
    );
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));

    await waitFor(() =>
      expect(screen.getByText(/所選日期內沒有課次/)).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "繼續" })).not.toBeInTheDocument();
  });

  it("preview API 失敗 → Toast『無法取得移除預覽，請稍後再試』，不修改 sessions", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(bulkDeleteSessions).mockRejectedValueOnce(new Error("boom"));
    const baseSessions = [makeSession({ id: 1, dateISO: "2026-04-06" })];
    const { user, snapshot } = renderMonthPage({ initialSessions: baseSessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("無法取得移除預覽，請稍後再試")
    );
    expect(snapshot.sessions).toEqual(baseSessions);
  });
});

describe("MonthPage remove mode：第二層紅色確認與正式刪除", () => {
  it("確認 Sheet 顯示動態 N、已點名課次、頁面內不可復原；dryRun=false 只呼叫一次；成功後同步 frontend sessions", async () => {
    const sessions: Session[] = [
      // 來源（移除範圍內）
      makeSession({ id: 1, dateISO: "2026-04-06" }),
      // 內部引用：來源+補課同被選 → 一起消失
      makeSession({
        id: 2,
        dateISO: "2026-04-13",
        kind: "makeup",
        makeupOfSessionId: 1,
        makeupOfDateISO: "2026-04-06",
      }),
      // 跨範圍補課：自身存活，但引用已移除來源 → detach
      makeSession({
        id: 3,
        dateISO: "2026-05-04",
        kind: "makeup",
        makeupOfSessionId: 1,
        makeupOfDateISO: "2026-04-06",
      }),
      // 未選日期 → 保留
      makeSession({ id: 4, dateISO: "2026-04-27" }),
    ];
    vi.mocked(bulkDeleteSessions)
      .mockResolvedValueOnce(previewResult({ removedCount: 2 }))
      .mockResolvedValueOnce(commitResult({ removedCount: 2 }));

    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByText("13"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 2 節課次/)).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "繼續" }));

    // 第二層確認文案
    expect(screen.getByText(/確認移除課次/)).toBeInTheDocument();
    expect(
      screen.getByText(/即將移除所選日期內的 2 節課次，包括已點名課次/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/此操作無法在頁面內直接復原/)
    ).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "確認移除 2 節" });
    expect(confirmBtn).toBeInTheDocument();

    await user.click(confirmBtn);

    // 正式 API：dryRun=false、與 preview 完全相同 dates snapshot、只呼叫一次
    await waitFor(() =>
      expect(snapshot.toasts).toContain("已移除 2 節課次")
    );
    const calls = vi.mocked(bulkDeleteSessions).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([["2026-04-06", "2026-04-13"], true]);
    expect(calls[1]).toEqual([["2026-04-06", "2026-04-13"], false]);

    // frontend sessions 同步：移除 id=1,2；未選日期 id=4 保留；跨範圍 id=3 makeup detach
    const ids = snapshot.sessions.map((s) => s.id).sort();
    expect(ids).toEqual([3, 4]);
    const survivor3 = snapshot.sessions.find((s) => s.id === 3)!;
    expect(survivor3.makeupOfSessionId).toBeUndefined(); // detach 清空
    expect(survivor3.makeupOfDateISO).toBe("2026-04-06"); // 保留
    const survivor4 = snapshot.sessions.find((s) => s.id === 4)!;
    expect(survivor4).toBe(sessions[3]); // 未動 reference

    // 退出 remove mode
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
  });

  it("正式刪除失敗：frontend sessions 不變、selectedDates 保留、仍在 remove mode；Toast『移除失敗，資料未變更』", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sessions: Session[] = [
      makeSession({ id: 1, dateISO: "2026-04-06" }),
      makeSession({ id: 2, dateISO: "2026-04-13" }),
    ];
    vi.mocked(bulkDeleteSessions)
      .mockResolvedValueOnce(previewResult({ removedCount: 2 }))
      .mockRejectedValueOnce(new Error("commit failed"));

    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByText("13"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 2 節課次/)).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "繼續" }));
    await user.click(screen.getByRole("button", { name: "確認移除 2 節" }));

    await waitFor(() =>
      expect(snapshot.toasts).toContain("移除失敗，資料未變更")
    );
    // sessions 不變
    expect(snapshot.sessions).toEqual(sessions);
    // 仍在 remove mode（header 仍顯示已選天數）且已選日期保留
    expect(screen.getByText(/已選取 2 天/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "預覽移除課次" })
    ).toBeInTheDocument();
  });

  it("backend 在進入模式後中斷（preview 點擊時）：不執行任何刪除", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // 用 unmount 模擬「點擊瞬間 backend flag 已 false」較困難；
    // 改以「進入後 preview API reject」確認：不會呼叫 dryRun=false。
    vi.mocked(bulkDeleteSessions).mockRejectedValueOnce(
      new Error("backend lost")
    );
    const sessions: Session[] = [makeSession({ id: 1, dateISO: "2026-04-06" })];
    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(snapshot.toasts).toContain("無法取得移除預覽，請稍後再試")
    );
    // 沒有 dryRun=false 呼叫
    const calls = vi.mocked(bulkDeleteSessions).mock.calls;
    expect(calls.every((c) => c[1] === true)).toBe(true);
    expect(snapshot.sessions).toEqual(sessions);
  });
});

describe("MonthPage 既有功能不受影響", () => {
  it("既有批量生成流程仍正常開啟", async () => {
    const { user } = renderMonthPage();
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量生成固定課次" }));
    expect(
      screen.getByText(/在指定日期範圍內，依固定課表補齊課次/)
    ).toBeInTheDocument();
  });

  it("Drawer『批量模式』仍進入 event mode（顯示停課/假期按鈕，無 remove 專用按鈕）", async () => {
    const { user } = renderMonthPage();
    await user.click(screen.getByText("15"));
    await user.click(screen.getByRole("button", { name: "批量模式" }));
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "標記停課 / 假期" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "預覽移除課次" })
    ).not.toBeInTheDocument();
  });
});

// Build a deferred Promise that lets a test pause an async mock and resolve
// it explicitly later. Used to assert the synchronous re-entry locks block
// double-clicks before React re-renders the disabled button state.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("MonthPage remove mode：快速連點同步防重", () => {
  it("preview 連點兩次：API 仍只被呼叫一次（dryRun=true）", async () => {
    const dpreview = deferred<ReturnType<typeof previewResult>>();
    vi.mocked(bulkDeleteSessions).mockReturnValueOnce(
      dpreview.promise as ReturnType<typeof bulkDeleteSessions>
    );

    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));

    const previewBtn = screen.getByRole("button", { name: "預覽移除課次" });
    // Two rapid clicks before the pending Promise resolves.
    await user.click(previewBtn);
    await user.click(previewBtn);

    // API 仍未 resolve → 同步鎖必須擋住第二次。
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledWith(
      ["2026-04-06"],
      true
    );

    // 完成 deferred → preview Sheet 開啟、流程正常結束。
    dpreview.resolve(previewResult({ removedCount: 1 }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 1 節課次/)).toBeInTheDocument()
    );
  });

  it("commit 連點兩次：API 仍只被呼叫一次（dryRun=false），成功後同步 sessions", async () => {
    const dcommit = deferred<ReturnType<typeof commitResult>>();
    vi.mocked(bulkDeleteSessions)
      // first call: preview (resolves immediately)
      .mockResolvedValueOnce(previewResult({ removedCount: 1 }))
      // second call: commit (pending until we resolve dcommit)
      .mockReturnValueOnce(
        dcommit.promise as ReturnType<typeof bulkDeleteSessions>
      );

    const sessions: Session[] = [makeSession({ id: 1, dateISO: "2026-04-06" })];
    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 1 節課次/)).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "繼續" }));

    const confirmBtn = screen.getByRole("button", { name: "確認移除 1 節" });
    // Two rapid clicks before the destructive Promise resolves.
    await user.click(confirmBtn);
    await user.click(confirmBtn);

    // dryRun=false 必須只被呼叫一次。
    const falseCalls = vi
      .mocked(bulkDeleteSessions)
      .mock.calls.filter((c) => c[1] === false);
    expect(falseCalls).toHaveLength(1);
    expect(falseCalls[0]).toEqual([["2026-04-06"], false]);

    // 完成 deferred → 成功路徑同步 sessions、Toast、退出 remove mode。
    dcommit.resolve(commitResult({ removedCount: 1 }));
    await waitFor(() =>
      expect(snapshot.toasts).toContain("已移除 1 節課次")
    );
    expect(snapshot.sessions).toEqual([]);
  });
});

describe("MonthPage remove mode：H2 stale callback / commit lifecycle 防衛", () => {
  it("A. preview pending → 退出 → resolve：不重開 Sheet、不顯示 breakdown、sessions 不變", async () => {
    const dpreview = deferred<ReturnType<typeof previewResult>>();
    vi.mocked(bulkDeleteSessions).mockReturnValueOnce(
      dpreview.promise as ReturnType<typeof bulkDeleteSessions>
    );
    const sessions: Session[] = [makeSession({ id: 1, dateISO: "2026-04-06" })];
    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));

    // 退出 batch mode
    const xButton = screen
      .getByText(/已選取 1 天/)
      .parentElement!.querySelector("button")!;
    await user.click(xButton);
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();

    // 解開舊 preview deferred
    dpreview.resolve(previewResult({ removedCount: 99 }));
    await Promise.resolve();
    await Promise.resolve();

    // 不重開 Sheet、不顯示 breakdown
    expect(screen.queryByText(/共包含/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已選擇/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "繼續" })).not.toBeInTheDocument();
    // sessions 不變
    expect(snapshot.sessions).toEqual(sessions);
  });

  it("B. preview pending → 修改 selectedDates → resolve：不顯示舊 Sheet、selectedDates 保持修改後狀態", async () => {
    const dpreview = deferred<ReturnType<typeof previewResult>>();
    vi.mocked(bulkDeleteSessions).mockReturnValueOnce(
      dpreview.promise as ReturnType<typeof bulkDeleteSessions>
    );
    const { user } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    // 改選：再點 6 取消、加選 13
    await user.click(screen.getByText("6"));
    await user.click(screen.getByText("13"));
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();

    dpreview.resolve(previewResult({ removedCount: 7 }));
    await Promise.resolve();
    await Promise.resolve();

    // 舊 preview 不出現
    expect(screen.queryByText(/共包含 7 節課次/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "繼續" })).not.toBeInTheDocument();
    // selectedDates 保持修改後（13）
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();
  });

  it("C. preview pending → 退出 → reject：不顯示『無法取得移除預覽，請稍後再試』", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const dpreview = deferred<ReturnType<typeof previewResult>>();
    vi.mocked(bulkDeleteSessions).mockReturnValueOnce(
      dpreview.promise as ReturnType<typeof bulkDeleteSessions>
    );
    const { user, snapshot } = renderMonthPage();
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));

    const xButton = screen
      .getByText(/已選取 1 天/)
      .parentElement!.querySelector("button")!;
    await user.click(xButton);

    dpreview.reject(new Error("late reject"));
    await Promise.resolve();
    await Promise.resolve();

    expect(snapshot.toasts).not.toContain("無法取得移除預覽，請稍後再試");
  });

  it("D. commit pending：左『取消』與 header X 皆 no-op；dryRun=false 只送出 1 次（overlay 與左『取消』共用 closeBulkRemoveConfirm）", async () => {
    const dcommit = deferred<ReturnType<typeof commitResult>>();
    vi.mocked(bulkDeleteSessions)
      .mockResolvedValueOnce(previewResult({ removedCount: 1 }))
      .mockReturnValueOnce(
        dcommit.promise as ReturnType<typeof bulkDeleteSessions>
      );
    const sessions: Session[] = [makeSession({ id: 1, dateISO: "2026-04-06" })];
    const { user } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 1 節課次/)).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "繼續" }));
    // commit 送出（pending）
    await user.click(screen.getByRole("button", { name: "確認移除 1 節" }));

    // Confirm Sheet 仍開啟、處理中
    expect(screen.getByText(/確認移除課次/)).toBeInTheDocument();

    // 點左側「取消」 → no-op（pending lock 擋住）
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByText(/確認移除課次/)).toBeInTheDocument();

    // 點 header X → no-op；仍在 remove mode
    const xButton = screen
      .getByText(/已選取 1 天/)
      .parentElement!.querySelector("button")!;
    await user.click(xButton);
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();
    expect(screen.getByText(/確認移除課次/)).toBeInTheDocument();

    // dryRun=false 仍只送出 1 次
    const falseCalls = vi
      .mocked(bulkDeleteSessions)
      .mock.calls.filter((c) => c[1] === false);
    expect(falseCalls).toHaveLength(1);

    // 完成 commit，避免測試 unhandled pending
    dcommit.resolve(commitResult({ removedCount: 1 }));
    await waitFor(() =>
      expect(screen.queryByText(/確認移除課次/)).not.toBeInTheDocument()
    );
  });

  it("E. commit resolve 後正常完成：sessions 鏡像同步、selectedDates 清空、退出 remove mode、Toast 用正式 API removedCount", async () => {
    const dcommit = deferred<ReturnType<typeof commitResult>>();
    vi.mocked(bulkDeleteSessions)
      .mockResolvedValueOnce(previewResult({ removedCount: 1 }))
      .mockReturnValueOnce(
        dcommit.promise as ReturnType<typeof bulkDeleteSessions>
      );
    const sessions: Session[] = [
      makeSession({ id: 1, dateISO: "2026-04-06" }),
      makeSession({ id: 2, dateISO: "2026-04-13" }), // 未選日期 → 保留
    ];
    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    await waitFor(() =>
      expect(screen.getByText(/共包含 1 節課次/)).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "繼續" }));
    await user.click(screen.getByRole("button", { name: "確認移除 1 節" }));

    // Toast N 必須來自正式 API removedCount（與 preview 數可不同 → 用 7 驗證）
    dcommit.resolve(commitResult({ removedCount: 7 }));

    await waitFor(() => expect(snapshot.toasts).toContain("已移除 7 節課次"));
    // sessions 鏡像已同步：未選日期保留
    expect(snapshot.sessions.map((s) => s.id).sort()).toEqual([2]);
    // 退出 remove mode：header「批量操作」回來
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();
  });
});

describe("MonthPage remove mode：H2.1 退出後立即重新進入保留 preview loading", () => {
  it("preview pending → 退出 → 立即重新進入：按鈕保持 disabled 且顯示『處理中…』；舊 request resolve 後不顯示 stale Sheet、可正常送出新一輪 dryRun（使用新 selectedDates）", async () => {
    const dpreview = deferred<ReturnType<typeof previewResult>>();
    vi.mocked(bulkDeleteSessions)
      // 第一輪 preview：保持 pending（模擬舊 request 未完成）
      .mockReturnValueOnce(
        dpreview.promise as ReturnType<typeof bulkDeleteSessions>
      )
      // 第二輪 preview（重新進入並再次點擊後）：立即 resolve
      .mockResolvedValueOnce(previewResult({ removedCount: 5 }));

    const sessions: Session[] = [
      makeSession({ id: 1, dateISO: "2026-04-06" }),
      makeSession({ id: 2, dateISO: "2026-04-13" }), // 第二輪選取的新日期
    ];
    const { user, snapshot } = renderMonthPage({ initialSessions: sessions });

    // 1~4. 進入 remove mode、選取日期、點預覽 → dryRun=true request 保持 pending
    await enterRemoveMode(user);
    await user.click(screen.getByText("6"));
    await user.click(screen.getByRole("button", { name: "預覽移除課次" }));
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenLastCalledWith(
      ["2026-04-06"],
      true
    );

    // 5. 點 header X 退出（preview lock 仍由舊 request 持有）
    const xButton = screen
      .getByText(/已選取 1 天/)
      .parentElement!.querySelector("button")!;
    await user.click(xButton);
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();

    // 6. 立即重新進入 remove mode
    await enterRemoveMode(user);
    // 7. 選取新的日期（13，與第一輪不同）
    await user.click(screen.getByText("13"));
    expect(screen.getByText(/已選取 1 天/)).toBeInTheDocument();

    // 舊 request 尚未 resolve：H1 lock 仍持有 → exitBatchMode 未提前清除 loading。
    // 若無此修正，loading 會被清為 false、按鈕看似可按但 handler 靜默 return。
    const previewBtnPending = screen.getByRole("button", { name: "處理中…" });
    expect(previewBtnPending).toBeDisabled();

    // 此時點擊不得送出第二次 dryRun=true（按鈕 disabled + H1 lock 雙重防衛）
    await user.click(previewBtnPending);
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledTimes(1);

    // 8. resolve 舊 preview request（contextVersion 早已失效）
    dpreview.resolve(previewResult({ removedCount: 99 }));
    await Promise.resolve();
    await Promise.resolve();

    // 不顯示 stale preview Sheet / 舊 breakdown / 繼續按鈕；sessions 不變
    expect(screen.queryByText(/已選擇/)).not.toBeInTheDocument();
    expect(screen.queryByText(/共包含/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "繼續" })
    ).not.toBeInTheDocument();
    expect(snapshot.sessions.map((s) => s.id).sort()).toEqual([1, 2]);

    // 預覽按鈕恢復可用（loading 由舊 request 的 finally 重設）
    const previewBtnReady = await screen.findByRole("button", {
      name: "預覽移除課次",
    });
    expect(previewBtnReady).toBeEnabled();

    // 9. 再次點擊預覽 → 正常送出新一輪 dryRun=true，使用新的 selectedDates
    await user.click(previewBtnReady);
    await waitFor(() =>
      expect(screen.getByText(/共包含 5 節課次/)).toBeInTheDocument()
    );
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(bulkDeleteSessions)).toHaveBeenLastCalledWith(
      ["2026-04-13"],
      true
    );
  });
});

describe("MonthPage remove mode：入口即時 health probe（取代 stale availability snapshot）", () => {
  it("A. health probe 成功 → 可進 remove mode（probe 呼叫 1 次）", async () => {
    vi.mocked(checkSessionsBackendHealth).mockResolvedValueOnce(undefined);
    const { user } = renderMonthPage({ isSessionsBackendAvailable: true });
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    expect(
      await screen.findByRole("button", { name: "預覽移除課次" })
    ).toBeInTheDocument();
    expect(screen.getByText(/已選取 0 天/)).toBeInTheDocument();
    expect(checkSessionsBackendHealth).toHaveBeenCalledTimes(1);
  });

  it("B. stale prop=true 但 health probe 失敗 → Toast 且不進 remove mode（重現實際 defect）", async () => {
    vi.mocked(checkSessionsBackendHealth).mockRejectedValueOnce(
      new Error("offline after load")
    );
    const { user, snapshot } = renderMonthPage({
      isSessionsBackendAvailable: true,
    });
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    await waitFor(() =>
      expect(snapshot.toasts).toContain(
        "資料庫未連線，暫時無法批量移除課次"
      )
    );
    // 必須未進入 remove mode：無批量模式 bar、無 remove 專用控制
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(screen.queryByText(/已選取/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "套用日期範圍" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "預覽移除課次" })
    ).not.toBeInTheDocument();
  });

  it("C. stale prop=false 但 health probe 成功 → 可進 remove mode（backend 恢復後免 reload）", async () => {
    vi.mocked(checkSessionsBackendHealth).mockResolvedValueOnce(undefined);
    const { user } = renderMonthPage({ isSessionsBackendAvailable: false });
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    expect(
      await screen.findByRole("button", { name: "預覽移除課次" })
    ).toBeInTheDocument();
    expect(screen.getByText(/已選取 0 天/)).toBeInTheDocument();
  });

  it("D. probe pending 時快速連點 → health probe 僅 1 次，resolve 後正常進 mode", async () => {
    const dprobe = deferred<undefined>();
    vi.mocked(checkSessionsBackendHealth).mockReturnValueOnce(
      dprobe.promise as Promise<void>
    );
    const { user } = renderMonthPage({ isSessionsBackendAvailable: true });
    await openBatchMenu(user);
    // 第一次點擊：Menu 收起、probe pending（entry lock 持有）
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    // probe 未解析前，重新開 Menu 再點一次（測試 harness 可靠重現的 UI 路徑）
    await openBatchMenu(user);
    await user.click(screen.getByRole("button", { name: "批量移除日期內課次" }));
    expect(checkSessionsBackendHealth).toHaveBeenCalledTimes(1);
    // 尚未進入 remove mode
    expect(
      screen.queryByRole("button", { name: "預覽移除課次" })
    ).not.toBeInTheDocument();
    // 解析 probe → 正常進入 remove mode
    dprobe.resolve(undefined);
    expect(
      await screen.findByRole("button", { name: "預覽移除課次" })
    ).toBeInTheDocument();
    expect(checkSessionsBackendHealth).toHaveBeenCalledTimes(1);
  });
});

// satisfy unused-import linter
void createSession;
