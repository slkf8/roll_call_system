import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * iOS 風格前端預覽原型（無後端｜Canvas 可預覽）
 *
 * 修改紀錄：
 * - 移除開發測試用的 runSelfTests 函數
 * - 保持完整 TypeScript 定義
 * - 確保無外部依賴，圖標皆為內嵌 SVG
 */

// --- Type Definitions ---

type Status = "pending" | "present" | "absent" | "cancelled";

type Reason = { id: number; name: string; code: string };

type Student = { id: number; name: string };

type Session = {
  id: number;
  student: Student;
  dateISO: string; // YYYY-MM-DD
  start: string; // HH:MM
  durationMin: number;
  status: Status;
  reason?: Reason;
  note?: string;
  kind: "regular" | "makeup" | "extra";
  makeupOfDateISO?: string;
  makeupOfSessionId?: number;
};

// --- Data Seeds ---

const reasonsSeed: Reason[] = [
  { id: 1, name: "生病", code: "SICK" },
  { id: 2, name: "家事", code: "FAM" },
  { id: 3, name: "交通", code: "TRAF" },
  { id: 4, name: "未通知", code: "NO" },
  { id: 5, name: "考試/活動", code: "EXAM" },
];

const studentsSeed: Student[] = [
  { id: 1, name: "陳小明" },
  { id: 2, name: "林雅婷" },
  { id: 3, name: "王大文" },
  { id: 4, name: "張小美" },
];

// --- Helper Functions ---

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISO(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

function formatZHDate(dateISO: string) {
  const d = parseISO(dateISO);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（週${wd}）`;
}

function addDaysISO(dateISO: string, delta: number) {
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function addMinutes(hhmm: string, mins: number) {
  const t = timeToMinutes(hhmm) + mins;
  const hh = Math.floor((t % (24 * 60)) / 60);
  const mm = (t % (24 * 60)) % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function endTime(s: Session) {
  return addMinutes(s.start, s.durationMin);
}

function formatDurationMin(mins: number) {
  if (mins === 60) return "1小時課程";
  if (mins % 60 === 0) return `${mins / 60}小時課程`;
  if (mins > 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}小時${m}分鐘課程`;
  }
  return `${mins}分鐘課程`;
}

function removeSessionById(list: Session[], id: number) {
  return list.filter((s) => s.id !== id);
}

// --- Icons (Embedded SVGs) ---

