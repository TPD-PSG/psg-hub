// "Drawings & files" card: links to VectorWorks/drawing files, the build's quotes, and the add-a-link form.
import { useState } from "react";
import Link from "next/link";
import { confirmDialog } from "@/components/Dialogs";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { card, h2, muted, link, btnLine, input, label as lbl } from "@/lib/twsUi";
import type { Call } from "./spaceJobTypes";

export default function DrawingsFilesPanel({ job, base, busy, call, reload }: { job: JobDetail; base: string; busy: boolean; call: Call; reload: () => void }) {
  const [link_, setLink] = useState({ label: "", url: "", kind: "vectorworks" });
  async function addLink(e: React.FormEvent) { e.preventDefault(); if (await call(`/api/jobs/${job.id}/links`, "POST", link_)) { setLink({ label: "", url: "", kind: "vectorworks" }); reload(); } }
  async function removeLink(id: number) { if (await confirmDialog("Remove this link? (The file itself isn't touched.)") && await call(`/api/jobs/${job.id}/links/${id}`, "DELETE")) reload(); }

  return (
    <section style={card} className="flex flex-col gap-2.5">
      <h2 style={h2}>Drawings &amp; files</h2>
      {job.links.length === 0 && <p className="text-sm" style={muted}>Paste the SharePoint/OneDrive link to the VectorWorks file.</p>}
      {job.links.map(l => (
        <div key={l.id} className="flex justify-between gap-3 text-sm items-baseline">
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate min-w-0" style={link}>{l.label} · {l.kind === "vectorworks" ? "VectorWorks" : l.kind === "drawing" ? "Drawing" : "File"}</a>
          <button type="button" onClick={() => removeLink(l.id)} aria-label={`Remove link ${l.label}`} className="text-xs font-semibold shrink-0" style={{ color: "var(--tws-bad-ink)" }}>Remove</button>
        </div>
      ))}
      {job.quotes.map(q => <Link key={q.id} href={`${base}/quotes/${q.id}`} className="text-sm" style={link}>Quote {q.number} ({q.status})</Link>)}
      <form onSubmit={addLink} className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
        <div><label htmlFor="l-label" style={lbl}>Name</label><input id="l-label" required style={input} value={link_.label} onChange={e => setLink({ ...link_, label: e.target.value })} placeholder="General arrangement" /></div>
        <div><label htmlFor="l-url" style={lbl}>Link</label><input id="l-url" type="url" required style={input} value={link_.url} onChange={e => setLink({ ...link_, url: e.target.value })} placeholder="https://…sharepoint.com/…" /></div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label htmlFor="l-kind" style={lbl}>Type</label>
            <select id="l-kind" style={input} value={link_.kind} onChange={e => setLink({ ...link_, kind: e.target.value })}><option value="vectorworks">VectorWorks</option><option value="drawing">Drawing</option><option value="other">Other</option></select></div>
          <button type="submit" disabled={busy} style={{ ...btnLine, padding: "7px 14px" }}>Add link</button>
        </div>
      </form>
    </section>
  );
}
