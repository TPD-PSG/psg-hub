// A company space's home (TWS mockup "TWS home – desktop"): a welcome band with the logo, what
// needs attention, live builds by stage, collections and deliveries due, this week's build
// schedule, the team and news from PSG. No money here.
import Link from "next/link";
import type { SpaceTheme } from "@/lib/spaces";
import { BUILD_STAGES, buildStageLabel, stageIndex, usesBuildStages } from "@/lib/buildStages";
import { jobTypeLabel } from "@/lib/quotes";
import { caps, card, darkCard, h2, muted, link, btnSolid, btnLine, pageHeader, dayChip } from "@/lib/twsUi";
import BuildOfMonth from "@/components/BuildOfMonth";
import NewBuildJob from "@/components/NewBuildJob";
import type { BoardData } from "./noticeboard/Noticeboard";

type Job = {
  id: number; number: string; title: string; jobType: string; startDate: string | null; endDate: string | null;
  client: { id: number; name: string } | null; production: { id: number; name: string } | null; _count: { time: number };
  stage: string | null; stageChangedAt: string | null; deliveryMethod: string | null; deliveryNotes?: string | null;
  forProduction: { id: number; name: string } | null;
};
type Part = { id: number; jobId: number; label: string; userId: number | null; startDate: string | null; days: number; done: boolean };
export type SpaceData = {
  space: SpaceTheme; jobs: Job[]; parts?: Part[]; dueOut: Job[]; overdue: Job[]; canEdit?: boolean;
  stock?: { id: number; name: string; quantity: number; unit: string; reorderLevel: number | null }[]; awaitingApproval?: number;
  schedule: { date: string; kind: string; jobId: number; title: string }[];
  team: { id: number; name: string; avatarUrl: string | null; role: string }[];
  news: string | null;
};