function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3v2M16 3v2M4.5 8.5h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6.5 5h11A3.5 3.5 0 0 1 21 8.5v10A3.5 3.5 0 0 1 17.5 22h-11A3.5 3.5 0 0 1 3 18.5v-10A3.5 3.5 0 0 1 6.5 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFile({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18 9 12l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDots({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconToday({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMonth({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7 7h10M7 11h6M7 15h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 21v-1a3.5 3.5 0 0 0-2.4-3.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 4.2a4 4 0 0 1 0 7.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// --- UI Components ---

function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "muted" | "purple";
  className?: string;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : tone === "muted"
      ? "bg-[#EFEFF4] text-slate-500 border-[#E5E5EA]"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700 border-purple-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls} ${className}`}>
      {children}
    </span>
  );
}

function IconButton({
  tone,
  onClick,
  children,
  ariaLabel,
}: {
  tone: "green" | "red" | "blue";
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700 active:bg-emerald-100"
      : tone === "red"
      ? "bg-rose-50 border-rose-200 text-rose-700 active:bg-rose-100"
      : "bg-[#EAF2FF] border-[#D6E7FF] text-[#2563EB] active:bg-[#DDEBFF]";

  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`h-11 w-11 rounded-2xl border transition flex items-center justify-center active:scale-[0.98] ${cls}`}
    >
      {children}
    </button>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2">
      <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">{text}</div>
    </div>
  );
}

function Menu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }

    function onDocDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onDocDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={wrapRef} className="mt-3 flex justify-end">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-[0_12px_30px_rgba(0,0,0,0.10)] ring-1 ring-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
        {items.map((it, idx) => (
          <button
            key={idx}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={`w-full px-4 py-3 text-left text-sm transition hover:bg-[#F2F2F7] ${
              it.danger ? "text-rose-700" : "text-slate-700"
            }`}
          >
            {it.label}
          </button>
        ))}
        <div className="h-px bg-[#E5E5EA]" />
        <button
          onClick={onClose}
          className="w-full px-4 py-3 text-left text-sm font-semibold text-[#007AFF] hover:bg-[#F2F2F7]"
        >
          收起
        </button>
      </div>
    </div>
  );
}

function IOSSheet({
  open,
  title,
  subtitle,
  leftAction,
  rightAction,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  leftAction?: { label: string; onClick: () => void };
  rightAction?: { label: string; onClick: () => void; emphasize?: boolean; danger?: boolean };
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-5 pb-6">
        <div className="rounded-[28px] bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-center pt-2">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          <div className="px-5 pt-3 pb-4 border-b border-[#E5E5EA]">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={leftAction ? leftAction.onClick : onClose}
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-[#007AFF] hover:bg-[#F2F2F7]"
              >
                {leftAction ? leftAction.label : "取消"}
              </button>

              <div className="text-center">
                <div className="text-base font-semibold text-slate-900">{title}</div>
                {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
              </div>

              {rightAction ? (
                <button
                  onClick={rightAction.onClick}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold hover:bg-[#F2F2F7] ${
                    rightAction.danger
                      ? "text-rose-700"
                      : rightAction.emphasize
                      ? "text-[#007AFF]"
                      : "text-slate-600"
                  }`}
                >
                  {rightAction.label}
                </button>
              ) : (
                <div className="w-[64px]" />
              )}
            </div>
          </div>

          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F2F2F7] px-4 py-3 ring-1 ring-[#E5E5EA]">
      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="min-w-[140px] text-right">{children}</div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  step = 15,
  min = 15,
  max = 240,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-2xl bg-white ring-1 ring-[#E5E5EA] overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="px-3 py-2 text-base font-bold text-[#007AFF] hover:bg-[#F2F2F7]"
        aria-label="減少"
      >
        −
      </button>
      <div className="px-3 py-2 text-sm font-semibold text-slate-800 tabular-nums">{value} 分</div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="px-3 py-2 text-base font-bold text-[#007AFF] hover:bg-[#F2F2F7]"
        aria-label="增加"
      >
        +
      </button>
    </div>
  );
}

function SessionCard({
  s,
  onPresent,
  onAbsent,
  onOpenMenu,
}: {
  s: Session;
  onPresent: () => void;
  onAbsent: () => void;
  onOpenMenu: () => void;
}) {
  const statusPill =
    s.status === "pending" ? (
      <Pill tone="muted" className="gap-1">
        <IconClock className="h-4 w-4" /> 待確認
      </Pill>
    ) : s.status === "present" ? (
      <Pill tone="success">已到</Pill>
    ) : s.status === "absent" ? (
      <Pill tone="danger">缺席</Pill>
    ) : (
      <Pill tone="muted">停課</Pill>
    );

  return (
    <div className="rounded-[24px] bg-white ring-1 ring-[#E5E5EA] shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="text-[34px] leading-none font-extrabold tracking-tight text-slate-800 w-[92px] tabular-nums">
            {s.start}
          </div>

          <div>
            {s.kind === "makeup" && s.makeupOfDateISO ? (
              <Pill tone="purple" className="mb-2">
                補課（原 {s.makeupOfDateISO}）
              </Pill>
            ) : null}
            <div className="text-[20px] font-bold text-slate-900">{s.student.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              {formatDurationMin(s.durationMin)}
              <span className="text-slate-300"> · </span>
              {s.start}–{endTime(s)}
            </div>

            {s.status === "absent" && s.reason ? (
              <div className="mt-2 text-sm text-slate-500">
                缺席原因：<span className="font-semibold text-slate-700">{s.reason.name}</span>
                {s.note ? <span className="text-slate-400"> · {s.note}</span> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {statusPill}
          <div className="flex items-center gap-3">
            <IconButton tone="green" ariaLabel="記錄已到" onClick={onPresent}>
              <IconCheck className="h-6 w-6" />
            </IconButton>
            <IconButton tone="red" ariaLabel="記錄缺席" onClick={onAbsent}>
              <IconX className="h-6 w-6" />
            </IconButton>
            <IconButton tone="blue" ariaLabel="更多" onClick={onOpenMenu}>
              <IconDots className="h-6 w-6" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabKey = "today" | "month" | "students";

type TabDef = {
  key: TabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

function HeaderBar({
  title,
  icon,
  right,
}: {
  title: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-[#E5E5EA] flex items-center justify-center text-slate-700">
          {icon}
        </div>
        <div className="text-[28px] leading-tight font-extrabold">{title}</div>
      </div>
      {right ? <div>{right}</div> : <div />}
    </div>
  );
}

function PlaceholderCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mt-6 rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-[#E5E5EA] p-6">
      <div className="text-lg font-extrabold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</div>
      <div className="mt-4 rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-600">
        這個頁面先做入口與導航結構，細節頁面之後再單獨設計（避免現在就鎖死資訊架構）。
      </div>
    </div>
  );
}

function BottomTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: TabDef[];
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  const MAX_VISIBLE = 4;
  const needsMore = tabs.length > MAX_VISIBLE;

  const visibleTabs = needsMore ? tabs.slice(0, MAX_VISIBLE - 1) : tabs;
  const extraTabs = needsMore ? tabs.slice(MAX_VISIBLE - 1) : [];

  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-4xl px-5">
          <div className="rounded-[22px] bg-white/80 backdrop-blur-xl shadow-[0_-6px_18px_rgba(0,0,0,0.10)] ring-1 ring-black/5 overflow-hidden">
            <div className="grid grid-cols-3">
              {visibleTabs.map((t) => {
                const isActive = active === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => onSelect(t.key)}
                    className={`py-3.5 flex flex-col items-center justify-center gap-1 transition active:scale-[0.99] ${
                      isActive ? "text-[#007AFF]" : "text-slate-500"
                    }`}
                    aria-label={t.label}
                  >
                    <div className="h-6 w-6">{t.icon(isActive)}</div>
                    <div className={`text-[11px] font-semibold ${isActive ? "" : ""}`}>{t.label}</div>
                  </button>
                );
              })}

              {needsMore ? (
                <button
                  onClick={() => setMoreOpen(true)}
                  className={`py-3.5 flex flex-col items-center justify-center gap-1 transition active:scale-[0.99] text-slate-500`}
                  aria-label="更多"
                >
                  <div className="h-6 w-6">
                    <IconMore className="h-6 w-6" />
                  </div>
                  <div className="text-[11px] font-semibold">更多</div>
                </button>
              ) : null}
            </div>
            <div className="h-[calc(12px+env(safe-area-inset-bottom))] bg-transparent" />
          </div>
        </div>
      </div>

      <IOSSheet
        open={moreOpen}
        title="更多"
        onClose={() => setMoreOpen(false)}
        leftAction={{ label: "關閉", onClick: () => setMoreOpen(false) }}
      >
        <div className="space-y-2">
          {extraTabs.length ? (
            extraTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  onSelect(t.key);
                  setMoreOpen(false);
                }}
                className="w-full rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-[#EDEDF3]"
              >
                {t.label}
              </button>
            ))
          ) : (
            <div className="rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-600">
              目前沒有更多功能。
            </div>
          )}
        </div>
      </IOSSheet>
    </>
  );
}

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [sessions, setSessions] = useState<Session[]>(() => {
    const d = todayISO();
    return [
      { id: 2001, student: studentsSeed[0], dateISO: d, start: "14:00", durationMin: 60, status: "pending", kind: "regular" },
      { id: 2002, student: studentsSeed[1], dateISO: d, start: "15:00", durationMin: 60, status: "pending", kind: "regular" },
      { id: 2003, student: studentsSeed[2], dateISO: d, start: "16:00", durationMin: 60, status: "pending", kind: "regular" },
      {
        id: 2004,
        student: studentsSeed[3],
        dateISO: d,
        start: "17:00",
        durationMin: 60,
        status: "pending",
        kind: "makeup",
        makeupOfDateISO: addDaysISO(d, -4),
        makeupOfSessionId: 1999,
      },
    ];
  });

  const daySessions = useMemo(() => {
    return sessions
      .filter((s) => s.dateISO === selectedDate)
      .slice()
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [sessions, selectedDate]);

  const stats = useMemo(() => {
    const total = daySessions.length;
    const present = daySessions.filter((s) => s.status === "present").length;
    const absent = daySessions.filter((s) => s.status === "absent").length;
    const pending = daySessions.filter((s) => s.status === "pending").length;
    return { total, present, absent, pending };
  }, [daySessions]);

  const [toast, setToast] = useState<string>("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

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

  useEffect(() => {
    setMenuOpenId(null);
    setAbsentOpen(false);
    setMakeupOpen(false);
    setEditOpen(false);
    setDeleteOpen(false);
  }, [activeTab]);

  function patchSession(id: number, patch: Partial<Session>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function requestDelete(id: number) {
    setMenuOpenId(null);
    setDeleteId(id);
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const kindText = deleteTarget.kind === "makeup" ? "補課" : deleteTarget.kind === "extra" ? "加課" : "課次";
    setSessions((prev) => removeSessionById(prev, deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setToast(`已刪除${kindText}`);
    setDeleteOpen(false);
  }

  function openAbsent(id: number) {
    setSelectedId(id);
    setAbsentNote("");
    setAbsentOpen(true);
  }

  function saveAbsentByReason(reason: Reason) {
    if (!selected) return;
    patchSession(selected.id, { status: "absent", reason, note: absentNote ? absentNote : undefined });
    setToast(`已記錄缺席：${reason.name}`);
    setAbsentOpen(false);
  }

  function openMakeupFromMenu(id: number, purpose: "makeup" | "extra") {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(id);
    setMkDate(selectedDate);
    setMkStart(endTime(s));
    setMkPurpose(purpose);
    setMakeupOpen(true);
  }

  function createMakeup() {
    if (!selected) return;
    const newId = Math.max(...sessions.map((x) => x.id), 2005) + 1; // 簡單的 ID 生成，避免重複
    const newSession: Session = {
      id: newId,
      student: selected.student,
      dateISO: mkDate,
      start: mkStart,
      durationMin: 60,
      status: "pending",
      kind: mkPurpose === "makeup" ? "makeup" : "extra",
      makeupOfDateISO: mkPurpose === "makeup" ? selected.dateISO : undefined,
      makeupOfSessionId: mkPurpose === "makeup" ? selected.id : undefined,
    };
    setSessions((prev) => [...prev, newSession]);
    setToast(mkPurpose === "makeup" ? "已建立補課" : "已建立加課");
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
    patchSession(selected.id, { start: editStart, durationMin: editDuration });
    setToast("已更新課次");
    setEditOpen(false);
  }

  function exportExcelStub() {
    setToast("（預覽）已觸發匯出 Excel");
  }

  const tabs: TabDef[] = useMemo(
    () => [
      {
        key: "today",
        label: "今日",
        icon: (active) => <IconToday className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
      {
        key: "month",
        label: "月份",
        icon: (active) => <IconMonth className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
      {
        key: "students",
        label: "學生",
        icon: (active) => <IconUsers className={`h-6 w-6 ${active ? "" : ""}`} />,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 font-sans">
      {toast ? <Toast text={toast} /> : null}

      <div className="pb-28">
        {activeTab === "today" ? (
          <div className="mx-auto max-w-4xl px-5 py-8">
            <HeaderBar
              title="出席紀錄系統"
              icon={<IconCalendar className="h-6 w-6" />}
              right={
                <button
                  onClick={exportExcelStub}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition active:scale-[0.99]"
                >
                  <IconFile className="h-5 w-5" />
                  匯出 Excel
                </button>
              }
            />

            <div className="mt-5 rounded-[18px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-[#E5E5EA] px-3 py-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedDate((d) => addDaysISO(d, -1))}
                  className="h-10 w-10 rounded-2xl hover:bg-[#F2F2F7] flex items-center justify-center text-slate-600 active:scale-[0.98]"
                  aria-label="上一天"
                >
                  <IconChevronLeft className="h-6 w-6" />
                </button>

                <div className="text-[18px] font-bold text-slate-800">{formatZHDate(selectedDate)}</div>

                <button
                  onClick={() => setSelectedDate((d) => addDaysISO(d, 1))}
                  className="h-10 w-10 rounded-2xl hover:bg-[#F2F2F7] flex items-center justify-center text-slate-600 active:scale-[0.98]"
                  aria-label="下一天"
                >
                  <IconChevronRight className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-6 text-[13px] text-slate-500">
              <div>
                今日排程：<span className="font-semibold text-slate-800">{stats.total}</span> 堂
              </div>
              <div className="text-emerald-700">
                已到：<span className="font-semibold">{stats.present}</span>
              </div>
              <div className="text-rose-700">
                缺席：<span className="font-semibold">{stats.absent}</span>
              </div>
              <div className="text-slate-400">
                未定：<span className="font-semibold">{stats.pending}</span>
              </div>
              <div className="ml-auto text-slate-400">
                現在：{pad2(now.getHours())}:{pad2(now.getMinutes())}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {daySessions.length ? (
                daySessions.map((s) => (
                  <div key={s.id} className="relative">
                    <SessionCard
                      s={s}
                      onPresent={() => {
                        patchSession(s.id, { status: "present", reason: undefined, note: undefined });
                        setToast("已記錄：已到");
                      }}
                      onAbsent={() => openAbsent(s.id)}
                      onOpenMenu={() => setMenuOpenId((cur) => (cur === s.id ? null : s.id))}
                    />

                    <Menu
                      open={menuOpenId === s.id}
                      onClose={() => setMenuOpenId(null)}
                      items={[
                        { label: "編輯課次（時間 / 時長）", onClick: () => openEditFromMenu(s.id) },
                        { label: "安排補課（補回本堂）", onClick: () => openMakeupFromMenu(s.id, "makeup") },
                        { label: "額外加課（不抵扣缺席）", onClick: () => openMakeupFromMenu(s.id, "extra") },

                        {
                          label:
                            s.kind === "makeup" ? "刪除此補課" : s.kind === "extra" ? "刪除此加課" : "刪除此課次",
                          onClick: () => requestDelete(s.id),
                          danger: true,
                        },

                        {
                          label: s.status === "cancelled" ? "取消停課" : "標記停課",
                          onClick: () => {
                            patchSession(s.id, {
                              status: s.status === "cancelled" ? "pending" : "cancelled",
                              reason: undefined,
                              note: undefined,
                            });
                            setToast(s.status === "cancelled" ? "已取消停課" : "已標記停課");
                          },
                          danger: true,
                        },
                      ]}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-[#E5E5EA] p-6 text-slate-500">
                  此日期沒有排程。
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "month" ? (
          <div className="mx-auto max-w-4xl px-5 py-8">
            <HeaderBar title="月份總覽" icon={<IconMonth className="h-6 w-6" />} />
            <PlaceholderCard
              title="月份統計入口（待設計）"
              desc="之後這裡會做：按月份聚合（出席/缺席/停課/補課/加課）、依學生篩選、以及匯出前的對應檢查（姓名+生日匹配）。"
            />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl px-5 py-8">
            <HeaderBar title="管理學生" icon={<IconUsers className="h-6 w-6" />} />
            <PlaceholderCard
              title="學生管理入口（待設計）"
              desc="之後這裡會做：新增/停用/復學、姓名與生日的匹配鍵、課表規則（每週哪天哪個時段）、以及與 Excel 模板的對應預覽。"
            />
          </div>
        )}
      </div>

      <BottomTabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />

      <IOSSheet
        open={absentOpen}
        title="請假 / 缺席"
        subtitle={selected ? `${selected.student.name} · ${selected.dateISO} · ${selected.start}–${endTime(selected)}` : undefined}
        onClose={() => setAbsentOpen(false)}
        leftAction={{ label: "取消", onClick: () => setAbsentOpen(false) }}
      >
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-semibold text-slate-500">（可選）備註</div>
            <textarea
              value={absentNote}
              onChange={(e) => setAbsentNote(e.target.value)}
              placeholder="例如：已通知家長 / 交通延誤..."
              className="mt-2 w-full min-h-[92px] rounded-2xl border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C7DAFF]"
            />
          </div>

          <div>
            <div className="text-[12px] font-semibold text-slate-500">缺席原因（點選即完成記錄）</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {reasonsSeed.map((r) => (
                <button
                  key={r.id}
                  onClick={() => saveAbsentByReason(r)}
                  className="rounded-2xl border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[#EDEDF3] transition active:scale-[0.99]"
                >
                  {r.name}
                  <span className="ml-2 text-xs font-medium text-slate-400">{r.code}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-slate-400">補課/加課請到每堂右側「…」選單操作。</div>
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={makeupOpen}
        title={mkPurpose === "makeup" ? "安排補課" : "安排加課"}
        subtitle={selected ? `${selected.student.name} · 原課 ${selected.dateISO} ${selected.start}–${endTime(selected)}` : undefined}
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
              className="rounded-2xl border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C7DAFF]"
            />
          </FieldRow>

          <FieldRow label="開始時間">
            <input
              type="time"
              value={mkStart}
              onChange={(e) => setMkStart(e.target.value)}
              className="rounded-2xl border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C7DAFF]"
            />
          </FieldRow>

          <FieldRow label="用途">
            <select
              value={mkPurpose}
              onChange={(e) => setMkPurpose(e.target.value as any)}
              className="rounded-2xl border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C7DAFF]"
            >
              <option value="makeup">補回本堂</option>
              <option value="extra">額外加課</option>
            </select>
          </FieldRow>

          <div className="rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-600">
            補課不放在請假流程內，避免主流程被低頻操作打斷。
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={editOpen}
        title="編輯課次"
        subtitle={selected ? `${selected.student.name} · ${selected.dateISO}` : undefined}
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
              className="rounded-2xl border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C7DAFF]"
            />
          </FieldRow>

          <FieldRow label="時長">
            <Stepper value={editDuration} onChange={setEditDuration} step={15} min={15} max={240} />
          </FieldRow>

          <FieldRow label="結束時間">
            <div className="text-sm font-semibold text-slate-800 tabular-nums">{addMinutes(editStart, editDuration)}</div>
          </FieldRow>

          <div className="rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-600">
            提示：時長以 15 分鐘為步進；你也可以後續改成固定 60 分鐘或按學生規則自動帶入。
          </div>
        </div>
      </IOSSheet>

      <IOSSheet
        open={deleteOpen}
        title="刪除課次？"
        subtitle={
          deleteTarget
            ? `${deleteTarget.student.name} · ${deleteTarget.dateISO} · ${deleteTarget.start}–${endTime(deleteTarget)}`
            : undefined
        }
        onClose={() => setDeleteOpen(false)}
        leftAction={{ label: "取消", onClick: () => setDeleteOpen(false) }}
        rightAction={{ label: "刪除", onClick: confirmDelete, danger: true }}
      >
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#F2F2F7] ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-700">
            這個操作無法復原。確認要刪除{deleteTarget?.kind === "makeup" ? "補課" : deleteTarget?.kind === "extra" ? "加課" : "課次"}嗎？
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-[#E5E5EA] px-4 py-3 text-sm text-slate-600">
            {deleteTarget?.kind === "regular"
              ? "這是常規排程。若只是今天不上課、仍想保留排程與歷史紀錄，建議用「標記停課」。"
              : "若你想保留記錄但不授課，建議用「標記停課」。"}
          </div>
        </div>
      </IOSSheet>
    </div>
  );
}