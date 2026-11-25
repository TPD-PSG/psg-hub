"use client";

// Repairs and aftercare for sets on tour (27 Nov 2026), in the space's look: reports from the team
// and from clients, tracked open → scheduled (booked in for a date) → done (what was done).
import { useRef, useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { fmtDate } from "@/lib/format";
import type { SpaceTheme } from "@/lib/spaces";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl, pageHeader } from "@/lib/twsUi";

export type RepairRow = {
  id: number; title: string; description: string | null; whereAt: string | null; urgency: string; status: string; scheduledFor: string | null; resolution: string | null;
  reportedByName: string | null; fromClient: boolean; doneAt: string | null; createdAt: string; photoFileId: number | null;
  job: { id: number; number: string; title: string; client: { name: string } | null }; piece: { id: number; name: string } | null;
};
export type AftercareData = { space: SpaceTheme; repairs: RepairRow[]; jobs: { id: number; number: string; title: string; storedPieces: { id: number; name: string }[] }[]; me: { admin: boolean } };

const URG: Record<string, { label: string; style: React.CSSProperties }> = {
  urgent: { label: "Urgent", style: { background: "var(--tws-bad-ink)", color: "#fff" } },
  soon: { label: "Soon", style: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" } },
  routine: { label: "Routine", style: { background: "var(--tws-tint)", color: "#4e545b" } },
};
const TABS = [["open", "Open"], ["scheduled", "Booked in"], ["done", "Done"], ["all", "All"]] as const;
const small: React.CSSProperties = { ...btnLine, padding: "5px 10px", fontSize: 12 };

export default function Aftercare({ initial }: { initial: AftercareData }) {
  const { space, jobs } = initial;
  const base = `/spaces/${space.slug}`;
  const [repairs, setRepairs] = useState(initial.repairs);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("open");
  const [report, setReport] = useState<null | { jobId: string; pieceId: string; title: string; description: string; whereAt: string; urgency: string }>(null);
  const [act, setAct] = useState<null | { id: number; kind: "scheduled" | "done"; date: string; text: string }>(null);
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    const fd = new FormData();
    Object.entries(report).forEach(([k, v]) => fd.append(k, v));
    const f = photoRef.current?.files?.[0];
    if (f) fd.append("photo", await shrinkPhoto(f));
    setBusy(true);
    const res = await fetch(`/api/spaces/${space.slug}/repairs`, { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't save the report");
    setRepairs(rs => [d, ...rs]); setReport(null); setTab("open");
  }
  async function patch(r: RepairRow, body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/repairs/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return false; }
    setRepairs(rs => rs.map(x => (x.id === r.id ? d : x)));
    return true;
  }
  async function saveAct(e: React.FormEvent) {
    e.preventDefault();
    const r = repairs.find(x => x.id === act?.id);
    if (!act || !r) return;
    if (await patch(r, act.kind === "scheduled" ? { status: "scheduled", scheduledFor: act.date, resolution: act.text || undefined } : { status: "done", resolution: act.text })) setAct(null);
  }
  async function remove(r: RepairRow) {
    if (!(await confirmDialog(`Delete the repair "${r.title}"? Only for reports made by mistake.`))) return;
    const res = await fetch(`/api/repairs/${r.id}`, { method: "DELETE" });
    if (res.ok) setRepairs(rs => rs.filter(x => x.id !== r.id));
  }

  const count = (k: string) => repairs.filter(r => k === "all" || r.status === k).length;
  const shown = repairs.filter(r => tab === "all" || r.status === tab)
    .sort((a, b) => (a.status === "open" && b.status === "open" ? ["urgent", "soon", "routine"].indexOf(a.urgency) - ["urgent", "soon", "routine"].indexOf(b.urgency) : 0));
  const pieces = report ? jobs.find(j => String(j.id) === report.jobId)?.storedPieces ?? [] : [];

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Aftercare</div>
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div className="flex flex-col gap-1">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Repairs &amp; aftercare</h1>
            <span className="text-sm" style={muted}>Problems with sets out on tour, from the team and from clients</span>
          </div>
          {!report && <button type="button" onClick={() => setReport({ jobId: jobs[0] ? String(jobs[0].id) : "", pieceId: "", title: "", description: "", whereAt: "", urgency: "soon" })} style={btnSolid}>+ Report a repair</button>}
        </div>
      </header>
      <div className="px-4 sm:px-10 py-6 flex flex-col gap-5 max-w-5xl">
        {report && (
          <form onSubmit={submitReport} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-3">
            <h2 style={h2}>Report a repair</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="rp-job" style={lbl}>Build</label>
                <select id="rp-job" required style={input} value={report.jobId} onChange={e => setReport({ ...report, jobId: e.target.value, pieceId: "" })}>{jobs.map(j => <option key={j.id} value={j.id}>{j.number} · {j.title}</option>)}</select></div>
              <div><label htmlFor="rp-piece" style={lbl}>Piece (optional)</label>
                <select id="rp-piece" style={input} value={report.pieceId} onChange={e => setReport({ ...report, pieceId: e.target.value })}><option value="">Not a particular piece</option>{pieces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div><label htmlFor="rp-title" style={lbl}>What needs repairing?</label><input id="rp-title" required style={input} value={report.title} onChange={e => setReport({ ...report, title: e.target.value })} placeholder="e.g. Staircase truck castor snapped" /></div>
            <div><label htmlFor="rp-desc" style={lbl}>Details (optional)</label><textarea id="rp-desc" rows={2} style={input} value={report.description} onChange={e => setReport({ ...report, description: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2"><label htmlFor="rp-where" style={lbl}>Where is it now?</label><input id="rp-where" style={input} value={report.whereAt} onChange={e => setReport({ ...report, whereAt: e.target.value })} placeholder="e.g. Theatre Royal Plymouth, until Sat" /></div>
              <div><label htmlFor="rp-urg" style={lbl}>How urgent?</label>
                <select id="rp-urg" style={input} value={report.urgency} onChange={e => setReport({ ...report, urgency: e.target.value })}><option value="urgent">Urgent: the show needs it</option><option value="soon">Soon</option><option value="routine">Routine</option></select></div>
            </div>
            <div><label htmlFor="rp-photo" style={lbl}>Photo (optional)</label><input id="rp-photo" ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="text-sm" /></div>
            <div className="flex gap-2"><button type="submit" disabled={busy} style={btnSolid}>Report it</button><button type="button" onClick={() => setReport(null)} style={btnLine}>Cancel</button></div>
          </form>
        )}

        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
          {TABS.map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className="text-xs font-bold px-2.5 py-1.5" style={tab === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-card)", border: "1px solid var(--tws-line)", color: "var(--tws-ink)" }}>{l} ({count(k)})</button>)}
        </div>

        <section style={card} className="flex flex-col" aria-label="Repairs">
          {shown.length === 0 && <p className="text-sm m-0" style={muted}>{repairs.length ? "Nothing here." : "No repairs reported. Clients can report problems from their builds page too."}</p>}
          {shown.map(r => (
            <article key={r.id} className="py-3.5 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[11px] font-bold px-2 py-0.5" style={URG[r.urgency]?.style}>{URG[r.urgency]?.label ?? r.urgency}</span>
                <strong className="text-[15px] min-w-0 break-words">{r.title}</strong>
                <Link href={`${base}/jobs/${r.job.id}`} className="text-[13px]" style={link}>{r.job.title}</Link>
                {r.piece && <Link href={`${base}/pieces/${r.piece.id}`} className="text-[13px]" style={link}>{r.piece.name}</Link>}
                <span className="ml-auto text-[12px] font-bold" style={{ color: r.status === "done" ? "var(--tws-muted)" : "var(--tws-ink)" }}>
                  {r.status === "open" ? "Open" : r.status === "scheduled" ? `Booked in ${r.scheduledFor ? fmtDate(r.scheduledFor) : ""}` : `Done ${r.doneAt ? fmtDate(r.doneAt) : ""}`}
                </span>
              </div>
              {r.description && <p className="text-[13px] m-0 whitespace-pre-wrap">{r.description}</p>}
              <div className="text-xs" style={muted}>
                {[r.whereAt && `At ${r.whereAt}`, `Reported by ${r.reportedByName ?? "someone"}${r.fromClient ? " (client)" : ""}`, fmtDate(r.createdAt), r.job.client?.name].filter(Boolean).join(" · ")}
              </div>
              {r.resolution && <p className="text-[13px] m-0 px-3 py-2" style={{ background: "var(--tws-ground)" }}>{r.status === "done" ? "Done: " : "Plan: "}{r.resolution}</p>}
              {r.photoFileId && <a href={`/api/job-files/${r.photoFileId}`} target="_blank" rel="noopener noreferrer" className="text-[13px] self-start" style={link}>Open the photo</a>}
              <div className="flex flex-wrap gap-2 items-center">
                {r.status !== "done" && <button type="button" disabled={busy} onClick={() => setAct({ id: r.id, kind: "scheduled", date: r.scheduledFor?.slice(0, 10) ?? "", text: r.resolution ?? "" })} style={small}>{r.status === "scheduled" ? "Change date" : "Book it in"}</button>}
                {r.status !== "done" && <button type="button" disabled={busy} onClick={() => setAct({ id: r.id, kind: "done", date: "", text: "" })} style={small}>Mark done</button>}
                {r.status === "done" && <button type="button" disabled={busy} onClick={() => patch(r, { status: "open" })} style={small}>Reopen</button>}
                {initial.me.admin && <button type="button" onClick={() => remove(r)} className="text-xs ml-auto" style={{ color: "var(--tws-bad-ink)" }}>Delete</button>}
              </div>
              {act?.id === r.id && (
                <form onSubmit={saveAct} className="flex flex-wrap gap-2 items-end p-3" style={{ background: "var(--tws-ground)" }}>
                  {act.kind === "scheduled" && <div><label htmlFor={`ac-d${r.id}`} style={lbl}>Booked in for</label><input id={`ac-d${r.id}`} type="date" required style={input} value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} /></div>}
                  <div className="flex-1 min-w-[14rem]"><label htmlFor={`ac-t${r.id}`} style={lbl}>{act.kind === "done" ? "What was done?" : "Plan (optional)"}</label>
                    <input id={`ac-t${r.id}`} required={act.kind === "done"} autoFocus style={input} value={act.text} onChange={e => setAct({ ...act, text: e.target.value })} placeholder={act.kind === "done" ? "e.g. New castor fitted at the venue" : "e.g. Dan to visit with spare castors"} /></div>
                  <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{act.kind === "done" ? "Mark done" : "Book it in"}</button>
                  <button type="button" onClick={() => setAct(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button>
                </form>
              )}
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
