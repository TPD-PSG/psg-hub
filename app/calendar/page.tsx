"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string;
  type: "key_date" | "task" | "tour_stop";
  kdType?: string;
  title: string;
  production: string | null;
  productionId: number | null;
  startDate: string;
  endDate: string | null;
  notes?: string | null;
  color: string;
  href: string;
  venue?: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const KEY_DATE_LABELS: Record<string, string> = {
  design_presentation: "Design Presentation",
  pre_production: "Pre-Production",
  first_rehearsal: "First Rehearsal",
  rehearsal_period: "Rehearsal Period",
  load_in: "Load In",
  fit_up: "Fit Up",
  technical_rehearsal: "Technical Rehearsal",
  dress_rehearsal: "Dress Rehearsal",
  preview: "Preview",
  press_night: "Press Night",
  performance: "Performance",
  get_out: "Get Out",
  other: "Other",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

function datesBetween(start: string, end: string | null): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  return <Suspense><CalendarInner /></Suspense>;
}

type StaffAssignment = {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  activityType: string | null;
  notes: string | null;
  user: { id: number; name: string; avatarUrl: string | null; color?: string | null };
  production: { id: number; name: string };
  tourStop: { id: number; venue: { name: string; city: string | null } } | null;
};

const PROD_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

const ACTIVITY_TYPES = ["GET IN", "FIT UP", "TECH", "DRESS", "PREVIEW", "PERF", "PERF+OUT", "REH", "IN", "OUT", "TBC"] as const;

const ACTIVITY_COLORS: Record<string, string> = {
  "GET IN": "#16a34a",
  "FIT UP": "#16a34a",
  "TECH":   "#2563eb",
  "DRESS":  "#7c3aed",
  "PREVIEW":"#db2777",
  "PERF":   "#ea580c",
  "PERF+OUT":"#dc2626",
  "REH":    "#0891b2",
  "IN":     "#16a34a",
  "OUT":    "#dc2626",
  "TBC":    "#6b7280",
};

type ProductionSummary = { id: number; name: string; color: string | null; venue: string | null };

