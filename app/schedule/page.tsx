"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Event = {
  id: number; title: string; type: string; startAt: string; endAt: string;
  location: string | null;
  production: { id: number; name: string };
};

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
  return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => r.json())
      .then(async (prods) => {
        const all: Event[] = [];
        for (const p of prods) {
          const detail = await fetch(`/api/productions/${p.id}`).then((r) => r.json());
          for (const ev of detail.events) {
            all.push({ ...ev, production: { id: p.id, name: p.name } });
          }
        }
        all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        setEvents(all);
      });
  }, []);

  const grouped = events.reduce((acc, ev) => {
    const day = ev.startAt.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(ev);
    return acc;
  }, {} as Record<string, Event[]>);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Schedule</h1>
      {events.length === 0 && (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>
          No events scheduled. Add events from a production page.
        </p>
      )}
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: day === today ? "var(--psg-blue)" : "var(--psg-muted)" }}>
            {day === today ? "Today — " : ""}{fmtDate(day + "T12:00:00")}
          </h2>
          <div className="space-y-2">
            {dayEvents.map((ev) => (
              <div key={ev.id} className="rounded-lg border px-4 py-3 flex items-start gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
