"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TimedEvent = {
  id: number; title: string; type: string; startAt: string; endAt: string;
  location: string | null;
  production: { id: number; name: string };
};

type CalEvent = {
  id: string; type: string; title: string; production: string; productionId: number;
  startDate: string; evening?: boolean; matinee?: boolean; color: string; venue?: string; href: string;
};

type DayItem =
  | { kind: "perf"; event: CalEvent }
  | { kind: "timed"; event: TimedEvent };

const EVENT_COLORS: Record<string, string> = {
  Rehearsal: "bg-blue-900/70 text-blue-300",
  Tech: "bg-purple-900/70 text-purple-300",
  "Dress Rehearsal": "bg-indigo-900/70 text-indigo-300",
  Performance: "bg-green-900/70 text-green-300",
  Meeting: "bg-yellow-900/70 text-yellow-300",
  Workshop: "bg-orange-900/70 text-orange-300",
  Other: "bg-white/10 text-white/60",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const [timedEvents, setTimedEvents] = useState<TimedEvent[]>([]);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/calendar").then(r => r.json()),
      fetch("/api/productions").then(r => r.json()).then(async (prods) => {
        const all: TimedEvent[] = [];
        for (const p of prods) {
          const detail = await fetch(`/api/productions/${p.id}`).then(r => r.json());
          for (const ev of detail.events) {
            all.push({ ...ev, production: { id: p.id, name: p.name } });
          }
        }
        return all;
      }),
    ]).then(([cal, timed]) => {
      setCalEvents((cal as CalEvent[]).filter(e => e.type === "performance"));
      setTimedEvents(timed);
      setLoading(false);
    });
  }, []);

  // Build grouped day map
  const dayMap: Record<string, DayItem[]> = {};
  calEvents.forEach(e => {
    const day = e.startDate.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push({ kind: "perf", event: e });
  });
  timedEvents.forEach(e => {
    const day = e.startAt.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push({ kind: "timed", event: e });
  });

  // Fill in empty days between first and last performance for each production
  const prodPerfDates = new Map<number, string[]>();
  calEvents.forEach(e => {
    const list = prodPerfDates.get(e.productionId) ?? [];
    list.push(e.startDate.slice(0, 10));
    prodPerfDates.set(e.productionId, list);
  });
  prodPerfDates.forEach(dates => {
    if (dates.length < 2) return;
    const sorted = [...dates].sort();
    const cur = new Date(sorted[0]);
    const end = new Date(sorted[sorted.length - 1]);
    cur.setDate(cur.getDate() + 1);
    while (cur < end) {
      const dateStr = cur.toISOString().slice(0, 10);
      if (!dayMap[dateStr]) dayMap[dateStr] = [];
      cur.setDate(cur.getDate() + 1);
    }
  });

  const days = Object.keys(dayMap).sort();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Schedule</h1>
      {loading && <p className="text-sm py-8 text-center" style={{ color: "var(--psg-muted)" }}>Loading…</p>}
      {!loading && days.length === 0 && (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>
          No events scheduled. Add events or a performance schedule from a production page.
        </p>
      )}
      {days.map(day => {
        const items = dayMap[day];
        return (
          <div key={day}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: day === today ? "var(--psg-blue)" : "var(--psg-muted)" }}>
              {day === today ? "Today — " : ""}{fmtDate(day + "T12:00:00")}
            </h2>
            <div className="space-y-2">
              {items.map((item, i) => {
                if (item.kind === "perf") {
                  const ev = item.event;
                  return (
                    <Link key={`perf-${i}`} href={ev.href}
                      className="rounded-lg border px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                      style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", borderLeft: `3px solid ${ev.color}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-white">{ev.production}</span>
                          {ev.evening !== false && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300">Evening</span>}
                          {ev.evening === false && ev.matinee && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#7c3aed33", color: "#c4b5fd" }}>Matinee only</span>}
                          {ev.evening !== false && ev.matinee && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#7c3aed33", color: "#c4b5fd" }}>+ Matinee</span>}
                        </div>
                        {ev.venue && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{ev.venue}</p>}
                      </div>
                    </Link>
                  );
                }
                const ev = item.event;
                return (
                  <div key={`timed-${ev.id}`} className="rounded-lg border px-4 py-3 flex items-start gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                    <div className="text-xs w-20 shrink-0 pt-0.5" style={{ color: "var(--psg-muted)" }}>
                      {fmtTime(ev.startAt)}<br />{fmtTime(ev.endAt)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-white">{ev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${EVENT_COLORS[ev.type] ?? "bg-white/10 text-white/60"}`}>{ev.type}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Link href={`/productions/${ev.production.id}`} className="text-xs hover:underline" style={{ color: "var(--psg-blue)" }}>{ev.production.name}</Link>
                        {ev.location && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>· {ev.location}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
