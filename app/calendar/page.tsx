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
  notes: string | null;
  user: { id: number; name: string; avatarUrl: string | null };
  production: { id: number; name: string };
  tourStop: { id: number; venue: { name: string; city: string | null } } | null;
};

const PROD_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

function CalendarInner() {
  const searchParams = useSearchParams();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list" | "team">("month");

  useEffect(() => {
    fetch("/api/calendar").then(r => r.json()).then(d => { if (Array.isArray(d)) setEvents(d); });
    fetch("/api/staff-assignments").then(r => r.json()).then(d => { if (Array.isArray(d)) setAssignments(d); });
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
            {(["month", "list", "team"] as const).map(v => (
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
          /* ── Team view ── */
          <TeamView year={year} month={month} assignments={assignments} onRefresh={() => fetch("/api/staff-assignments").then(r => r.json()).then(d => { if (Array.isArray(d)) setAssignments(d); })} />
        )}

        {/* Selected day panel — month view only */}
        {view !== "team" && selected && selectedEvents.length > 0 && (
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

function TeamView({ year, month, assignments, onRefresh }: {
  year: number; month: number;
  assignments: StaffAssignment[];
  onRefresh: () => void;
}) {
  const [productions, setProductions] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", productionId: "", startDate: "", endDate: "", notes: "" });
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setProductions(d.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))); });
    fetch("/api/users").then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d.map((u: { id: number; name: string }) => ({ id: u.id, name: u.name }))); });
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  // All staff with assignments + any users loaded
  const assignedUserIds = new Set(assignments.map(a => a.userId));
  const assignedUsers = assignments
    .map(a => a.user)
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
  const allStaff = users.length > 0
    ? users.filter(u => assignedUserIds.has(u.id) || users.length <= 10)
    : assignedUsers;

  // Build prod→colour map
  const prodIds = [...new Set(assignments.map(a => a.production.id))];
  const prodColor: Record<number, string> = {};
  prodIds.forEach((id, i) => { prodColor[id] = PROD_COLORS[i % PROD_COLORS.length]; });

  // Month assignments only
  const monthStart = days[0];
  const monthEnd = days[days.length - 1];
  const monthAssignments = assignments.filter(a => {
    const s = a.startDate.slice(0, 10);
    const e = a.endDate.slice(0, 10);
    return s <= monthEnd && e >= monthStart;
  });

  async function saveAssignment() {
    if (!form.userId || !form.productionId || !form.startDate || !form.endDate) return;
    if (editId) {
      await fetch(`/api/staff-assignments/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/staff-assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setShowForm(false);
    setEditId(null);
    onRefresh();
  }

  async function deleteAssignment(id: number) {
    await fetch(`/api/staff-assignments/${id}`, { method: "DELETE" });
    onRefresh();
  }

  const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
          {monthAssignments.length === 0 ? "No staff assigned this month." : `${monthAssignments.length} assignment${monthAssignments.length !== 1 ? "s" : ""} this month`}
        </p>
        <button
          onClick={() => { setEditId(null); setForm({ userId: "", productionId: "", startDate: "", endDate: "", notes: "" }); setShowForm(true); }}
          className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
          style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          + Assign Staff
        </button>
      </div>

      {allStaff.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          No staff assigned yet. Click &ldquo;Assign Staff&rdquo; to get started.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-xs border-collapse" style={{ minWidth: 500 }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                <th className="text-left px-4 py-3 font-semibold w-28 sticky left-0" style={{ color: "var(--psg-muted)", backgroundColor: "var(--psg-card-bg)" }}>Staff</th>
                {days.map(d => {
                  const date = new Date(d + "T12:00:00");
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  const dow = date.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={d} className="text-center py-2 font-normal" style={{ width: 26, color: isToday ? "var(--psg-blue)" : isWeekend ? "var(--psg-muted)" : "var(--psg-muted)", opacity: isWeekend && !isToday ? 0.5 : 1, backgroundColor: isToday ? "var(--psg-blue)22" : "transparent" }}>
                      {date.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allStaff.map((staff, si) => {
                const staffAssignments = monthAssignments.filter(a => a.userId === staff.id);
                return (
                  <tr key={staff.id} className={si > 0 ? "border-t" : ""} style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-1 font-medium text-white whitespace-nowrap sticky left-0" style={{ backgroundColor: "var(--psg-card-bg)" }}>{staff.name}</td>
                    {days.map(d => {
                      const dayAssignments = staffAssignments.filter(a => {
                        const s = a.startDate.slice(0, 10);
                        const e = a.endDate.slice(0, 10);
                        return d >= s && d <= e;
                      });
                      const isToday = d === new Date().toISOString().slice(0, 10);
                      const hasClash = dayAssignments.length > 1;
                      return (
                        <td key={d} className="p-0 relative" style={{ backgroundColor: isToday ? "var(--psg-blue)11" : "transparent" }}>
                          {dayAssignments.length > 0 ? (
                            <div className="relative group h-7 flex flex-col gap-px py-0.5">
                              {dayAssignments.map(a => (
                                <div
                                  key={a.id}
                                  className="flex-1 cursor-pointer"
                                  style={{ backgroundColor: (prodColor[a.production.id] ?? "#3b82f6") + (hasClash ? "99" : "cc") }}
                                  onClick={() => { setEditId(a.id); setForm({ userId: String(a.userId), productionId: String(a.production.id), startDate: a.startDate.slice(0, 10), endDate: a.endDate.slice(0, 10), notes: a.notes ?? "" }); setShowForm(true); }}
                                />
                              ))}
                              {/* Hover tooltip */}
                              <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:flex flex-col gap-0.5 bg-gray-900 border rounded px-2 py-1.5 shadow-xl pointer-events-none" style={{ borderColor: "var(--psg-card-border)", fontSize: 11, whiteSpace: "nowrap" }}>
                                {dayAssignments.map(a => (
                                  <span key={a.id} style={{ color: prodColor[a.production.id] ?? "#3b82f6" }}>{a.production.name}</span>
                                ))}
                                {hasClash && <span className="text-yellow-400 text-xs">⚠ clash</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="h-7" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {prodIds.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {prodIds.map(id => {
            const a = assignments.find(x => x.production.id === id);
            return a ? (
              <div key={id} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--psg-muted)" }}>
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: prodColor[id] }} />
                {a.production.name}
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Assignment list */}
      {monthAssignments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Assignments this month</div>
          {monthAssignments.map(a => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: prodColor[a.production.id] ?? "#3b82f6" }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white font-medium">{a.user.name}</span>
                <span className="text-xs mx-2" style={{ color: "var(--psg-muted)" }}>·</span>
                <span className="text-xs" style={{ color: prodColor[a.production.id] ?? "#3b82f6" }}>{a.production.name}</span>
                {a.tourStop && <span className="text-xs ml-2" style={{ color: "var(--psg-muted)" }}>@ {a.tourStop.venue.name}</span>}
                {a.notes && <span className="text-xs ml-2 italic" style={{ color: "var(--psg-muted)" }}>{a.notes}</span>}
              </div>
              <div className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }}>
                {new Date(a.startDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → {new Date(a.endDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => { setEditId(a.id); setForm({ userId: String(a.userId), productionId: String(a.production.id), startDate: a.startDate.slice(0, 10), endDate: a.endDate.slice(0, 10), notes: a.notes ?? "" }); setShowForm(true); }}
                  className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                <button onClick={() => deleteAssignment(a.id)} className="text-xs hover:text-red-400 transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-lg font-semibold text-white">{editId ? "Edit Assignment" : "Assign Staff"}</h2>
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
                  {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <label className="text-xs mb-1 block" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <input className={inp} style={inpStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Load in only" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-sm rounded-lg border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              <button onClick={saveAssignment} className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
