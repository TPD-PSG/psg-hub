"use client";

// A production's Overview (new look, build brief stage 5): the default section when a production
// opens in the new look. Four tiles (now, next, budget, show reports), this week, advancing for the
// next venue, and small panels (crew on this week, open tasks, latest show report), each linking to
// its section. Built from the shared components; sections hidden for the person are left out.
import { useEffect, useState } from "react";
import { Chip, EmptyState, ListRow, Panel, StatTile } from "@/components/nl";

type Overview = {
  now: { venue: string | null; stop: number | null; of: number | null } | null;
  next: { venue: string; getIn: string; stop: number } | null;
  budget: { total: number; net: number; pctSpent: number | null; overspends: number } | null;
  reports: { count: number; faults: number; absences: number } | null;
  week: { at: string; title: string; line: string | null; kind: string }[] | null;
  advancing: { venue: string | null; status: string | null } | null;
  crew: { name: string; role: string }[] | null;
  tasks: { open: number; top: { id: number; title: string; due: string | null; who: string | null }[] } | null;
  latestReport: { id: number; at: string; performance: string | null; venue: string | null; flags: number } | null;
};

const ADVANCING = [
  { key: "triage", label: "Triage" }, { key: "rider_released", label: "Rider released" }, { key: "contra_in", label: "Contra estimate in" },
  { key: "plans_drawn", label: "Plans drawn" }, { key: "email_released", label: "Full email released" }, { key: "in_venue", label: "In venue" }, { key: "closed", label: "Closed / pre contra" },
];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export default function OverviewTab({ prodId, color, isTour }: { prodId: number; color: string | null; isTour: boolean }) {
  const [o, setO] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/productions/${prodId}/overview`).then(r => (r.ok ? r.json() : Promise.reject())).then(d => { if (live) setO(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [prodId]);
  const sec = (s: string) => `/productions/${prodId}?section=${s}`;
  if (failed) return <p className="text-sm" style={{ color: "var(--nl-text-muted)" }}>The overview couldn&apos;t load. Open a section from the menu.</p>;
  if (!o) return <p className="text-sm" style={{ color: "var(--nl-text-muted)" }}>Loading the overview…</p>;
  const advIdx = o.advancing ? Math.max(0, ADVANCING.findIndex(a => a.key === o.advancing!.status)) : 0;

  return (
    <div className="nl-page flex flex-col gap-4">
      {/* Four tiles */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Now" value={o.now?.venue ?? "Not on"} line={o.now?.stop ? `Stop ${o.now.stop} of ${o.now.of}` : isTour ? "Between stops" : "The show's venue"} href={isTour ? sec("tour") : undefined} />
        <StatTile label="Next" value={o.next ? o.next.venue : "—"} line={o.next ? `Get-in ${day(o.next.getIn)}` : isTour ? "No more stops" : "Not a tour"} href={isTour ? sec("tour") : undefined} />
        {o.budget
          ? <StatTile label="Budget" value={gbp(o.budget.total)} line={`${o.budget.pctSpent ?? 0}% spent${o.budget.overspends ? ` · ${o.budget.overspends} over` : ""}`} href={sec("budget")} tone={o.budget.overspends ? "bad" : undefined} />
          : <StatTile label="Budget" value="—" line="Not in your sections" />}
        {o.reports
          ? <StatTile label="Show reports" value={o.reports.count} line={o.reports.count ? `This week · ${o.reports.faults} fault${o.reports.faults === 1 ? "" : "s"} · ${o.reports.absences} absence${o.reports.absences === 1 ? "" : "s"}` : "None this week"} href={sec("reports")} />
          : <StatTile label="Show reports" value="—" line="Not in your sections" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {o.week && (
          <div className="lg:col-span-3 min-w-0">
            <Panel title="This week" more={{ href: sec("schedule"), label: "Schedule" }} pad={o.week.length === 0}>
              {o.week.length === 0 ? <EmptyState title="Nothing scheduled this week" line="Schedule events and tour stops for the next seven days show here." /> :
                o.week.map((w, i) => <ListRow key={i} dot={w.kind === "stop" ? (color ?? "var(--nl-accent)") : "var(--nl-border)"} title={w.title} line={[`${day(w.at)}${w.kind === "event" ? ` ${time(w.at)}` : ""}`, w.line].filter(Boolean).join(" · ")} />)}
            </Panel>
          </div>
        )}
        {o.advancing && (
          <div className="lg:col-span-2 min-w-0">
            <Panel title={isTour ? "Advancing: next venue" : "Advancing"} more={{ href: sec("advancing"), label: "Advancing" }} pad={o.advancing.status !== null}>
              {o.advancing.status === null ? <EmptyState title="No next venue to advance" line="Add tour stops and the next one's advancing shows here." /> : <>
              <p className="m-0 mb-3 font-semibold">{o.advancing.venue ?? "No venue yet"}</p>
              <ol className="m-0 p-0 list-none flex flex-col gap-1.5" aria-label="Advancing progress">
                {ADVANCING.map((a, i) => (
                  <li key={a.key} className="flex items-center gap-2.5 text-sm">
                    <span aria-hidden="true" style={{ width: 10, height: 10, background: i <= advIdx ? (color ?? "var(--nl-accent)") : "transparent", border: `2px solid ${i <= advIdx ? (color ?? "var(--nl-accent)") : "var(--nl-border)"}` }} />
                    <span style={{ color: i <= advIdx ? "var(--nl-text)" : "var(--nl-text-muted)", fontWeight: i === advIdx ? 700 : 500 }}>{a.label}</span>
                    {i === advIdx && <span className="ml-auto"><Chip>Now</Chip></span>}
                  </li>
                ))}
              </ol>
              </>}
            </Panel>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {o.crew && (
          <Panel title="Crew on this week" more={{ href: sec("crew"), label: "Crew" }} pad={o.crew.length === 0}>
            {o.crew.length === 0 ? <EmptyState title="No crew booked this week" /> : o.crew.slice(0, 6).map((c, i) => <ListRow key={i} title={c.name} line={c.role} />)}
            {o.crew.length > 6 && <p className="m-0 px-4 py-2 text-xs" style={{ color: "var(--nl-text-muted)" }}>and {o.crew.length - 6} more</p>}
          </Panel>
        )}
        {o.tasks && (
          <Panel title={`Open tasks · ${o.tasks.open}`} more={{ href: sec("tasks"), label: "Tasks" }} pad={o.tasks.open === 0}>
            {o.tasks.open === 0 ? <EmptyState title="No open tasks" line="Tasks for this show, and actions from its meetings, land here." /> :
              o.tasks.top.map(t => <ListRow key={t.id} href={`/tasks?highlight=${t.id}`} title={t.title} line={[t.who, t.due ? `Due ${day(t.due)}` : null].filter(Boolean).join(" · ")} />)}
          </Panel>
        )}
        {o.latestReport !== undefined && (
          <Panel title="Latest show report" more={{ href: sec("reports"), label: "Show reports" }} pad={!o.latestReport}>
            {!o.latestReport ? <EmptyState title="No show reports yet" line="Reports emailed in after each show appear here." /> :
              <ListRow href={sec("reports")} title={day(o.latestReport.at)} line={[o.latestReport.performance, o.latestReport.venue].filter(Boolean).join(" · ")} chip={o.latestReport.flags ? <Chip tone="warn">{o.latestReport.flags} flagged</Chip> : <Chip tone="good">Clean</Chip>} />}
          </Panel>
        )}
      </div>
    </div>
  );
}
