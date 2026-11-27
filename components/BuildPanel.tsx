"use client";

// On a workshop job: where the build is up to (six stages), when it's due out, whether it's
// collected or delivered, which show it's for, and links to its VectorWorks files.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { BUILD_STAGES, stageIndex, STAGE_COLOR } from "@/lib/buildStages";
import { fmtDate } from "@/lib/format";

type Option = { id: number; name: string };
export type BuildInfo = {
  id: number; stage: string | null; stageChangedAt: string | null; startDate: string | null; endDate: string | null;
  deliveryMethod: string | null; deliveryNotes: string | null; forProduction: Option | null;
  links: { id: number; label: string; url: string; kind: string }[];
};

const inp = "w-full rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const ymd = (s: string | null) => (s ? s.slice(0, 10) : "");
const KIND: Record<string, string> = { vectorworks: "VectorWorks", drawing: "Drawing", scenic: "Scenic reference", other: "File" };

export default function BuildPanel({ job, productions, onChange }: { job: BuildInfo; productions: Option[]; onChange: () => void }) {
  const [form, setForm] = useState({
    startDate: ymd(job.startDate), dueOut: ymd(job.endDate), deliveryMethod: job.deliveryMethod ?? "",
    deliveryNotes: job.deliveryNotes ?? "", forProductionId: job.forProduction ? String(job.forProduction.id) : "",
  });
  const [link, setLink] = useState({ label: "", url: "", kind: "vectorworks" });
  const [busy, setBusy] = useState(false);
  const current = stageIndex(job.stage);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { await alertDialog((await res.json().catch(() => ({}))).error ?? "That didn't work"); return false; }
    onChange();
    return true;
  }
  const setStage = (stage: string) => send(`/api/jobs/${job.id}/build`, "PATCH", { stage });
  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    await send(`/api/jobs/${job.id}/build`, "PATCH", { ...form, deliveryMethod: form.deliveryMethod || null });
  }
  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (await send(`/api/jobs/${job.id}/links`, "POST", link)) setLink({ label: "", url: "", kind: "vectorworks" });
  }
  async function removeLink(id: number) {
    if (await confirmDialog("Remove this link? (The file itself isn't touched.)")) await send(`/api/jobs/${job.id}/links/${id}`, "DELETE");
  }

  return (
    <section className="rounded-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--psg-card-border)" }}>
        <h2 className="text-sm font-semibold text-white">Build</h2>
        {job.stageChangedAt && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Stage last changed {fmtDate(job.stageChangedAt)}</span>}
      </div>

      {/* Stage stepper */}
      <ol className="px-4 pt-4 grid grid-cols-3 sm:grid-cols-6 gap-1.5" aria-label="Build stage">
        {BUILD_STAGES.map((s, i) => {
          const done = current >= 0 && i < current, here = i === current;
          const c = STAGE_COLOR[s.key];
          return (
            <li key={s.key}>
              <button type="button" disabled={busy || here} onClick={() => setStage(s.key)} aria-current={here ? "step" : undefined}
                className="w-full rounded px-2 py-2 text-xs font-medium text-center border disabled:cursor-default"
                style={{ borderColor: here || done ? c : "var(--psg-card-border)", backgroundColor: here ? `${c}33` : done ? `${c}14` : "transparent", color: here || done ? c : "var(--psg-muted)" }}>
                {done ? "✓ " : ""}{s.label}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="px-4 pt-1.5 text-xs" style={{ color: "var(--psg-muted)" }}>Click a stage to move the build there.</p>

      <form onSubmit={saveDetails} className="p-4 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="b-start" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Build starts</label>
          <input id="b-start" type="date" className={inp} style={inpStyle} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><label htmlFor="b-due" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Due out of the workshop</label>
          <input id="b-due" type="date" className={inp} style={inpStyle} value={form.dueOut} onChange={e => setForm({ ...form, dueOut: e.target.value })} /></div>
        <div><label htmlFor="b-how" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Leaving by</label>
          <select id="b-how" className={inp} style={inpStyle} value={form.deliveryMethod} onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
            <option value="">Not decided</option><option value="collection">Collection (client collects)</option><option value="delivery">Delivery (we deliver)</option>
          </select></div>
        <div><label htmlFor="b-show" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>For production</label>
          <select id="b-show" className={inp} style={inpStyle} value={form.forProductionId} onChange={e => setForm({ ...form, forProductionId: e.target.value })}>
            <option value="">Not on the Hub / none</option>
            {job.forProduction && !productions.some(p => p.id === job.forProduction!.id) && <option value={job.forProduction.id}>{job.forProduction.name}</option>}
            {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {job.forProduction && <Link href={`/productions/${job.forProduction.id}`} className="text-xs text-blue-400 mt-1 inline-block">Open {job.forProduction.name} →</Link>}
        </div>
        <div className="sm:col-span-2"><label htmlFor="b-notes" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Collection / delivery notes</label>
          <textarea id="b-notes" rows={2} className={inp} style={inpStyle} value={form.deliveryNotes} onChange={e => setForm({ ...form, deliveryNotes: e.target.value })} placeholder="e.g. 7.5t lorry, venue get-in from 8am, contact on site…" /></div>
        <div className="sm:col-span-2"><button type="submit" disabled={busy} className="text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>Save build details</button></div>
      </form>

      {/* File links */}
      <div className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
        <h3 className="px-4 pt-3 text-xs uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Drawings &amp; files</h3>
        {job.links.length === 0 ? <p className="px-4 py-2 text-sm" style={{ color: "var(--psg-muted)" }}>No files linked yet. Paste the SharePoint/OneDrive link to the VectorWorks file.</p> : (
          <ul className="px-4 py-2 space-y-1.5">
            {job.links.map(l => (
              <li key={l.id} className="flex items-center justify-between gap-3 text-sm group">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline truncate min-w-0">📐 {l.label}</a>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{KIND[l.kind] ?? "File"}</span>
                  <button type="button" onClick={() => removeLink(l.id)} aria-label={`Remove link ${l.label}`} className="text-xs text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addLink} className="p-4 pt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] items-end">
          <div><label htmlFor="l-label" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Name</label>
            <input id="l-label" required className={inp} style={inpStyle} value={link.label} onChange={e => setLink({ ...link, label: e.target.value })} placeholder="Set model v3" /></div>
          <div><label htmlFor="l-url" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Link</label>
            <input id="l-url" required type="url" className={inp} style={inpStyle} value={link.url} onChange={e => setLink({ ...link, url: e.target.value })} placeholder="https://…sharepoint.com/…" /></div>
          <div><label htmlFor="l-kind" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
            <select id="l-kind" className={inp} style={inpStyle} value={link.kind} onChange={e => setLink({ ...link, kind: e.target.value })}>
              <option value="vectorworks">VectorWorks</option><option value="drawing">Drawing</option><option value="scenic">Scenic reference</option><option value="other">Other</option>
            </select></div>
          <button type="submit" disabled={busy} className="border px-3 py-1.5 rounded text-sm disabled:opacity-50" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}>Add link</button>
        </form>
      </div>
    </section>
  );
}
