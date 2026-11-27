// "Quote vs actual" card (money viewers only): quotes for the build, "Quote this build", price/spend/margin.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { card, h2, muted, link, btnSolid, input, label as lbl } from "@/lib/twsUi";
import { gbp } from "./spaceJobTypes";

export default function QuoteVsActual({ space, jobId, job, f, busy }: {
  space: SpaceTheme; jobId: number; job: JobDetail; f: NonNullable<JobDetail["figures"]>; busy: boolean;
}) {
  const router = useRouter();
  const [markup, setMarkup] = useState("30");
  const [group, setGroup] = useState<"part" | "type">("part");
  async function quoteThisBuild(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/jobs/${jobId}/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markupPct: markup, group }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't start the quote");
    if (d.notes?.length) await alertDialog(`Quote ${d.number} started with ${d.lines} lines. Check: ${d.notes.join("; ")}.`);
    router.push(`/spaces/${space.slug}/quotes/${d.id}`);
  }

  return (
    <section style={card} className="flex flex-col gap-3.5">
      <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Quote vs actual</h2><Link href={`/jobs/${job.id}`} className="text-[13px]" style={link}>Costs in detail →</Link></div>
      {/* Quotes for this build, and "Quote this build" drafted from its parts and materials */}
      <div className="flex flex-wrap items-end gap-3 justify-between p-3" style={{ background: "var(--tws-ground)" }}>
        <div className="text-sm flex flex-col gap-1 min-w-0">
          {job.quotes.length === 0 ? <span style={muted}>No quote yet. Draft one from this build&apos;s parts (labour) and materials, at cost plus your markup.</span>
            : job.quotes.map(q => <Link key={q.id} href={`/spaces/${space.slug}/quotes/${q.id}`} style={link}>Quote {q.number} · {q.status}</Link>)}
        </div>
        <form onSubmit={quoteThisBuild} className="flex items-end gap-2 flex-wrap">
          <div><label htmlFor="qb-group" style={lbl}>Lines</label>
            <select id="qb-group" style={{ ...input, width: "auto" }} value={group} onChange={e => setGroup(e.target.value as "part" | "type")}><option value="part">By part</option><option value="type">Labour / Materials</option></select></div>
          <div><label htmlFor="qb-markup" style={lbl}>Markup %</label>
            <input id="qb-markup" type="number" min={0} max={1000} step="1" style={{ ...input, width: 80 }} value={markup} onChange={e => setMarkup(e.target.value)} /></div>
          <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{job.quotes.length ? "New quote from plan" : "Quote this build"}</button>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><div className="text-xs font-semibold" style={muted}>Price</div><div className="text-2xl font-extrabold tabular-nums">{gbp(f.price)}</div><div className="text-xs" style={muted}>{f.priceFrom === "quote" ? "accepted quote, ex VAT" : f.priceFrom === "agreed" ? "agreed price" : "no accepted quote yet"}{f.variationsApproved > 0 ? ` + ${f.variationsApproved} variation${f.variationsApproved === 1 ? "" : "s"} (${gbp(f.variationsPrice)})` : ""}</div></div>
        <div><div className="text-xs font-semibold" style={muted}>Spent so far</div><div className="text-2xl font-extrabold tabular-nums">{gbp(f.actual)}</div><div className="text-xs" style={muted}>{f.quotedCost != null ? `quoted cost ${gbp(f.quotedCost)}` : `${f.days} day${f.days === 1 ? "" : "s"} + costs`}</div></div>
        <div><div className="text-xs font-semibold" style={muted}>Margin</div><div className="text-2xl font-extrabold tabular-nums" style={{ color: f.margin != null && f.margin < 0 ? "var(--tws-bad-ink)" : "var(--tws-ink)" }}>{gbp(f.margin)}{f.marginPct != null && <span className="text-sm"> · {Math.round(f.marginPct)}%</span>}</div></div>
      </div>
      {(f.materials > 0 || f.committed > 0) && (
        <p className="text-[13px]" style={muted}>Includes {gbp(f.materials)} of materials (delivered POs and stock).{f.committed > 0 && <> <strong style={{ color: "var(--tws-warn-ink)" }}>{gbp(f.committed)} more committed</strong> on open purchase orders.</>}</p>
      )}
      {f.quotedCost != null && f.quotedCost > 0 && (
        <div role="img" aria-label={`${Math.round((f.actual / f.quotedCost) * 100)}% of the quoted cost used`} className="h-2" style={{ background: "var(--tws-tint)" }}>
          <div className="h-2" style={{ width: `${Math.min(100, (f.actual / f.quotedCost) * 100)}%`, background: f.actual > f.quotedCost ? "var(--tws-bad-ink)" : "var(--tws-char)" }} />
        </div>
      )}
    </section>
  );
}
