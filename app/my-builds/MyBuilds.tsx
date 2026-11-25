"use client";

// Client view, in the builder's brand: each build's progress and its drawings. The latest revision
// of each drawing can be approved one at a time or several at once, or sent back with a comment.
import { useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { BUILD_STAGES, stageIndex } from "@/lib/buildStages";
import { fmtDate } from "@/lib/format";
import type { SpaceTheme } from "@/lib/spaces";
import { caps, card, h2, muted, link, btnSolid, btnLine, input, label as lbl, pageHeader, stageTone } from "@/lib/twsUi";

type Decision = { id: number; decision: string; comment: string | null; byName: string; onBehalf: boolean; createdAt: string };
type Revision = { id: number; rev: string; status: string; note: string | null; createdAt: string; url: string; file: { name: string; mime: string }; decisions: Decision[] };
type Drawing = { id: number; number: string | null; title: string; revisions: Revision[] };
type Build = {
  id: number; number: string; title: string; stage: string | null; status: string; startDate: string | null; endDate: string | null;
  builder: { name: string; shortName: string | null; color: string | null; logoUrl: string | null } | null;
  drawings: Drawing[];
  photos: { id: number; caption: string | null; createdAt: string; url: string }[];
  variations: ClientVariation[];
  repairs: { id: number; title: string; whereAt: string | null; urgency: string; status: string; scheduledFor: string | null; resolution: string | null; reportedByName: string | null; createdAt: string; doneAt: string | null }[];
  storedPieces: { id: number; name: string }[];
};
type ClientVariation = {
  id: number; label: string; title: string; notes: string | null; vatRate: number; status: string; sentAt: string | null; decidedAt: string | null;
  decidedByName: string | null; decidedOnBehalf: boolean; decisionComment: string | null;
  lines: { id: number; section: string | null; description: string; quantity: number; unit: string | null; unitPrice: number }[];
  totals: { net: number; vat: number; gross: number };
};
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
export type MyBuildsData = { me: { name: string; company: string }; builds: Build[]; brand: SpaceTheme | null };

const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: { label: "Awaiting your sign-off", style: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" } },
  approved: { label: "Approved", style: { background: "var(--tws-char)", color: "#fff", border: "1px solid var(--tws-char)" } },
  changes: { label: "Changes requested", style: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" } },
};
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 8px", whiteSpace: "nowrap" };
const small: React.CSSProperties = { ...btnSolid, padding: "7px 12px", fontSize: 13 };
const smallLine: React.CSSProperties = { ...btnLine, padding: "7px 12px", fontSize: 13 };
const badLine: React.CSSProperties = { ...smallLine, color: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-line)" };

export default function MyBuilds({ initial }: { initial: MyBuildsData }) {
  const [data, setData] = useState(initial);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [changesFor, setChangesFor] = useState<number[] | null>(null); // revision ids being sent back
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState<Set<number>>(new Set());
  const [declining, setDeclining] = useState<{ id: number; comment: string } | null>(null);
  const [reporting, setReporting] = useState<null | { jobId: number; pieceId: string; title: string; description: string; whereAt: string; urgency: string; photo: File | null }>(null);
  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reporting) return;
    const fd = new FormData();
    const { photo, ...rest } = reporting;
    Object.entries(rest).forEach(([k, v]) => fd.append(k, String(v)));
    if (photo) fd.append("photo", await shrinkPhoto(photo));
    setBusy(true);
    const res = await fetch("/api/my-builds/repairs", { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "That didn't go through. Try again.");
    setData(d); setReporting(null);
    alertDialog(`Thanks. ${builderName} has been told and will be in touch.`);
  }
  const [openVar, setOpenVar] = useState<Set<number>>(new Set());
  async function decideVar(v: ClientVariation, decision: "approved" | "declined", comment?: string) {
    if (decision === "approved" && !(await confirmDialog(`Approve ${v.label}, ${v.title}, for ${gbp(v.totals.net)} + VAT (${gbp(v.totals.gross)})? It's added to the price of this build.`))) return;
    setBusy(true);
    const res = await fetch(`/api/my-builds/variations/${v.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, comment }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't go through. Try again."); return; }
    setData(d); setDeclining(null);
    alertDialog(decision === "approved" ? `${v.label} approved. ${builderName} has been told.` : `${v.label} declined. ${builderName} has been told why.`);
  }

  const latest = (d: Drawing) => d.revisions[0];
  const waiting = data.builds.flatMap(b => b.drawings.filter(d => latest(d)?.status === "pending"));
  const varsWaiting = data.builds.flatMap(b => b.variations.filter(v => v.status === "sent"));
  const label = (d: Drawing) => `${d.number ? `${d.number} ` : ""}${d.title}`;
  const builderName = data.brand ? data.brand.shortName ?? data.brand.name : "PSG";

  async function send(revisionIds: number[], decision: "approved" | "changes", text?: string) {
    setBusy(true);
    const res = await fetch("/api/my-builds/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionIds, decision, comment: text }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't go through. Try again."); return; }
    setData(d);
    setPicked(new Set());
    setChangesFor(null);
    setComment("");
    alertDialog(decision === "approved"
      ? `${revisionIds.length === 1 ? "Drawing" : `${revisionIds.length} drawings`} approved. ${builderName} has been told.`
      : `Sent back with your comments. ${builderName} has been told and will upload a new revision.`);
  }
  const toggle = (id: number) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedList = [...picked];
  const sticky: React.CSSProperties = { position: "sticky", top: 72, zIndex: 20 };

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-6 pb-6 flex flex-col gap-1.5">
        <span style={caps}>{data.me.company}</span>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Your builds</h1>
        <span className="text-sm" style={muted}>
          {waiting.length === 0 && varsWaiting.length === 0 ? "Nothing waiting for your sign-off."
            : [waiting.length ? `${waiting.length} drawing${waiting.length === 1 ? "" : "s"}` : null, varsWaiting.length ? `${varsWaiting.length} variation${varsWaiting.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ") + " waiting for your sign-off."}
        </span>
      </header>

      <div className="px-4 sm:px-10 py-6 flex flex-col gap-6 max-w-5xl w-full">
        {/* Bulk bar */}
        {pickedList.length > 0 && !changesFor && (
          <div style={{ ...sticky, background: "var(--tws-night)", color: "#fff", borderLeft: "6px solid var(--tws-accent)" }} className="px-4 py-3 flex flex-wrap items-center gap-3" role="region" aria-label="Selected drawings">
            <span className="text-sm font-bold">{pickedList.length} selected</span>
            <button disabled={busy} onClick={() => send(pickedList, "approved")} style={{ ...small, background: "var(--tws-accent)", color: "var(--tws-ink)", borderColor: "var(--tws-accent)" }}>Approve {pickedList.length === 1 ? "it" : `all ${pickedList.length}`}</button>
            <button disabled={busy} onClick={() => { setChangesFor(pickedList); setComment(""); }} style={{ ...smallLine, color: "#fff", borderColor: "#fff" }}>Request changes</button>
            <button onClick={() => setPicked(new Set())} className="text-sm underline ml-auto" style={{ color: "var(--tws-nav-ink)" }}>Clear</button>
          </div>
        )}

        {/* Request changes */}
        {changesFor && (
          <form onSubmit={e => { e.preventDefault(); send(changesFor, "changes", comment); }} style={{ ...card, ...sticky, borderTop: "6px solid var(--tws-bad-ink)" }} className="flex flex-col gap-3">
            <h2 style={h2}>Request changes on {changesFor.length === 1 ? "this drawing" : `${changesFor.length} drawings`}</h2>
            <div>
              <label htmlFor="changes-comment" style={lbl}>What needs changing? {builderName} sees exactly this.</label>
              <textarea id="changes-comment" required autoFocus rows={3} value={comment} onChange={e => setComment(e.target.value)} style={input}
                placeholder="e.g. Door needs to open stage left; arch 200mm taller" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="submit" disabled={busy || !comment.trim()} style={{ ...small, background: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-ink)" }}>Send back</button>
              <button type="button" onClick={() => setChangesFor(null)} style={smallLine}>Cancel</button>
            </div>
          </form>
        )}

        {data.builds.length === 0 && (
          <div style={card} className="text-sm"><span style={muted}>No builds for {data.me.company} yet. When one starts, it shows here with its drawings.</span></div>
        )}

        {data.builds.map(b => {
          const at = stageIndex(b.stage);
          const open = b.drawings.filter(d => latest(d) && latest(d).status !== "approved");
          return (
            <section key={b.id} style={{ ...card, padding: 0, borderTop: "6px solid var(--tws-char)" }} aria-label={b.title}>
              <div className="p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <span style={caps}>{b.number}</span>
                    <h2 style={{ ...h2, fontSize: 22 }} className="break-words">{b.title}</h2>
                    <span className="text-[13px]" style={muted}>{[b.startDate && b.endDate ? `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}` : null, b.status === "complete" ? "Complete" : null].filter(Boolean).join(" · ") || "Dates to be confirmed"}</span>
                  </div>
                  {b.builder && data.brand && b.builder.name !== data.brand.name && (
                    <span className="text-xs" style={muted}>Built by <strong style={{ color: "var(--tws-ink)" }}>{b.builder.shortName ?? b.builder.name}</strong></span>
                  )}
                </div>

                {/* Progress */}
                {at >= 0 && (
                  <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1 m-0 p-0 list-none" aria-label="Progress">
                    {BUILD_STAGES.map((s, i) => (
                      <li key={s.key} aria-current={i === at ? "step" : undefined} className="text-[12px] px-2 py-2 text-center font-semibold"
                        style={stageTone(i < at ? "done" : i === at ? "now" : "todo")}>
                        {i < at ? "✓ " : ""}{s.label}
                      </li>
                    ))}
                  </ol>
                )}

                {/* Variations: extra or changed work, priced, for the client to approve */}
                {b.variations.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 style={{ ...caps, margin: 0 }}>Variations</h3>
                    <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
                      {b.variations.map(v => {
                        const sent = v.status === "sent";
                        const shown = sent || openVar.has(v.id);
                        return (
                          <li key={v.id} className="py-3 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                            <button type="button" onClick={() => !sent && setOpenVar(o => { const n = new Set(o); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} aria-expanded={sent ? undefined : shown}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left" style={{ background: "none", border: 0, padding: 0, color: "inherit", cursor: sent ? "default" : "pointer" }}>
                              <strong className="text-[15px]">{v.label}</strong>
                              <span className="text-[15px] font-bold flex-1 min-w-0 break-words">{v.title}</span>
                              <span className="text-[15px] font-bold tabular-nums">{gbp(v.totals.net)} <span className="text-xs font-medium" style={muted}>+ VAT</span></span>
                              <span style={{ ...chip, ...(sent ? STATUS.pending.style : v.status === "approved" ? STATUS.approved.style : STATUS.changes.style) }}>{sent ? "Awaiting your approval" : v.status === "approved" ? "Approved" : "Declined"}</span>
                            </button>
                            {!sent && <p className="text-xs m-0" style={muted}>{v.status === "approved" ? "Approved" : "Declined"} by {v.decidedByName}{v.decidedOnBehalf ? ` (recorded by ${builderName})` : ""}{v.decidedAt ? ` · ${fmtDate(v.decidedAt)}` : ""}{v.decisionComment ? `: “${v.decisionComment}”` : ""}</p>}
                            {shown && (
                              <div className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-ground)" }}>
                                {v.notes && <p className="text-[13px] m-0 whitespace-pre-wrap">{v.notes}</p>}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[13px]" style={{ borderCollapse: "collapse", minWidth: 420 }}>
                                    <thead><tr className="text-xs text-left" style={muted}><th className="py-1 pr-2 font-semibold">Item</th><th className="py-1 pr-2 font-semibold">Qty</th><th className="py-1 pr-2 font-semibold text-right">Rate</th><th className="py-1 font-semibold text-right">Amount</th></tr></thead>
                                    <tbody>
                                      {v.lines.map(l => (
                                        <tr key={l.id} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                                          <td className="py-1 pr-2">{l.description}</td><td className="py-1 pr-2 whitespace-nowrap">{l.quantity} {l.unit ?? ""}</td>
                                          <td className="py-1 pr-2 text-right tabular-nums">{gbp(l.unitPrice)}</td><td className="py-1 text-right tabular-nums">{gbp(l.quantity * l.unitPrice)}</td>
                                        </tr>
                                      ))}
                                      <tr style={{ borderTop: "2px solid var(--tws-char)" }}><td colSpan={3} className="py-1 pr-2 text-right">Total ex VAT</td><td className="py-1 text-right tabular-nums font-bold">{gbp(v.totals.net)}</td></tr>
                                      <tr><td colSpan={3} className="py-0.5 pr-2 text-right" style={muted}>VAT {v.vatRate}%</td><td className="py-0.5 text-right tabular-nums" style={muted}>{gbp(v.totals.vat)}</td></tr>
                                      <tr><td colSpan={3} className="py-0.5 pr-2 text-right font-bold">Total</td><td className="py-0.5 text-right tabular-nums font-bold">{gbp(v.totals.gross)}</td></tr>
                                    </tbody>
                                  </table>
                                </div>
                                {sent && (declining?.id === v.id ? (
                                  <form onSubmit={e => { e.preventDefault(); decideVar(v, "declined", declining.comment); }} className="flex flex-col gap-2">
                                    <label htmlFor={`dec-${v.id}`} style={lbl}>Why not? {builderName} sees exactly this.</label>
                                    <textarea id={`dec-${v.id}`} required autoFocus rows={2} style={input} value={declining.comment} onChange={e => setDeclining({ id: v.id, comment: e.target.value })} placeholder="e.g. Over budget: can we keep the original design?" />
                                    <div className="flex gap-2 flex-wrap"><button type="submit" disabled={busy || !declining.comment.trim()} style={{ ...small, background: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-ink)" }}>Decline</button><button type="button" onClick={() => setDeclining(null)} style={smallLine}>Cancel</button></div>
                                  </form>
                                ) : (
                                  <div className="flex gap-2 flex-wrap">
                                    <button type="button" disabled={busy} onClick={() => decideVar(v, "approved")} style={small}>Approve {v.label}</button>
                                    <button type="button" disabled={busy} onClick={() => setDeclining({ id: v.id, comment: "" })} style={badLine}>Decline</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Repairs and aftercare: report a problem with the set; see what's happening */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 style={{ ...caps, margin: 0 }}>Repairs &amp; aftercare</h3>
                    {reporting?.jobId !== b.id && <button type="button" onClick={() => setReporting({ jobId: b.id, pieceId: "", title: "", description: "", whereAt: "", urgency: "soon", photo: null })} className="text-[13px]" style={link}>Report a problem</button>}
                  </div>
                  {reporting?.jobId === b.id && (
                    <form onSubmit={sendReport} className="flex flex-col gap-2.5 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
                      <div><label htmlFor={`rp-t${b.id}`} style={lbl}>What&apos;s wrong?</label><input id={`rp-t${b.id}`} required autoFocus style={input} value={reporting.title} onChange={e => setReporting({ ...reporting, title: e.target.value })} placeholder="e.g. Door on the palace flat won't close" /></div>
                      {b.storedPieces.length > 0 && <div><label htmlFor={`rp-p${b.id}`} style={lbl}>Which piece? (optional)</label>
                        <select id={`rp-p${b.id}`} style={input} value={reporting.pieceId} onChange={e => setReporting({ ...reporting, pieceId: e.target.value })}><option value="">Not sure / general</option>{b.storedPieces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
                      <div><label htmlFor={`rp-d${b.id}`} style={lbl}>More detail (optional)</label><textarea id={`rp-d${b.id}`} rows={2} style={input} value={reporting.description} onChange={e => setReporting({ ...reporting, description: e.target.value })} /></div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div><label htmlFor={`rp-w${b.id}`} style={lbl}>Where is the set now?</label><input id={`rp-w${b.id}`} style={input} value={reporting.whereAt} onChange={e => setReporting({ ...reporting, whereAt: e.target.value })} placeholder="Venue and dates" /></div>
                        <div><label htmlFor={`rp-u${b.id}`} style={lbl}>How urgent?</label>
                          <select id={`rp-u${b.id}`} style={input} value={reporting.urgency} onChange={e => setReporting({ ...reporting, urgency: e.target.value })}><option value="urgent">Urgent: affects the show</option><option value="soon">Soon</option><option value="routine">When convenient</option></select></div>
                      </div>
                      <div><label htmlFor={`rp-ph${b.id}`} style={lbl}>Photo (optional)</label><input id={`rp-ph${b.id}`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="text-sm" onChange={e => setReporting({ ...reporting, photo: e.target.files?.[0] ?? null })} /></div>
                      <div className="flex gap-2 flex-wrap"><button type="submit" disabled={busy} style={small}>Send to {builderName}</button><button type="button" onClick={() => setReporting(null)} style={smallLine}>Cancel</button></div>
                    </form>
                  )}
                  {b.repairs.length > 0 && (
                    <ul className="flex flex-col m-0 p-0 list-none text-[13px]">
                      {b.repairs.map(r => (
                        <li key={r.id} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                          <strong className="min-w-0 break-words">{r.title}</strong>
                          <span className="ml-auto font-bold" style={{ color: r.status === "done" ? "var(--tws-muted)" : "var(--tws-ink)" }}>{r.status === "open" ? "Reported" : r.status === "scheduled" ? `Booked in${r.scheduledFor ? ` ${fmtDate(r.scheduledFor)}` : ""}` : "Done"}</span>
                          <span className="basis-full text-xs" style={muted}>{[r.whereAt, `reported ${fmtDate(r.createdAt)}`, r.resolution && (r.status === "done" ? `done: ${r.resolution}` : r.resolution)].filter(Boolean).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Progress photos (staff choose which) */}
                {b.photos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 style={{ ...caps, margin: 0 }}>Progress photos</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {b.photos.slice(0, showAll.has(b.id) ? undefined : 8).map(p => (
                        <figure key={p.id} className="m-0 flex flex-col gap-1 min-w-0">
                          <a href={p.url} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                            <img src={p.url} alt={p.caption ?? `${b.title} progress photo`} loading="lazy" className="w-full aspect-[4/3] object-cover" style={{ background: "var(--tws-tint)" }} />
                          </a>
                          <figcaption className="text-[11px] truncate" style={muted}>{p.caption ? `${p.caption} · ` : ""}{fmtDate(p.createdAt)}</figcaption>
                        </figure>
                      ))}
                    </div>
                    {b.photos.length > 8 && !showAll.has(b.id) && (
                      <button onClick={() => setShowAll(x => new Set([...x, b.id]))} className="text-[13px] self-start" style={link}>Show all {b.photos.length} photos</button>
                    )}
                  </div>
                )}

                {/* Drawings */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 style={{ ...caps, margin: 0 }}>Drawings</h3>
                    {open.length > 1 && (
                      <button onClick={() => setPicked(p => new Set([...p, ...open.map(d => latest(d).id)]))} className="text-[13px]" style={link}>Pick all {open.length} not yet approved</button>
                    )}
                  </div>
                  {b.drawings.length === 0 ? <p className="text-sm m-0" style={muted}>No drawings to sign off yet.</p> : (
                    <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
                      {b.drawings.map(d => {
                        const r = latest(d);
                        if (!r) return null;
                        const st = STATUS[r.status] ?? STATUS.pending;
                        const last = r.decisions[0];
                        const canDecide = r.status !== "approved";
                        return (
                          <li key={d.id} className="py-3.5 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                            <div className="flex flex-wrap items-center gap-3">
                              {canDecide && (
                                <input type="checkbox" aria-label={`Select ${label(d)}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4" style={{ accentColor: "var(--tws-char)" }} />
                              )}
                              <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-0">
                                <div className="text-[15px] font-bold break-words">{label(d)} <span className="font-medium" style={muted}>· rev {r.rev}</span></div>
                                <div className="text-xs" style={muted}>Uploaded {fmtDate(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</div>
                              </div>
                              <span style={{ ...chip, ...st.style }}>{st.label}</span>
                              <a href={r.url} target="_blank" rel="noopener" className="text-[13px] shrink-0" style={link}>Open drawing ↗</a>
                            </div>
                            {last && r.status !== "pending" && (
                              <p className="text-xs m-0" style={muted}>
                                {last.decision === "approved" ? "Approved" : "Changes asked for"} by {last.byName}{last.onBehalf ? ` (recorded by ${builderName})` : ""} · {fmtDate(last.createdAt)}
                                {last.comment ? <span className="block mt-0.5" style={{ color: "var(--tws-ink)" }}>“{last.comment}”</span> : null}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 items-center">
                              {canDecide && <>
                                <button disabled={busy} onClick={() => send([r.id], "approved")} style={small}>Approve rev {r.rev}</button>
                                {r.status !== "changes" && <button disabled={busy} onClick={() => { setChangesFor([r.id]); setComment(""); }} style={badLine}>Request changes</button>}
                              </>}
                              {(d.revisions.length > 1 || r.decisions.length > 1) && (
                                <button onClick={() => setHistory(h => { const n = new Set(h); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} aria-expanded={history.has(d.id)} className="text-xs underline ml-auto" style={muted}>
                                  {history.has(d.id) ? "Hide history" : "History"}
                                </button>
                              )}
                            </div>
                            {history.has(d.id) && (
                              <ul className="text-xs flex flex-col gap-1.5 pl-3 m-0 list-none" style={{ ...muted, borderLeft: "3px solid var(--tws-tint)" }}>
                                {d.revisions.map(rv => (
                                  <li key={rv.id}>
                                    <a href={rv.url} target="_blank" rel="noopener" style={link}>Rev {rv.rev}</a> · {fmtDate(rv.createdAt)} · {rv.status === "superseded" ? "replaced by a newer revision" : (STATUS[rv.status]?.label ?? rv.status)}
                                    {rv.decisions.map(x => <div key={x.id}>{x.decision === "approved" ? "Approved" : "Changes asked for"} by {x.byName}{x.onBehalf ? ` (recorded by ${builderName})` : ""}, {fmtDate(x.createdAt)}{x.comment ? `: “${x.comment}”` : ""}</div>)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
