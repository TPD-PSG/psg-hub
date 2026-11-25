// A company space's home page: its live jobs, build schedule, what's due out, its team, and the
// things that stay shared with the rest of PSG (news, tasks, help desk, Fun Corner).
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { jobTypeLabel } from "@/lib/quotes";
import { textOn, type SpaceTheme } from "@/lib/spaces";
import StageChip from "@/components/StageChip";

type Job = {
  id: number; number: string; title: string; jobType: string; startDate: string | null; endDate: string | null;
  client: { id: number; name: string } | null; production: { id: number; name: string } | null; _count: { time: number };
  stage: string | null; stageChangedAt: string | null; deliveryMethod: string | null; forProduction: { id: number; name: string } | null;
};
export type SpaceData = {
  space: SpaceTheme; jobs: Job[]; dueOut: Job[]; overdue: Job[];
  schedule: { date: string; kind: string; jobId: number; title: string }[];
  team: { id: number; name: string; avatarUrl: string | null; role: string }[];
  news: string | null;
};

const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const day = (s: string) => new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

export default function SpaceHome({ data }: { data: SpaceData }) {
  const { space, jobs, schedule, dueOut, overdue, team, news } = data;
  const accent = space.color ?? "#2a5de0";
  const ink = textOn(space.color);
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Banner in the company's colours */}
      <div className="rounded-xl px-5 py-5 flex items-center gap-4 flex-wrap" style={{ backgroundColor: accent, color: ink }}>
        {space.logoUrl && (
          <div className="bg-white rounded-lg p-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
            <img src={space.logoUrl} alt={`${space.name} logo`} className="h-12 w-auto max-w-[160px] object-contain" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{space.name}</h1>
          <p className="text-sm opacity-80">{jobs.length} live job{jobs.length === 1 ? "" : "s"} · {dueOut.length} due out in the next four weeks</p>
        </div>
      </div>

      {news && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={card}>
          <span className="text-xs uppercase tracking-wider mr-2" style={{ color: "var(--psg-muted)" }}>PSG news</span>
          <span className="text-white whitespace-pre-wrap">{news}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Live jobs */}
        <section className="rounded-lg border lg:col-span-2" style={card}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-sm font-semibold text-white">Live jobs</h2>
            <span className="flex gap-3">
              <Link href={`/spaces/${space.slug}/board`} className="text-xs text-blue-300">Build board →</Link>
              <Link href="/jobs" className="text-xs" style={{ color: "var(--psg-muted)" }}>All jobs →</Link>
            </span>
          </div>
          {jobs.length === 0 ? <p className="px-4 py-5 text-sm" style={{ color: "var(--psg-muted)" }}>No live jobs. Won deals for {space.shortName ?? space.name} open their jobs here.</p> : (
            <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {jobs.map(j => {
                const late = j.endDate && new Date(j.endDate) < new Date(new Date().toDateString());
                return (
                  <li key={j.id} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                    <div className="min-w-0">
                      <Link href={`/jobs/${j.id}`} className="text-sm text-white hover:underline">{j.title}</Link> <StageChip stage={j.stage} />
                      <div className="text-xs" style={{ color: "var(--psg-muted)" }}>
                        {[j.number, jobTypeLabel(j.jobType), j.client?.name, j.forProduction?.name ?? j.production?.name].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="text-xs text-right shrink-0" style={{ color: late ? "#f87171" : "var(--psg-muted)" }}>
                      {j.endDate ? `${late ? "Overdue · " : "Out "}${fmtDate(j.endDate)}` : "No date yet"}
                      {j.deliveryMethod && <div>{j.deliveryMethod === "delivery" ? "🚚 Delivery" : "Collection"}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Schedule */}
        <section className="rounded-lg border" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Next four weeks</h2>
          {overdue.length > 0 && (
            <p className="px-4 pt-3 text-xs" style={{ color: "#f87171" }}>⚠ {overdue.length} job{overdue.length === 1 ? " is" : "s are"} past {overdue.length === 1 ? "its" : "their"} due date</p>
          )}
          {schedule.length === 0 ? <p className="px-4 py-5 text-sm" style={{ color: "var(--psg-muted)" }}>Nothing starting or due out.</p> : (
            <ul className="px-4 py-3 space-y-2">
              {schedule.map((s, i) => (
                <li key={i} className="text-sm">
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{day(s.date)} · <span style={{ color: s.kind === "Due out" ? accent : undefined }}>{s.kind}</span></div>
                  <Link href={`/jobs/${s.jobId}`} className="text-white hover:underline">{s.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Team */}
        <section className="rounded-lg border lg:col-span-2" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Team ({team.length})</h2>
          {team.length === 0 ? <p className="px-4 py-5 text-sm" style={{ color: "var(--psg-muted)" }}>Nobody has {space.name} as their company yet (set it in Admin → Users).</p> : (
            <ul className="px-4 py-3 flex flex-wrap gap-2">
              {team.map(t => (
                <li key={t.id} className="text-sm text-white rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>{t.name}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Shared with PSG */}
        <section className="rounded-lg border" style={card}>
          <h2 className="px-4 py-3 border-b text-sm font-semibold text-white" style={{ borderColor: "var(--psg-card-border)" }}>Shared with PSG</h2>
          <ul className="px-4 py-3 space-y-1.5 text-sm">
            {[["/tasks", "My tasks"], ["/calendar", "Calendar"], ["/helpdesk", "Help desk"], ["/fun", "Fun Corner"], ["/?all=1", "PSG Hub home"]].map(([href, label]) => (
              <li key={href}><Link href={href} className="text-blue-300 hover:underline">{label}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
