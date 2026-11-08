"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string;
  type: "key_date" | "task";
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
  // 0=Sun…6=Sat → convert to Mon-first (0=Mon…6=Sun)
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
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list">("month");

  useEffect(() => {
    fetch("/api/calendar").then(r => r.json()).then(d => { if (Array.isArray(d)) setEvents(d); });
  }, []);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Build a map: dateStr → events on that day
  const eventsByDate: Record<string, CalEvent[]> = {};
  events.forEach(ev => {
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

  // For list view: events in this month sorted by startDate
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthEvents = events
    .filter(ev => {
      const s = ev.startDate.slice(0, 10);
      const e = (ev.endDate ?? ev.startDate).slice(0, 10);
      return s <= monthEnd && e >= monthStart;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Unique productions in view for legend
  const productions = Array.from(
    new Map(events.filter(e => e.production && e.type === "key_date").map(e => [e.productionId, { name: e.production!, color: e.color }])).values()
  );

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <div className="flex-1" />
        {/* View toggle */}
        <div className="flex gap-1 rounded-lg overflow-hidden border text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["month", "list"] as const).map(v => (
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

      {/* Legend */}
      {productions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {productions.map(p => (
            <div key={p.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--psg-muted)" }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--psg-muted)" }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-gray-500" />
            Tasks
          </div>
        </div>
      )}

      {view === "month" ? (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
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
                <div
                  key={day}
                  onClick={() => setSelected(isSelected ? null : dateStr)}
                  className={`min-h-[80px] border-b p-1 cursor-pointer transition-colors ${!isLastCol ? "border-r" : ""} ${isSelected ? "bg-white/10" : "hover:bg-white/5"}`}
                  style={{ borderColor: "var(--psg-card-border)" }}
                >
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
                          {isStart ? (ev.type === "task" ? "● " : "") + ev.title : ""}
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
      ) : (
        /* List view */
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
      )}

      {/* Selected day panel */}
      {selected && selectedEvents.length > 0 && (
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
