"use client";

// Every build of a company space: live ones first, with stage, due-out date, days logged and,
// for people who see money, price and margin. Filters for live, complete and cancelled.
import { useState } from "react";
import Link from "next/link";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobFigures } from "@/lib/jobCosting";
import { buildStageLabel, stageIndex, BUILD_STAGES } from "@/lib/buildStages";
import NewBuildJob from "@/components/NewBuildJob";
import { card, muted, pageHeader, stageTone, dayChip } from "@/lib/twsUi";

export type BuildRow = {
  id: number; number: string; title: string; jobType: string; status: string; stage: string | null; endDate: string | null; deliveryMethod: string | null;
  entity: { id: number; name: string } | null; client: { id: number; name: string } | null; forProduction?: { id: number; name: string } | null;
  days: number; figures: JobFigures | null;
};
const gbp = (n: number | null | undefined) => (n == null ? "–" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n));
const FILTERS = [["active", "Live"], ["complete", "Complete"], ["cancelled", "Cancelled"], ["all", "All"]] as const;

export default function BuildJobs({ space, jobs, seeMoney, canEdit }: { space: SpaceTheme; jobs: BuildRow[] | null; seeMoney: boolean; canEdit: boolean }) {
  const base = `/spaces/${space.slug}`;
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("active");
  const today = new Date().toISOString().slice(0, 10);
  const shown = (jobs ?? [])
    .filter(j => filter === "all" || j.status === filter)
    .sort((a, b) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999"));

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-3">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Build jobs</div>
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Build jobs</h1>
            {jobs && <span className="text-sm" style={muted}>{jobs.filter(j => j.status === "active").length} live · {jobs.filter(j => j.status === "complete").length} complete</span>}
          </div>
          {canEdit && <NewBuildJob slug={space.slug} />}
        </div>
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10">
        {!jobs ? <p style={card} className="text-sm">Build jobs are for PSG staff.</p> : (
          <section style={card} className="flex flex-col gap-3 min-w-0">
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
              {FILTERS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="text-xs font-bold px-2.5 py-1.5"
                  style={filter === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>
                  {l} ({k === "all" ? jobs.length : jobs.filter(j => j.status === k).length})
                </button>
              ))}
            </div>
            {shown.length === 0 ? <p className="text-sm" style={muted}>None here.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: seeMoney ? 820 : 640 }}>
                  <thead><tr className="text-xs text-left" style={{ ...muted, borderBottom: "1px solid var(--tws-line-soft)" }}>
                    <th className="py-2 pr-3 font-semibold">Build</th><th className="py-2 pr-3 font-semibold">Client · show</th><th className="py-2 pr-3 font-semibold">Stage</th>
                    <th className="py-2 pr-3 font-semibold">Out</th><th className="py-2 pr-3 font-semibold text-right">Days</th>
                    {seeMoney && <><th className="py-2 pr-3 font-semibold text-right">Price</th><th className="py-2 pr-3 font-semibold text-right">Spent</th><th className="py-2 font-semibold text-right">Margin</th></>}
                  </tr></thead>
                  <tbody>
                    {shown.map(j => {
                      const idx = stageIndex(j.stage);
                      const late = j.status === "active" && j.endDate && j.endDate.slice(0, 10) < today;
                      const f = j.figures;
                      return (
                        <tr key={j.id} style={{ borderBottom: "1px solid var(--tws-line-soft)", opacity: j.status === "cancelled" ? 0.55 : 1 }}>
                          <td className="py-2.5 pr-3"><Link href={`${base}/jobs/${j.id}`} className="font-bold hover:underline" style={{ color: "var(--tws-ink)" }}>{j.title}</Link>
                            <div className="text-xs" style={muted}>{j.number}{j.status !== "active" ? ` · ${j.status === "complete" ? "Complete" : "Cancelled"}` : ""}</div></td>
                          <td className="py-2.5 pr-3 text-[13px]">{[j.client?.name, j.forProduction?.name].filter(Boolean).join(" · ") || <span style={muted}>—</span>}</td>
                          <td className="py-2.5 pr-3">{j.stage ? <span className="text-[11px] font-bold px-2 py-1 whitespace-nowrap" style={stageTone(idx === BUILD_STAGES.length - 1 && j.status === "complete" ? "done" : "now")}>{buildStageLabel(j.stage)}</span> : <span style={muted}>—</span>}</td>
                          <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap" style={{ color: late ? "var(--tws-bad-ink)" : undefined, fontWeight: late ? 700 : 400 }}>
                            {j.endDate ? `${late ? "Overdue · " : ""}${dayChip(j.endDate).toLowerCase()}` : "—"}{j.deliveryMethod === "delivery" ? " · delivery" : ""}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{j.days || "–"}</td>
                          {seeMoney && <>
                            <td className="py-2.5 pr-3 text-right tabular-nums">{gbp(f?.price)}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">{gbp(f?.actual)}</td>
                            <td className="py-2.5 text-right tabular-nums" style={{ color: f?.margin != null && f.margin < 0 ? "var(--tws-bad-ink)" : undefined }}>{gbp(f?.margin)}{f?.marginPct != null && <span className="text-xs" style={muted}> · {Math.round(f.marginPct)}%</span>}</td>
                          </>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