const DAY = 86400e3;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`).getTime();

export default function SpaceHome({ data, firstName, board }: { data: SpaceData; firstName: string; board?: BoardData | null }) {
  const { space, jobs, dueOut, overdue, team, news } = data;
  const parts = data.parts ?? [];
  const base = `/spaces/${space.slug}`;
  const now = new Date();
  const hour = Number(now.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const todayStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
  const today = utcDay(ymd(now));
  const builds = jobs.filter(usesBuildStages);

  // Things that need someone
  const soonBehind = builds.filter(j => j.endDate && utcDay(j.endDate) >= today && utcDay(j.endDate) <= today + 7 * DAY && stageIndex(j.stage) < stageIndex("finish"));
  const toPlan = parts.filter(p => !p.done && (!p.userId || !p.startDate));
  const stock = data.stock ?? [];
  const low = stock.filter(s => s.reorderLevel != null && s.quantity <= s.reorderLevel);
  const attention = [
    ...overdue.map(j => ({ key: `o${j.id}`, href: `${base}/jobs/${j.id}`, text: `${j.title} is past its due-out date` })),
    ...soonBehind.map(j => ({ key: `s${j.id}`, href: `${base}/jobs/${j.id}`, text: `${j.title} goes out ${dayChip(j.endDate!).toLowerCase()} and is at ${buildStageLabel(j.stage)}` })),
    ...(low.length ? [{ key: "low", href: `${base}/materials`, text: `${low.slice(0, 3).map(s => s.name).join(", ")}${low.length > 3 ? ` and ${low.length - 3} more` : ""} below reorder level` }] : []),
    ...(data.awaitingApproval ? [{ key: "po", href: `${base}/materials`, text: `${data.awaitingApproval} purchase order${data.awaitingApproval === 1 ? "" : "s"} waiting for approval` }] : []),
    ...(toPlan.length ? [{ key: "plan", href: `${base}/planner`, text: `${toPlan.length} part${toPlan.length === 1 ? "" : "s"} still to plan` }] : []),
  ];

  // This week, Monday to Sunday
  const mon = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
  const week = Array.from({ length: 7 }, (_, i) => mon + i * DAY);
  const weekRows = builds.map(j => {
    const start = j.startDate ? utcDay(j.startDate) : null, end = j.endDate ? utcDay(j.endDate) : null;
    const jp = parts.filter(p => p.jobId === j.id && p.startDate);
    const partOn = (d: number) => jp.some(p => utcDay(p.startDate!) <= d && d < utcDay(p.startDate!) + p.days * DAY);
    const cells = week.map(d => (end === d ? "out" : partOn(d) || (start !== null && start <= d && (end === null ? false : d < end)) ? "on" : ""));
    const crew = new Set(jp.filter(p => p.userId && utcDay(p.startDate!) < mon + 7 * DAY && utcDay(p.startDate!) + p.days * DAY > mon).map(p => p.userId)).size;
    return { j, cells, crew };
  }).filter(r => r.cells.some(Boolean));
  // merge runs of the same kind into spans
  const runs = (cells: string[]) => cells.reduce<{ kind: string; span: number }[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && last.kind === c && c !== "out") last.span++; else acc.push({ kind: c, span: 1 });
    return acc;
  }, []);

  const collections = [...overdue, ...dueOut].filter((j, i, a) => a.findIndex(x => x.id === j.id) === i);

  return (
    <>
      {/* Welcome band */}
      <header style={pageHeader} className="px-4 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6 flex-wrap min-w-0">
          {space.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version
            <img src={space.logoUrl} alt={`${space.name} logo`} className="h-20 w-auto max-w-[200px] object-contain" />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <span style={{ ...caps, fontSize: 12, letterSpacing: "0.3em" }}>{space.name}</span>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{greeting}, {firstName}</h1>
            <span className="text-sm" style={muted}>{todayStr} · {builds.length} live build{builds.length === 1 ? "" : "s"} · {dueOut.length} going out in the next four weeks</span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {data.canEdit && <NewBuildJob slug={space.slug} />}
          <Link href={`${base}/board`} style={data.canEdit ? btnLine : btnSolid}>Build board</Link>
          <Link href={`${base}/planner`} style={btnLine}>Open planner</Link>
        </div>
      </header>

      {attention.length > 0 && (
        <div role="status" className="mx-4 sm:mx-10 mt-6 px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)" }}>
          <strong style={{ color: "var(--tws-warn-ink)" }}>{attention.length} thing{attention.length === 1 ? " needs" : "s need"} you</strong>
          {attention.map(a => <Link key={a.key} href={a.href} style={{ color: "var(--tws-ink)" }} className="underline-offset-2 hover:underline">{a.text}</Link>)}
        </div>
      )}

      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-3">
        {/* Live builds */}
        <section style={card} className="lg:col-span-2 flex flex-col gap-4 min-w-0">
          <div className="flex justify-between items-baseline gap-3"><h2 style={h2}>Live jobs</h2><Link href={`${base}/board`} className="text-[13px]" style={link}>Build board →</Link></div>
          {jobs.length === 0 ? <p className="text-sm" style={muted}>No live jobs. Won deals for {space.shortName ?? space.name} open their jobs here.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map(j => {
                const idx = stageIndex(j.stage);
                const late = j.endDate && utcDay(j.endDate) < today;
                return (
                  <article key={j.id} className="flex flex-col gap-2 p-4 min-w-0" style={{ background: "var(--tws-ground)", borderTop: `6px solid ${idx >= 3 ? "var(--tws-accent)" : idx >= 0 ? "#a9aeb4" : "var(--tws-tint)"}` }}>
                    <span style={{ ...caps, fontSize: 11, letterSpacing: "0.2em", color: idx >= 3 ? "var(--tws-accent-ink)" : "#4e545b" }}>{j.stage ? `In ${buildStageLabel(j.stage)}` : jobTypeLabel(j.jobType)}</span>
                    <Link href={`${base}/jobs/${j.id}`} className="text-[15px] font-bold break-words hover:underline" style={{ color: "var(--tws-ink)" }}>{j.title} →</Link>
                    <span className="text-[13px]" style={muted}>{[j.client?.name && `Client: ${j.client.name}`, j.forProduction?.name ?? j.production?.name].filter(Boolean).join(" · ") || j.number}</span>
                    {idx >= 0 && (
                      <div role="img" aria-label={`Stage ${idx + 1} of ${BUILD_STAGES.length}`} className="h-2" style={{ background: "var(--tws-line)" }}>
                        <div className="h-2" style={{ width: `${((idx + 1) / BUILD_STAGES.length) * 100}%`, background: "var(--tws-char)" }} />
                      </div>
                    )}
                    <span className="text-xs" style={{ color: late ? "var(--tws-bad-ink)" : "var(--tws-muted)", fontWeight: late ? 700 : 400 }}>
                      {j.endDate ? `${late ? "Overdue · was due " : "Out "}${dayChip(j.endDate).toLowerCase()}` : "No due-out date"}
                      {j.deliveryMethod ? ` · ${j.deliveryMethod === "delivery" ? "we deliver" : "client collects"}` : ""}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Collections and deliveries */}
        <section style={darkCard} className="flex flex-col gap-3.5">
          <h2 style={{ ...h2, color: "#fff" }}>Collections due</h2>
          {collections.length === 0 ? <p className="text-sm" style={{ color: "var(--tws-night-muted)" }}>Nothing going out in the next four weeks.</p> : collections.slice(0, 6).map(j => {
            const late = utcDay(j.endDate!) < today;
            return (
              <div key={j.id} className="flex gap-3 items-start">
                <span className="text-[13px] font-extrabold px-2 py-1.5 text-center shrink-0 min-w-[58px]" style={{ background: late ? "var(--tws-bad-bg)" : "var(--tws-accent)", color: late ? "var(--tws-bad-ink)" : "var(--tws-ink)" }}>{dayChip(j.endDate!)}</span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <Link href={`${base}/jobs/${j.id}`} className="text-sm font-bold text-white hover:underline break-words">{j.title}</Link>
                  <span className="text-xs" style={{ color: "var(--tws-night-muted)" }}>
                    {[late ? "Overdue" : null, j.deliveryMethod === "delivery" ? "We deliver" : j.deliveryMethod === "collection" ? "Client collects" : "Collection or delivery not set", j.forProduction?.name].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            );
          })}
          <Link href={`${base}/board`} className="text-[13px] font-semibold mt-auto" style={{ color: "var(--tws-accent-light)" }}>All builds →</Link>
        </section>

        {/* This week */}
        <section style={card} className={`${data.canEdit ? "lg:col-span-2" : "lg:col-span-3"} flex flex-col gap-3 min-w-0`}>
          <div className="flex justify-between items-baseline gap-3"><h2 style={h2}>Build schedule · this week</h2><Link href={`${base}/planner`} className="text-[13px]" style={link}>Open planner →</Link></div>
          {weekRows.length === 0 ? <p className="text-sm" style={muted}>Nothing scheduled this week. Give builds a start and due-out date, or plan their parts in the planner.</p> : (
            <div className="overflow-x-auto">
              <div className="grid gap-1.5 text-xs" style={{ gridTemplateColumns: "150px repeat(7, minmax(64px, 1fr))", minWidth: 620 }}>
                <span />
                {week.map(d => {
                  const isToday = d === today, wkend = new Date(d).getUTCDay() % 6 === 0;
                  return <strong key={d} className="text-center py-1" style={isToday ? { background: "var(--tws-char)", color: "#fff" } : wkend ? { background: "var(--tws-tint-2)" } : undefined}>{new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}</strong>;
                })}
                {weekRows.map(({ j, cells, crew }) => (
                  <div key={j.id} className="contents">
                    <Link href={`${base}/jobs/${j.id}`} className="py-1.5 truncate hover:underline" style={{ color: "var(--tws-ink)" }} title={j.title}>{j.title}</Link>
                    {runs(cells).map((r, i) => (
                      <span key={i} className="px-2 py-1.5 font-semibold truncate" style={{
                        gridColumn: `span ${r.span}`,
                        ...(r.kind === "on" ? { background: "var(--tws-accent)" } : r.kind === "out" ? { background: "var(--tws-char)", color: "#fff" } : { background: "transparent" }),
                      }}>
                        {r.kind === "on" && i === runs(cells).findIndex(x => x.kind === "on") ? `${buildStageLabel(j.stage)}${crew ? ` · ${crew} crew` : ""}` : r.kind === "out" ? (j.deliveryMethod === "delivery" ? "Delivery" : "Out") : ""}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Materials & kit (low first) */}
        {data.canEdit && (
          <section style={card} className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline gap-3"><h2 style={h2}>Materials &amp; kit</h2><Link href={`${base}/materials`} className="text-[13px]" style={link}>All →</Link></div>
            {stock.length === 0 ? <p className="text-sm" style={muted}>No stock items yet. <Link href={`${base}/materials`} style={link}>Add what the workshop keeps</Link>.</p> : (
              [...low, ...stock.filter(s => !low.includes(s))].slice(0, 5).map(s => (
                <div key={s.id} className="flex justify-between gap-3 text-sm pb-2" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                  <span className="min-w-0 truncate">{s.name}</span>
                  {low.includes(s) ? <strong className="shrink-0" style={{ color: "var(--tws-bad-ink)" }}>Low · reorder</strong> : <span className="shrink-0" style={muted}>{Number.isInteger(s.quantity) ? s.quantity : s.quantity.toFixed(1)} {s.unit}</span>}
                </div>
              ))
            )}
          </section>
        )}

        {/* Noticeboard and build of the month */}
        {board && (
          <>
            <section style={card} className="lg:col-span-2 flex flex-col gap-3 min-w-0">
              <div className="flex justify-between items-baseline gap-3"><h2 style={h2}>Workshop noticeboard</h2><Link href={`${base}/noticeboard`} className="text-[13px]" style={link}>Post a photo →</Link></div>
              {board.posts.length === 0 ? <p className="text-sm" style={muted}>Nothing posted yet. Share build photos, finished sets and workshop notices.</p> : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {board.posts.slice(0, 3).map(p => p.photos[0] ? (
                    <Link key={p.id} href={`${base}/noticeboard`} className="flex flex-col gap-1.5 min-w-0" style={{ color: "var(--tws-ink)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                      <img src={p.photos[0].url} alt={p.title ?? "Build photo"} loading="lazy" className="w-full h-[110px] object-cover" style={{ background: "var(--tws-tint)" }} />
                      <span className="text-xs truncate">{p.kind === "showcase" ? "Showcase: " : ""}{p.title ?? p.job?.title ?? "Photo"}</span>
                    </Link>
                  ) : (
                    <Link key={p.id} href={`${base}/noticeboard`} className="flex flex-col gap-1.5 p-3 text-[13px] min-w-0" style={{ background: "var(--tws-ground)", color: "var(--tws-ink)" }}>
                      <strong>{p.pinned ? "📌 " : ""}{p.title ?? "Notice"}</strong>
                      {p.body && <span className="line-clamp-4" style={muted}>{p.body}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <BuildOfMonth slug={space.slug} initial={board.botm} compact canOpenBuilds={board.me.staff} />
          </>
        )}

        {/* Team */}
        <section style={card} className="flex flex-col gap-3 lg:col-span-3">
          <h2 style={h2}>Team <span className="font-medium text-sm" style={muted}>({team.length})</span></h2>
          {team.length === 0 ? <p className="text-sm" style={muted}>Nobody has {space.name} as their company yet (set it in Admin → Users).</p> : (
            <ul className="flex flex-wrap gap-2">
              {team.map(t => <li key={t.id} className="text-sm px-3 py-1" style={{ background: "var(--tws-ground)", border: "1px solid var(--tws-line-soft)" }}>{t.name}</li>)}
            </ul>
          )}
        </section>
      </div>

      {/* From PSG */}
      <footer className="mt-auto px-4 sm:px-10 py-3.5 flex flex-wrap gap-x-6 gap-y-2 text-[13px]" style={{ background: "var(--tws-card)", borderTop: "1px solid var(--tws-line)", color: "#4a5480" }}>
        <strong style={{ color: "#000c3b" }}>From PSG</strong>
        {news && <span className="whitespace-pre-wrap min-w-0">{news}</span>}
        <Link href="/?all=1" style={{ color: "#001b7f" }}>PSG Hub home →</Link>
      </footer>
    </>
  );
}
