"use client";

// A build's drawings for client sign-off: each drawing's latest revision and its status, new
// revisions, the decision log, and (admins) recording the client's decision on one or several
// drawings at once. While any latest revision isn't approved, the build can't move to Build.
import { useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { fmtDate, fmtDayTime } from "@/lib/format";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";

type Decision = { id: number; decision: string; comment: string | null; byName: string; onBehalf: boolean; createdAt: string };
type Rev = { id: number; rev: string; status: string; note: string | null; createdAt: string; file: { id: number; name: string; url: string; uploadedBy: { name: string } | null }; decisions: Decision[] };
export type DrawingRow = { id: number; number: string | null; title: string; latest: Rev | null; revisions: Rev[] };
export type Blocker = { id: number; label: string; rev: string; status: string };
export type Override = { id: number; text: string; createdAt: string };

const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: { label: "Awaiting sign-off", style: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" } },
  approved: { label: "Approved", style: { background: "var(--tws-char)", color: "#fff" } },
  changes: { label: "Changes requested", style: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" } },
  superseded: { label: "Superseded", style: { background: "transparent", color: "var(--tws-muted)", textDecoration: "line-through" } },
};

export default function DrawingRegister({ jobId, initial, isAdmin, onBlockers }: { jobId: number; initial: { drawings: DrawingRow[]; blockers: Blocker[]; overrides?: Override[] }; isAdmin: boolean; onBlockers?: (b: Blocker[]) => void }) {
  const [overrides, setOverrides] = useState(initial.overrides ?? []);
  const [drawings, setDrawings] = useState(initial.drawings);
  const [blockers, setBlockers] = useState(initial.blockers);
  const [adding, setAdding] = useState<null | { number: string; title: string; note: string }>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [record, setRecord] = useState<null | { decision: "approved" | "changes"; comment: string }>(null);

  const apply = (d: { drawings?: DrawingRow[]; blockers?: Blocker[]; overrides?: Override[] }) => {
    if (d.drawings) setDrawings(d.drawings);
    if (d.overrides) setOverrides(d.overrides);
    if (d.blockers) { setBlockers(d.blockers); onBlockers?.(d.blockers); }
  };
  async function send(url: string, init: RequestInit) {
    setBusy(true);
    const res = await fetch(url, init);
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return null; }
    apply(d);
    return d;
  }
  async function addDrawing(e: React.FormEvent) {
    e.preventDefault();
    if (!adding || !file) return alertDialog("Choose the drawing file");
    const fd = new FormData();
    fd.append("number", adding.number); fd.append("title", adding.title); fd.append("note", adding.note); fd.append("file", file);
    if (await send(`/api/jobs/${jobId}/drawings`, { method: "POST", body: fd })) { setAdding(null); setFile(null); }
  }
  async function newRevision(d: DrawingRow, f: File | undefined) {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    const r = await send(`/api/jobs/${jobId}/drawings/${d.id}/revisions`, { method: "POST", body: fd });
    if (r?.rev) alertDialog(`${d.number ?? d.title} is now at rev ${r.rev}, awaiting sign-off. Rev ${d.latest?.rev} is superseded.`);
  }
  async function remove(d: DrawingRow) {
    if (await confirmDialog(`Remove ${d.number ?? d.title} and all its revisions and sign-off history?`)) await send(`/api/jobs/${jobId}/drawings/${d.id}`, { method: "DELETE" });
  }
  async function recordDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    const r = await send(`/api/jobs/${jobId}/drawings/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionIds: picked, decision: record.decision, comment: record.comment }) });
    if (r) { setRecord(null); setPicked([]); }
  }

  const pendingLatest = drawings.filter(d => d.latest && d.latest.status !== "approved");
  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  return (
    <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Drawings and sign-off">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h2 style={h2}>Drawings &amp; sign-off</h2>
        {!adding && <button type="button" onClick={() => setAdding({ number: "", title: "", note: "" })} className="text-[13px]" style={link}>+ Add a drawing</button>}
      </div>

      {drawings.length > 0 && (
        <div role="status" className="px-3 py-2 text-[13px]" style={blockers.length
          ? { background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }
          : { background: "var(--tws-ground)", color: "var(--tws-ink)" }}>
          {blockers.length
            ? <><strong>{blockers.length} drawing{blockers.length === 1 ? "" : "s"} not signed off.</strong> The build can&apos;t move to Build until {blockers.length === 1 ? "it's" : "they're"} approved.</>
            : <><strong>✓ All drawings signed off.</strong> The build can move to Build.</>}
        </div>
      )}

      {adding && (
        <form onSubmit={addDrawing} className="grid gap-2 sm:grid-cols-[110px_1fr] p-3" style={{ background: "var(--tws-ground)" }}>
          <div><label htmlFor="dr-num" style={lbl}>Number</label><input id="dr-num" style={input} value={adding.number} onChange={e => setAdding({ ...adding, number: e.target.value })} placeholder="GA-01" /></div>
          <div><label htmlFor="dr-title" style={lbl}>Title</label><input id="dr-title" required style={input} value={adding.title} onChange={e => setAdding({ ...adding, title: e.target.value })} placeholder="General arrangement" /></div>
          <div className="sm:col-span-2"><label htmlFor="dr-file" style={lbl}>Drawing (PDF or image) · becomes rev A</label>
            <input id="dr-file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm w-full" /></div>
          <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{busy ? "Uploading…" : "Add drawing"}</button>
            <button type="button" onClick={() => setAdding(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
        </form>
      )}

      {drawings.length === 0 && !adding ? <p className="text-sm" style={muted}>Add the drawings the client has to sign off. Each new upload of a drawing becomes its next revision, and the build can&apos;t move to Build until every latest revision is approved.</p> : (
        <ul className="flex flex-col">
          {drawings.map(d => {
            const r = d.latest!;
            const st = STATUS[r.status] ?? STATUS.pending;
            const isOpen = open === d.id;
            return (
              <li key={d.id} className="py-2.5 flex flex-col gap-2" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  {isAdmin && r.status !== "approved" && <input type="checkbox" aria-label={`Pick ${d.number ?? d.title} rev ${r.rev}`} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4" />}
                  <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-[14rem] break-words"><strong>{d.number ? `${d.number} · ` : ""}{d.title}</strong> <span style={muted}>rev {r.rev}</span></span>
                  <span className="text-[11px] font-bold px-2 py-1" style={st.style}>{st.label}</span>
                  <a href={r.file.url} target="_blank" rel="noopener noreferrer" className="text-[13px]" style={link}>Open</a>
                  <label className="text-[13px] cursor-pointer" style={link}>New revision
                    <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={e => { newRevision(d, e.target.files?.[0]); e.target.value = ""; }} /></label>
                  <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen} className="text-[13px]" style={muted}>{isOpen ? "Hide history" : "History"}</button>
                  {isAdmin && <button type="button" onClick={() => remove(d)} aria-label={`Remove ${d.title}`} className="text-xs" style={{ color: "var(--tws-bad-ink)" }}>✕</button>}
                </div>
                {r.status === "changes" && r.decisions[0]?.comment && <p className="text-[13px] px-3 py-2" style={{ margin: 0, background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)" }}>Changes asked for by {r.decisions[0].byName}: {r.decisions[0].comment}</p>}
                {isOpen && (
                  <ol className="flex flex-col gap-1.5 pl-3 text-[13px]" style={{ borderLeft: "3px solid var(--tws-line)" }} aria-label={`${d.title} history`}>
                    {d.revisions.map(rv => (
                      <li key={rv.id} className="flex flex-col gap-0.5">
                        <span><strong>Rev {rv.rev}</strong> · <a href={rv.file.url} target="_blank" rel="noopener noreferrer" style={link}>{rv.file.name}</a> <span style={muted}>· uploaded {fmtDate(rv.createdAt)}{rv.file.uploadedBy ? ` by ${rv.file.uploadedBy.name}` : ""} · {(STATUS[rv.status] ?? STATUS.pending).label}</span></span>
                        {rv.decisions.map(dc => (
                          <span key={dc.id} style={muted}>{dc.decision === "approved" ? "✓ Approved" : "✗ Changes requested"} by {dc.byName}{dc.onBehalf ? " (recorded by PSG for the client)" : ""}, {fmtDayTime(dc.createdAt)}{dc.comment ? `: “${dc.comment}”` : ""}</span>
                        ))}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {overrides.length > 0 && (
        <div className="flex flex-col gap-1 text-[12px] pt-2" style={{ borderTop: "1px solid var(--tws-line-soft)", color: "var(--tws-warn-ink)" }} aria-label="Sign-off overrides">
          {overrides.map(o => <span key={o.id}>⚠ {fmtDayTime(o.createdAt)}: {o.text}</span>)}
        </div>
      )}

      {isAdmin && pendingLatest.length > 0 && (
        <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span style={muted}>Client signed off by email or phone? Record it ({picked.length} picked):</span>
            <button type="button" onClick={() => setPicked(pendingLatest.map(d => d.latest!.id))} className="underline" style={muted}>Pick all {pendingLatest.length}</button>
            <button type="button" disabled={!picked.length} onClick={() => setRecord({ decision: "approved", comment: "" })} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13, opacity: picked.length ? 1 : 0.4 }}>Record approval</button>
            <button type="button" disabled={!picked.length} onClick={() => setRecord({ decision: "changes", comment: "" })} style={{ ...btnLine, padding: "6px 12px", fontSize: 13, opacity: picked.length ? 1 : 0.4 }}>Record changes</button>
          </div>
          {record && (
            <form onSubmit={recordDecision} className="flex flex-wrap gap-2 items-end p-3" style={{ background: "var(--tws-ground)" }}>
              <div className="flex-1 min-w-[220px]"><label htmlFor="rec-c" style={lbl}>{record.decision === "approved" ? "How did they approve? (e.g. email from Ann, 26 Nov)" : "What needs changing?"}</label>
                <input id="rec-c" required={record.decision === "changes"} style={input} value={record.comment} onChange={e => setRecord({ ...record, comment: e.target.value })} /></div>
              <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{record.decision === "approved" ? `Approve ${picked.length}` : `Ask for changes on ${picked.length}`}</button>
              <button type="button" onClick={() => setRecord(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
