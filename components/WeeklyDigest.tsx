"use client";

// A show's weekly show-report digest (28 Nov 2026), at the top of its Reports tab: the week's
// performances, house, running times, which departments flagged problems, incident and absence
// counts (no detail), and repeat faults by cue or kit, each linking to its reports.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Digest } from "@/lib/showDigestCore";

type D = Digest & { week: string };
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const DAY = 86400e3;
const range = (week: string) => {
  const a = new Date(`${week}T00:00:00Z`), b = new Date(a.getTime() + 6 * DAY);
  const f = (d: Date, m = true) => d.toLocaleDateString("en-GB", { day: "numeric", ...(m ? { month: "short" } : {}), timeZone: "UTC" });
  return `${f(a, a.getUTCMonth() !== b.getUTCMonth())} – ${f(b)}`;
};

export default function WeeklyDigest({ productionId, onOpenReport }: { productionId: number; onOpenReport: (id: number) => void }) {
  const params = useSearchParams();
  const [, setWeek] = useState<string | null>(params.get("digest"));
  const [d, setD] = useState<D | null>(null);
  const [open, setOpen] = useState(!!params.get("digest"));
  const load = useCallback(async (w: string | null) => {
    const r = await fetch(`/api/productions/${productionId}/digest${w ? `?week=${w}` : ""}`).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) { setD(r); setWeek(r.week); }
  }, [productionId]);
  // First load: the week from the link (?digest=) or this week
  const firstWeek = params.get("digest");
  useEffect(() => {
    let gone = false;
    fetch(`/api/productions/${productionId}/digest${firstWeek ? `?week=${firstWeek}` : ""}`).then(x => (x.ok ? x.json() : null))
      .then(r => { if (!gone && r) { setD(r); setWeek(r.week); } }).catch(() => {});
    return () => { gone = true; };
  }, [productionId, firstWeek]);
  const step = (n: number) => d && load(new Date(new Date(`${d.week}T00:00:00Z`).getTime() + n * 7 * DAY).toISOString().slice(0, 10));
  if (!d) return null;
  const pill = "text-xs px-2 py-0.5 rounded";

  return (
    <div className="rounded-xl border" style={card}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-semibold text-white mr-auto text-left">
          {open ? "▾" : "▸"} Weekly digest · {range(d.week)}
          <span className="block sm:inline sm:ml-2 text-xs font-normal" style={{ color: "var(--psg-muted)" }}>
            {d.performances ? `${d.performances} performance${d.performances === 1 ? "" : "s"}${d.repeats.length ? ` · ${d.repeats.length} repeat fault${d.repeats.length === 1 ? "" : "s"}` : ""}` : "no reports this week"}
          </span>
        </button>
        <button type="button" onClick={() => step(-1)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }} aria-label="Previous week">← Week</button>
        <button type="button" onClick={() => step(1)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }} aria-label="Next week">Week →</button>
      </div>
      {open && (
        <div className="border-t px-4 py-3 space-y-3 text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
          {d.performances === 0 ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No show reports for this week.</p> : <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {[
                ["Performances", String(d.performances)],
                ["Average house", d.avgHousePct != null ? `${d.avgHousePct}%` : "—"],
                ["Running time", d.runningMin ? (d.runningMin === d.runningMax ? d.runningMin : `${d.runningMin}–${d.runningMax}`) : "—"],
                ["Incidents · absences", `${d.incidents} · ${d.absences}`],
              ].map(([l, v]) => <div key={l}><div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{l}</div><div className="text-lg font-semibold text-white tabular-nums">{v}</div></div>)}
            </div>
            {(d.incidents > 0 || d.absences > 0) && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Incidents logged at {d.incidentShows} performance{d.incidentShows === 1 ? "" : "s"}; absences at {d.absenceShows}. Counts only: open the reports for detail.</p>}
            {d.repeats.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: "#fbbf24" }}>Repeat faults (same cue or kit at two or more shows)</div>
                <ul className="space-y-2">
                  {d.repeats.map(r => (
                    <li key={r.key} className="text-xs">
                      <span className={`${pill} font-semibold mr-2`} style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>{r.key} × {r.count}</span>
                      <span style={{ color: "var(--psg-muted)" }}>{r.kind === "cue" ? "cue" : "kit"}</span>
                      <ul className="mt-1 ml-3 space-y-0.5">
                        {r.reports.map(x => <li key={x.id}><button type="button" onClick={() => onOpenReport(x.id)} className="text-blue-300 hover:underline">{x.label}</button><span style={{ color: "var(--psg-muted)" }}>: {x.text}</span></li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.flagged.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs mr-1" style={{ color: "var(--psg-muted)" }}>Flagged:</span>
                {d.flagged.map(f => <span key={f.section} className={pill} style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#fca5a5" }}>{f.section} × {f.count}</span>)}
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span style={{ color: "var(--psg-muted)" }}>Reports:</span>
              {d.reports.map(r => <button key={r.id} type="button" onClick={() => onOpenReport(r.id)} className="text-blue-300 hover:underline">{r.label}{r.flags.length ? " ⚑" : ""}</button>)}
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