function CalendarInner() {
  const searchParams = useSearchParams();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [allProductions, setAllProductions] = useState<ProductionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list" | "schedule">("month");

  const refreshAssignments = () => fetch("/api/staff-assignments").then(r => r.json()).then(d => { if (Array.isArray(d)) setAssignments(d); });

  useEffect(() => {
    fetch("/api/calendar").then(r => r.json()).then(d => { if (Array.isArray(d)) setEvents(d); });
    fetch("/api/productions").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAllProductions(d.map((p: { id: number; name: string; color: string | null; venue: string | null; venueRef?: { name: string; city: string | null } | null }) => ({
        id: p.id, name: p.name, color: p.color,
        venue: p.venueRef ? `${p.venueRef.name}${p.venueRef.city ? ", " + p.venueRef.city : ""}` : p.venue,
      })));
    });
    refreshAssignments();
  }, []);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Read filter state from URL params (set by Sidebar)
  const hiddenProdsParam = searchParams.get("hideProds") ?? "";
  const hiddenTypesParam = searchParams.get("hideTypes") ?? "";
  const hiddenProdIds = new Set(hiddenProdsParam ? hiddenProdsParam.split(",").map(Number) : []);
  const hiddenTypeKeys = new Set(hiddenTypesParam ? hiddenTypesParam.split(",") : []);

  // Apply filters
  const filteredEvents = events.filter(ev => {
    if (ev.productionId !== null && hiddenProdIds.has(ev.productionId)) return false;
    if (hiddenTypeKeys.has(ev.type)) return false;
    return true;
  });

  // Build a map: dateStr → events on that day
  const eventsByDate: Record<string, CalEvent[]> = {};
  filteredEvents.forEach(ev => {
    const dates = datesBetween(ev.startDate, ev.endDate);
    dates.forEach(d => {
      if (!eventsByDate[d]) eventsByDate[d] = [];
      eventsByDate[d].push(ev);
    });
  });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toDateStr(today);

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthEvents = filteredEvents
    .filter(ev => {
      const s = ev.startDate.slice(0, 10);
      const e = (ev.endDate ?? ev.startDate).slice(0, 10);
      return s <= monthEnd && e >= monthStart;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="space-y-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <div className="flex-1" />
          <div className="flex gap-1 rounded-lg overflow-hidden border text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
            {(["month", "list", "schedule"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 capitalize transition-colors"
                style={view === v ? { backgroundColor: "var(--psg-blue)", color: "#fff" } : { backgroundColor: "transparent", color: "var(--psg-muted)" }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>‹</button>
          <h2 className="text-lg font-semibold text-white w-48 text-center">{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>›</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="text-xs px-3 py-1 rounded border hover:bg-white/5 transition-colors ml-2"
            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Today</button>
        </div>

        {view === "month" ? (
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] border-b border-r p-1" style={{ borderColor: "var(--psg-card-border)", opacity: 0.3 }} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateStr] ?? [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selected;
                const col = (firstDay + i) % 7;
                const isLastCol = col === 6;
                return (
                  <div key={day} onClick={() => setSelected(isSelected ? null : dateStr)}
                    className={`min-h-[80px] border-b p-1 cursor-pointer transition-colors ${!isLastCol ? "border-r" : ""} ${isSelected ? "bg-white/10" : "hover:bg-white/5"}`}
                    style={{ borderColor: "var(--psg-card-border)" }}>
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "text-white" : ""}`}
                      style={isToday ? { backgroundColor: "var(--psg-blue)" } : { color: "var(--psg-muted)" }}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => {
                        const isStart = ev.startDate.slice(0, 10) === dateStr;
                        return (
                          <div key={`${ev.id}-${idx}`}
                            className="text-xs px-1.5 py-0.5 rounded truncate"
                            style={{ backgroundColor: ev.color + "33", color: ev.color, borderLeft: isStart ? `2px solid ${ev.color}` : "2px solid transparent" }}>
                            {isStart ? (ev.type === "task" ? "● " : ev.type === "tour_stop" ? "📍 " : "") + ev.title : ""}
                            {!isStart && <span className="opacity-50">·</span>}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs px-1" style={{ color: "var(--psg-muted)" }}>+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "list" ? (
          <div className="space-y-2">
            {monthEvents.length === 0 && (
              <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                No events in {MONTHS[month]} {year}.
              </div>
            )}
            {monthEvents.map(ev => (
              <Link key={ev.id} href={ev.href}
                className="flex items-center gap-4 rounded-xl border px-5 py-4 hover:border-blue-500/40 hover:bg-white/5 transition-all"
                style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{ev.title}</span>
                    {ev.production && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ev.color + "22", color: ev.color }}>{ev.production}</span>}
                    {ev.type === "task" && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">Task</span>}
                    {ev.type === "tour_stop" && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">Tour Stop</span>}
                    {ev.kdType && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{KEY_DATE_LABELS[ev.kdType] ?? ev.kdType}</span>}
                  </div>
                  {ev.notes && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--psg-muted)" }}>{ev.notes}</p>}
                </div>
                <div className="text-xs shrink-0 text-right" style={{ color: "var(--psg-muted)" }}>
                  {new Date(ev.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {ev.endDate && ev.endDate.slice(0, 10) !== ev.startDate.slice(0, 10) && (
                    <> → {new Date(ev.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* ── Schedule view ── */
          <ScheduleView year={year} month={month} assignments={assignments} productions={allProductions} events={events} onRefresh={refreshAssignments} />
        )}

        {/* Selected day panel — month view only */}
        {view !== "team" && view !== "schedule" && selected && selectedEvents.length > 0 && (
          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                {new Date(selected + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <button onClick={() => setSelected(null)} className="text-lg" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="space-y-2">
              {selectedEvents.map((ev, idx) => (
                <Link key={`${ev.id}-${idx}`} href={ev.href}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-white/5 transition-colors"
                  style={{ borderColor: "var(--psg-card-border)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{ev.title}</div>
                    {ev.production && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{ev.production}</div>}
                    {ev.notes && <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{ev.notes}</div>}
                  </div>
                  {ev.kdType && <span className="text-xs shrink-0" style={{ color: ev.color }}>{KEY_DATE_LABELS[ev.kdType] ?? ev.kdType}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

// ── Team View ─────────────────────────────────────────────────────────────────

// ── Schedule View ──────────────────────────────────────────────────────────────

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Map production key date types → schedule activity labels
const KD_TO_ACTIVITY: Record<string, string> = {
  get_in: "GET IN", load_in: "GET IN",
  fit_up: "FIT UP",
  technical_rehearsal: "TECH",
  dress_rehearsal: "DRESS",
  preview: "PREVIEW",
  performance: "PERF",
  get_out: "OUT",
  rehearsal_period: "REH",
  first_rehearsal: "REH",
};

function ScheduleView({ year, month, assignments, productions, events, onRefresh }: {
  year: number; month: number;
  assignments: StaffAssignment[];
  productions: ProductionSummary[];
  events: CalEvent[];
  onRefresh: () => void;
}) {
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editAssignment, setEditAssignment] = useState<StaffAssignment | null>(null);
  const [form, setForm] = useState({ userId: "", productionId: "", startDate: "", endDate: "", activityType: "", notes: "" });

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); });
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  const monthStart = days[0];
  const monthEnd = days[days.length - 1];
  const monthAssignments = assignments.filter(a => {
    const s = a.startDate.slice(0, 10);
    const e = a.endDate.slice(0, 10);
    return s <= monthEnd && e >= monthStart;
  });

  // Show ALL productions (not just ones with assignments)
  const allProductions = productions;

  // Build key-date + tour-stop activity lookup: prodId → date → { activity, venue? }
  const kdLookup: Record<number, Record<string, { activity: string; venue?: string }>> = {};
  function addToKdLookup(pid: number, startStr: string, endStr: string | null, activity: string, venue?: string) {
    if (!kdLookup[pid]) kdLookup[pid] = {};
    const s = startStr.slice(0, 10) < monthStart ? monthStart : startStr.slice(0, 10);
    const e = (endStr ?? startStr).slice(0, 10) > monthEnd ? monthEnd : (endStr ?? startStr).slice(0, 10);
    let cur = new Date(s + "T12:00:00");
    const end = new Date(e + "T12:00:00");
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (!kdLookup[pid][ds]) kdLookup[pid][ds] = { activity, venue };
      cur.setDate(cur.getDate() + 1);
    }
  }
  events.forEach(ev => {
    if (!ev.productionId) return;
    if (ev.type === "key_date" && ev.kdType) {
      const activity = KD_TO_ACTIVITY[ev.kdType];
      if (activity) addToKdLookup(ev.productionId, ev.startDate, ev.endDate, activity);
    } else if (ev.type === "tour_stop") {
      const title = ev.title.toLowerCase();
      const activity = title.includes("load in") || title.includes("get in") ? "GET IN"
        : title.includes("get out") ? "OUT"
        : "PERF";
      addToKdLookup(ev.productionId, ev.startDate, ev.endDate, activity, ev.venue ?? undefined);
    }
  });

  // Build lookup: prodId → date → assignments[]
  const lookup: Record<number, Record<string, StaffAssignment[]>> = {};
  monthAssignments.forEach(a => {
    if (!lookup[a.production.id]) lookup[a.production.id] = {};
    const s = a.startDate.slice(0, 10) < monthStart ? monthStart : a.startDate.slice(0, 10);
    const e = a.endDate.slice(0, 10) > monthEnd ? monthEnd : a.endDate.slice(0, 10);
    let cur = new Date(s + "T12:00:00");
    const end = new Date(e + "T12:00:00");
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (!lookup[a.production.id][ds]) lookup[a.production.id][ds] = [];
      lookup[a.production.id][ds].push(a);
      cur.setDate(cur.getDate() + 1);
    }
  });

  function openAdd(date?: string, productionId?: number) {
    setEditAssignment(null);
    const presetActivity = date && productionId ? (kdLookup[productionId]?.[date]?.activity ?? "") : "";
    setForm({ userId: "", productionId: productionId ? String(productionId) : "", startDate: date ?? "", endDate: date ?? "", activityType: presetActivity, notes: "" });
    setShowModal(true);
  }

  function openEdit(a: StaffAssignment) {
    setEditAssignment(a);
    setForm({ userId: String(a.userId), productionId: String(a.production.id), startDate: a.startDate.slice(0, 10), endDate: a.endDate.slice(0, 10), activityType: a.activityType ?? "", notes: a.notes ?? "" });
    setShowModal(true);
  }

  async function saveModal() {
    if (!form.userId || !form.productionId || !form.startDate || !form.endDate) return;
    if (editAssignment) {
      await fetch(`/api/staff-assignments/${editAssignment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: form.userId, productionId: form.productionId, startDate: form.startDate, endDate: form.endDate, activityType: form.activityType || null, notes: form.notes || null }),
      });
    } else {
      await fetch("/api/staff-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: form.userId, productionId: form.productionId, startDate: form.startDate, endDate: form.endDate, activityType: form.activityType || null, notes: form.notes || null }),
      });
    }
    setShowModal(false);
    onRefresh();
  }

  async function deleteAssignment() {
    if (!editAssignment) return;
    await fetch(`/api/staff-assignments/${editAssignment.id}`, { method: "DELETE" });
    setShowModal(false);
    onRefresh();
  }

  const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
          Click any cell to assign a team member, or use the button for a full date range.
        </p>
        <button onClick={() => openAdd()} className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          + Assign Staff
        </button>
      </div>

      {allProductions.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          No productions found. Add productions first.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="text-xs border-collapse" style={{ minWidth: 300 + allProductions.length * 160 }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 px-3 py-2 text-left border-b border-r w-28" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }} />
                {allProductions.map(p => (
                  <th key={p.id} colSpan={2} className="border-b border-r px-2 py-2 text-center font-bold text-white" style={{ borderColor: "var(--psg-card-border)", backgroundColor: p.color ? p.color + "33" : "rgba(255,255,255,0.04)", minWidth: 160 }}>
                    <div className="truncate" title={p.name}>{p.name}</div>
                    {p.venue && <div className="font-normal truncate mt-0.5" style={{ color: "var(--psg-muted)", fontSize: 10 }}>{p.venue}</div>}
                  </th>
                ))}
              </tr>
              <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                <th className="sticky left-0 z-10 px-3 py-1 border-r" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }} />
                {allProductions.map(p => (
                  <>
                    <th key={`${p.id}-act`} className="px-2 py-1 font-normal text-center border-r w-16" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Activity</th>
                    <th key={`${p.id}-st`} className="px-2 py-1 font-normal text-center border-r" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Staff</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((dateStr, di) => {
                const date = new Date(dateStr + "T12:00:00");
                const dow = date.getDay();
                const isToday = dateStr === todayStr;
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <tr key={dateStr} className={di > 0 ? "border-t" : ""} style={{ borderColor: "var(--psg-card-border)", backgroundColor: isToday ? "rgba(37,99,235,0.07)" : isWeekend ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <td className="sticky left-0 z-10 px-3 py-1 whitespace-nowrap border-r font-medium" style={{ backgroundColor: isToday ? "rgba(37,99,235,0.1)" : isWeekend ? "rgba(255,255,255,0.02)" : "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                      <span className="font-semibold" style={{ color: isToday ? "var(--psg-blue)" : isWeekend ? "rgba(255,255,255,0.3)" : "white" }}>{DOW[dow]}</span>
                      <span className="ml-1.5" style={{ color: isToday ? "var(--psg-blue)" : "var(--psg-muted)" }}>{date.getDate()}/{date.getMonth()+1}</span>
                    </td>
                    {allProductions.map(p => {
                      const cellItems = lookup[p.id]?.[dateStr] ?? [];
                      // Activity: prefer manually set on assignment, fall back to key date from production schedule
                      const kdCell = kdLookup[p.id]?.[dateStr];
                      const actType = cellItems[0]?.activityType ?? kdCell?.activity ?? null;
                      const actColor = actType ? (ACTIVITY_COLORS[actType] ?? "#6b7280") : null;
                      const actFromKd = !cellItems[0]?.activityType && !!actType;
                      const venueLabel = actFromKd ? kdCell?.venue : null;
                      return (
                        <>
                          <td key={`${p.id}-act-${dateStr}`} className="border-r text-center cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", backgroundColor: actColor ? actColor + (actFromKd ? "55" : "dd") : "transparent", width: 64, minWidth: 64 }} onClick={() => cellItems.length > 0 ? openEdit(cellItems[0]) : openAdd(dateStr, p.id)}>
                            {actType && <span className="font-bold text-white px-1 py-0.5 block leading-5" style={{ fontSize: 10, opacity: actFromKd ? 0.7 : 1 }}>{actType}</span>}
                            {venueLabel && <span className="text-white block px-0.5 leading-3 pb-0.5" style={{ fontSize: 8, opacity: 0.85 }}>{venueLabel}</span>}
                          </td>
                          <td key={`${p.id}-st-${dateStr}`} className="border-r cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", minWidth: 72 }} onClick={() => cellItems.length > 0 ? openEdit(cellItems[0]) : openAdd(dateStr, p.id)}>
                            <div className="px-1 py-0.5 flex flex-col gap-px min-h-[22px]">
                              {cellItems.map(a => {
                                const badgeBg = a.user.color ?? "#eab308";
                                const badgeFg = "#fff";
                                return (
                                  <span key={a.id} className="font-bold px-1.5 rounded text-center block leading-5" style={{ backgroundColor: badgeBg, color: badgeFg, fontSize: 10 }}>
                                    {a.user.name.split(" ")[0].toUpperCase()}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity colour legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {ACTIVITY_TYPES.map(t => (
          <div key={t} className="flex items-center gap-1 text-xs">
            <span className="inline-block rounded px-1.5 leading-4 font-bold text-white" style={{ backgroundColor: ACTIVITY_COLORS[t], fontSize: 9 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-base font-semibold text-white">{editAssignment ? "Edit Assignment" : "Assign Staff"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Staff member *</label>
                <select className={inp} style={inpStyle} value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">Select…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Production *</label>
                <select className={inp} style={inpStyle} value={form.productionId} onChange={e => setForm(f => ({ ...f, productionId: e.target.value }))}>
                  <option value="">Select…</option>
                  {allProductions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>From *</label>
                  <input type="date" className={inp} style={inpStyle} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>To *</label>
                  <input type="date" className={inp} style={inpStyle} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Activity type</label>
                <select className={inp} style={inpStyle} value={form.activityType} onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))}>
                  <option value="">— None —</option>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <input className={inp} style={inpStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-between gap-3 pt-2">
              <div>
                {editAssignment && (
                  <button onClick={deleteAssignment} className="px-3 py-2 text-sm rounded-lg transition-colors hover:bg-red-900/30" style={{ color: "#f87171" }}>Delete</button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                <button onClick={saveModal} disabled={!form.userId || !form.productionId || !form.startDate || !form.endDate} className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
