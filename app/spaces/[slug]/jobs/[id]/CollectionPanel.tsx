// Dark "Collection / Delivery" card: due-out summary, ready-to-collect checks, collection pack PDF and the edit form.
import { useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import BuildChecklist, { type Check } from "@/components/BuildChecklist";
import { fmtDate } from "@/lib/format";
import { darkCard, h2, btnSolid, input, label as lbl } from "@/lib/twsUi";
import { ymd, today, type Call, type Option, type PartRow } from "./spaceJobTypes";

export default function CollectionPanel({ space, job, setJob, parts, productions, checks, setChecks, busy, call }: {
  space: SpaceTheme; job: JobDetail; setJob: (j: JobDetail) => void; parts: PartRow[]; productions: Option[]; checks: Check[]; setChecks: (cs: Check[]) => void;
  busy: boolean; call: Call;
}) {
  const collect = checks.filter(c => c.kind === "collect");
  const [editOut, setEditOut] = useState(false);
  const [out, setOut] = useState({ startDate: ymd(job.startDate), dueOut: ymd(job.endDate), deliveryMethod: job.deliveryMethod ?? "", deliveryNotes: job.deliveryNotes ?? "", forProductionId: job.forProduction ? String(job.forProduction.id) : "" });
  async function saveOut(e: React.FormEvent) {
    e.preventDefault();
    const d = await call(`/api/jobs/${job.id}/build`, "PATCH", { ...out, deliveryMethod: out.deliveryMethod || null });
    if (d?.job) { setJob(d.job); setEditOut(false); }
  }
  async function collectionPack() {
    const d = await fetch(`/api/jobs/${job.id}/collection-pack`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return alertDialog("Couldn't put the pack together. Try again.");
    const { downloadCollectionPack } = await import("@/lib/collectionPackPdf");
    await downloadCollectionPack(d);
  }
  const late = job.endDate && job.endDate.slice(0, 10) < today();

  return (
    <section style={darkCard} className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline gap-3">
        <h2 style={{ ...h2, color: "#fff" }}>{job.deliveryMethod === "delivery" ? "Delivery" : "Collection"}</h2>
        <button type="button" onClick={() => setEditOut(v => !v)} className="text-[13px] font-semibold" style={{ color: "var(--tws-accent-light)" }}>{editOut ? "Close" : "Edit"}</button>
      </div>
      {!editOut ? (
        <>
          <span className="text-sm">
            <strong style={{ color: late ? "#f4a99b" : "#fff" }}>{job.endDate ? new Date(job.endDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "No due-out date"}</strong>
            {late ? " · overdue" : ""} · {job.deliveryMethod === "delivery" ? "we deliver" : job.deliveryMethod === "collection" ? `client collects from ${space.shortName ?? space.name}` : "collection or delivery not set"}
          </span>
          {job.startDate && <span className="text-[13px]" style={{ color: "var(--tws-night-muted)" }}>Build starts {fmtDate(job.startDate)}</span>}
          {job.deliveryNotes && <span className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--tws-night-muted)" }}>{job.deliveryNotes}</span>}
          <span className="text-[13px]" style={{ color: "var(--tws-night-muted)" }}>Parts done: {parts.filter(p => p.done).length} of {parts.length}</span>
          <div className="mt-2 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--tws-char-hi)" }}>
            <span className="text-[13px] font-bold" style={{ color: collect.length && collect.every(c => c.done) ? "var(--tws-accent-light)" : "#fff" }}>
              Ready-to-{job.deliveryMethod === "delivery" ? "deliver" : "collect"} check{collect.length ? `: ${collect.filter(c => c.done).length} of ${collect.length} done` : ""}{collect.length && collect.every(c => c.done) ? " ✓" : ""}
            </span>
            <BuildChecklist jobId={job.id} kind="collect" checks={checks} onChange={setChecks} dark placeholder="Add a check" />
            <button type="button" disabled={busy} onClick={collectionPack} className="self-start mt-1 text-[13px] font-bold px-3 py-2" style={{ background: "var(--tws-accent)", color: "var(--tws-ink)" }}>
              Collection pack (PDF)
            </button>
            <span className="text-[11px]" style={{ color: "var(--tws-night-muted)" }}>Load list with weights, FR certificates, drawings and these checks.</span>
          </div>
        </>
      ) : (
        <form onSubmit={saveOut} className="flex flex-col gap-2.5">
          {[["o-start", "Build starts", "startDate"], ["o-due", "Due out", "dueOut"]].map(([id, l, k]) => (
            <div key={id}><label htmlFor={id} style={{ ...lbl, color: "var(--tws-night-muted)" }}>{l}</label>
              <input id={id} type="date" style={input} value={out[k as "startDate"]} onChange={e => setOut({ ...out, [k]: e.target.value })} /></div>
          ))}
          <div><label htmlFor="o-how" style={{ ...lbl, color: "var(--tws-night-muted)" }}>Leaving by</label>
            <select id="o-how" style={input} value={out.deliveryMethod} onChange={e => setOut({ ...out, deliveryMethod: e.target.value })}>
              <option value="">Not decided</option><option value="collection">Collection (client collects)</option><option value="delivery">Delivery (we deliver)</option>
            </select></div>
          <div><label htmlFor="o-show" style={{ ...lbl, color: "var(--tws-night-muted)" }}>For production</label>
            <select id="o-show" style={input} value={out.forProductionId} onChange={e => setOut({ ...out, forProductionId: e.target.value })}>
              <option value="">Not on the Hub / none</option>
              {job.forProduction && !productions.some(p => p.id === job.forProduction!.id) && <option value={job.forProduction.id}>{job.forProduction.name}</option>}
              {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label htmlFor="o-notes" style={{ ...lbl, color: "var(--tws-night-muted)" }}>Notes (haulier, loading slot, contact)</label>
            <textarea id="o-notes" rows={3} style={input} value={out.deliveryNotes} onChange={e => setOut({ ...out, deliveryNotes: e.target.value })} /></div>
          <button type="submit" disabled={busy} style={{ ...btnSolid, background: "var(--tws-accent)", borderColor: "var(--tws-accent)", color: "var(--tws-ink)" }}>Save</button>
        </form>
      )}
    </section>
  );
}
