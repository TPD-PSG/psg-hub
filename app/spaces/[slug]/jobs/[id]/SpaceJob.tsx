"use client";

// One build in the space's own look: stage band, parts of the build (who, when, planned hours),
// days logged, collection or delivery, drawings and files, and (for those who see money) the
// quote against actual cost. Uses the same APIs as the Hub's job page.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { BUILD_STAGES, stageIndex } from "@/lib/buildStages";
import { PO_STATUS } from "@/lib/poStatus";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import BuildChecklist, { type Check } from "@/components/BuildChecklist";
import BuildDesign, { type JobContactRow, type JobFileRow } from "@/components/BuildDesign";
import DrawingRegister, { type DrawingRow, type Blocker } from "@/components/DrawingRegister";
import { jobTypeLabel } from "@/lib/quotes";
import { fmtDate } from "@/lib/format";
import { card, darkCard, h2, muted, link, btnSolid, btnLine, input, label as lbl, pageHeader, stageTone, dayChip } from "@/lib/twsUi";

export type PartRow = { id: number; jobId: number; label: string; userId: number | null; startDate: string | null; days: number; hours: number | null; done: boolean; user: { id: number; name: string } | null };
type Option = { id: number; name: string };
export type JobPhoto = { id: number; url: string; caption: string | null; postId: number | null; createdAt: string; uploadedById: number | null; uploadedBy: { name: string } | null };
export type JobMaterials = {
  pos: { id: number; number: string; status: string; inSage: boolean; total: number; supplierName: string | null; supplier: { name: string } | null; lines: { id: number; description: string; quantity: number; unit: string | null; unitCost: number }[] }[];
  moves: { id: number; change: number; kind: string; createdAt: string; item: { name: string; unit: string } }[];
  items: { id: number; name: string; unit: string; quantity: number }[];
};

const gbp = (n: number | null | undefined) => (n == null ? "–" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n));
const ymd = (s: string | null) => (s ? s.slice(0, 10) : "");
const today = () => new Date().toISOString().slice(0, 10);
const when = (p: PartRow) => {
  if (!p.startDate) return "Not planned";
  const s = new Date(p.startDate), e = new Date(s.getTime() + (p.days - 1) * 86400e3);
  const f = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return p.days === 1 ? f(s) : `${f(s)} – ${f(e)}`;
};
const th = "text-left font-semibold py-2 pr-3";
const td = "py-2 pr-3 align-top";

export default function SpaceJob({ space, initial, seeMoney, initialParts, people, productions, me, initialMaterials, initialPhotos, initialChecks, initialContacts, initialFiles, initialDrawings }: {
  space: SpaceTheme; initial: JobDetail; seeMoney: boolean; initialParts: PartRow[]; people: Option[]; productions: Option[]; me: { id: number; isAdmin: boolean }; initialMaterials: JobMaterials; initialPhotos: JobPhoto[]; initialChecks: Check[]; initialContacts: JobContactRow[]; initialFiles: JobFileRow[]; initialDrawings: { drawings: DrawingRow[]; blockers: Blocker[]; overrides?: { id: number; text: string; createdAt: string }[] };
}) {
  const [blockers, setBlockers] = useState(initialDrawings.blockers);
  const [gate, setGate] = useState<null | { stage: string; message: string; canOverride: boolean; reason: string }>(null);
  const [checks, setChecks] = useState(initialChecks);
  const collect = checks.filter(c => c.kind === "collect");
  const [photos, setPhotos] = useState(initialPhotos);
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  async function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of [...list].slice(0, 12)) fd.append("photos", await shrinkPhoto(f));
    if (photoCaption.trim()) fd.append("caption", photoCaption.trim());
    const res = await fetch(`/api/jobs/${initial.id}/photos`, { method: "POST", body: fd });
    setUploading(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't add the photos");
    setPhotos(d); setPhotoCaption("");
  }
  async function sharePhoto(p: JobPhoto) {
    const res = await fetch(`/api/space-photos/${p.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't share it");
    setPhotos(ps => ps.map(x => (x.id === p.id ? { ...x, postId: -1 } : x)));
  }
  async function deletePhoto(p: JobPhoto) {
    if (!(await confirmDialog("Delete this photo?"))) return;
    const res = await fetch(`/api/space-photos/${p.id}`, { method: "DELETE" });
    if (res.ok) setPhotos(ps => ps.filter(x => x.id !== p.id));
    else alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
  }
  const router = useRouter();
  const [mat, setMat] = useState(initialMaterials);
  const [markup, setMarkup] = useState("30");
  async function quoteThisBuild(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/jobs/${initial.id}/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markupPct: markup }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't start the quote");
    if (d.notes?.length) await alertDialog(`Quote ${d.number} started with ${d.lines} lines. Check: ${d.notes.join("; ")}.`);
    router.push(`/spaces/${space.slug}/quotes/${d.id}`);
  }
  const [fromStock, setFromStock] = useState({ itemId: "", quantity: "" });
  const [job, setJob] = useState(initial);
  const [parts, setParts] = useState(initialParts);
  const [busy, setBusy] = useState(false);
  const [editOut, setEditOut] = useState(false);
  const [out, setOut] = useState({ startDate: ymd(job.startDate), dueOut: ymd(job.endDate), deliveryMethod: job.deliveryMethod ?? "", deliveryNotes: job.deliveryNotes ?? "", forProductionId: job.forProduction ? String(job.forProduction.id) : "" });
  const [part, setPart] = useState({ label: "", userId: "", startDate: "", days: "1", hours: "" });
  const [time, setTime] = useState({ date: today(), days: "1", note: "" });
  const [link_, setLink] = useState({ label: "", url: "", kind: "vectorworks" });
  const base = `/spaces/${space.slug}`;
  const cur = stageIndex(job.stage);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { await alertDialog(data.error ?? "That didn't work"); return null; }
    return data;
  }
  const reload = async () => { const d = await fetch(`/api/jobs/${job.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (d?.job) setJob(d.job); };
  const reloadParts = async () => { const d = await fetch(`/api/jobs/${job.id}/parts`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (Array.isArray(d)) setParts(d); };

  const reloadMat = async () => { const d = await fetch(`/api/jobs/${job.id}/materials`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (d?.pos) setMat(d); };
  async function bookOut(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/stock/${fromStock.itemId}/moves`, "POST", { kind: "book_out", quantity: fromStock.quantity, jobId: job.id })) { setFromStock({ itemId: "", quantity: "" }); reloadMat(); reload(); }
  }
  // Moving to Build or later is blocked until the drawings are signed off; admins can override with a reason
  async function setStage(stage: string, override?: string) {
    setBusy(true);
    const res = await fetch(`/api/jobs/${job.id}/build`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(override ? { stage, override: true, overrideReason: override } : { stage }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (res.status === 409) { setGate({ stage, message: d.error, canOverride: !!d.canOverride, reason: "" }); return; }
    if (!res.ok) return alertDialog(d.error ?? "That didn't work");
    setGate(null);
    if (override) { window.location.reload(); return; } // shows the override in the sign-off log
    if (d.job) setJob(d.job);
  }
  async function saveOut(e: React.FormEvent) {
    e.preventDefault();
    const d = await call(`/api/jobs/${job.id}/build`, "PATCH", { ...out, deliveryMethod: out.deliveryMethod || null });
    if (d?.job) { setJob(d.job); setEditOut(false); }
  }
  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/jobs/${job.id}/parts`, "POST", { ...part, userId: part.userId || null, startDate: part.startDate || null, days: Number(part.days) })) {
      setPart({ label: "", userId: "", startDate: "", days: "1", hours: "" }); reloadParts();
    }
  }
  async function togglePart(p: PartRow) { if (await call(`/api/jobs/${job.id}/parts/${p.id}`, "PATCH", { done: !p.done })) reloadParts(); }
  async function removePart(p: PartRow) { if (await confirmDialog(`Delete the part "${p.label}"?`) && await call(`/api/jobs/${job.id}/parts/${p.id}`, "DELETE")) reloadParts(); }
  async function logTime(e: React.FormEvent) { e.preventDefault(); if (await call(`/api/jobs/${job.id}/time`, "POST", time)) { setTime(t => ({ ...t, note: "" })); reload(); } }
  async function removeTime(id: number) { if (await confirmDialog("Remove this time entry?") && await call(`/api/jobs/${job.id}/time/${id}`, "DELETE")) reload(); }
  async function addLink(e: React.FormEvent) { e.preventDefault(); if (await call(`/api/jobs/${job.id}/links`, "POST", link_)) { setLink({ label: "", url: "", kind: "vectorworks" }); reload(); } }
  async function removeLink(id: number) { if (await confirmDialog("Remove this link? (The file itself isn't touched.)") && await call(`/api/jobs/${job.id}/links/${id}`, "DELETE")) reload(); }

  const f = job.figures;
  const plannedHours = parts.reduce((s, p) => s + (p.hours ?? 0), 0);
  const loggedDays = job.time.reduce((s, t) => s + t.days, 0);
  const late = job.endDate && job.endDate.slice(0, 10) < today();

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-4">
        <div className="text-[13px]" style={muted}>
          <Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › <Link href={`${base}/jobs`} style={{ color: "var(--tws-accent-ink)" }}>Build jobs</Link> › {job.number}
        </div>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="break-words" style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{job.title}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={muted}>
              {job.forProduction && <span>Production: <Link href={`/productions/${job.forProduction.id}`} style={link}>{job.forProduction.name}</Link></span>}
              {job.client && <span>Client: {job.client.name}</span>}
              {initialContacts.filter(c => c.role === "designer").map(c => <span key={c.id}>Designer: {c.name}</span>)}
              <span>{jobTypeLabel(job.jobType)}</span>
              {job.status !== "active" && <strong style={{ color: "var(--tws-warn-ink)" }}>{job.status === "complete" ? "Complete" : "Cancelled"}</strong>}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href="#log-days" style={btnLine}>Log days</a>
            <Link href={`${base}/materials?new=1&job=${job.id}`} style={btnLine}>Raise PO</Link>
            <Link href={`${base}/planner`} style={btnSolid}>Open in planner</Link>
          </div>
        </div>
        <ol aria-label="Build stages" className="grid gap-1 text-[13px] font-bold grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {BUILD_STAGES.map((s, i) => {
            const state = cur >= 0 && i < cur ? "done" : i === cur ? "now" : "todo";
            const text = `${state === "done" ? "✓ " : ""}${s.label}${state === "now" ? " · now" : ""}${s.key === "delivery" && job.endDate ? ` · ${dayChip(job.endDate).toLowerCase()}` : ""}`;
            return (
              <li key={s.key}>
                <button type="button" disabled={busy || state === "now"} onClick={() => setStage(s.key)} aria-current={state === "now" ? "step" : undefined}
                  title={state === "now" ? undefined : `Move the build to ${s.label}`} className="w-full text-left px-3 py-2.5 disabled:cursor-default" style={{ ...stageTone(state), border: 0, font: "inherit", cursor: "pointer" }}>
                  {text}
                </button>
              </li>
            );
          })}
        </ol>
        {blockers.length > 0 && !gate && stageIndex(job.stage) < stageIndex("build") && (
          <p className="text-[13px]" style={{ margin: 0, color: "var(--tws-warn-ink)" }}>⚠ {blockers.length} drawing{blockers.length === 1 ? "" : "s"} still to be signed off before this can move to Build.</p>
        )}
        {gate && (
          <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
            <strong>Not yet: {gate.message}</strong>
            {gate.canOverride ? (
              <form onSubmit={e => { e.preventDefault(); if (gate.reason.trim()) setStage(gate.stage, gate.reason.trim()); }} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[240px]"><label htmlFor="gate-reason" style={lbl}>Override as an admin: why is it OK to go ahead? (logged on the build)</label>
                  <input id="gate-reason" required style={input} value={gate.reason} onChange={e => setGate({ ...gate, reason: e.target.value })} placeholder="e.g. client approved on site visit, drawings to follow" /></div>
                <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Override and move on</button>
                <button type="button" onClick={() => setGate(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button>
              </form>
            ) : <span>Get the drawings signed off first (an admin can override if needed). <button type="button" onClick={() => setGate(null)} className="underline">OK</button></span>}
          </div>
        )}
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Quote vs actual */}
          {seeMoney && f && (
            <section style={card} className="flex flex-col gap-3.5">
              <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Quote vs actual</h2><Link href={`/jobs/${job.id}`} className="text-[13px]" style={link}>Costs in detail →</Link></div>
              {/* Quotes for this build, and "Quote this build" drafted from its parts and materials */}
              <div className="flex flex-wrap items-end gap-3 justify-between p-3" style={{ background: "var(--tws-ground)" }}>
                <div className="text-sm flex flex-col gap-1 min-w-0">
                  {job.quotes.length === 0 ? <span style={muted}>No quote yet. Draft one from this build&apos;s parts (labour) and materials, at cost plus your markup.</span>
                    : job.quotes.map(q => <Link key={q.id} href={`/spaces/${space.slug}/quotes/${q.id}`} style={link}>Quote {q.number} · {q.status}</Link>)}
                </div>
                <form onSubmit={quoteThisBuild} className="flex items-end gap-2">
                  <div><label htmlFor="qb-markup" style={lbl}>Markup %</label>
                    <input id="qb-markup" type="number" min={0} max={1000} step="1" style={{ ...input, width: 80 }} value={markup} onChange={e => setMarkup(e.target.value)} /></div>
                  <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{job.quotes.length ? "New quote from plan" : "Quote this build"}</button>
                </form>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><div className="text-xs font-semibold" style={muted}>Price</div><div className="text-2xl font-extrabold tabular-nums">{gbp(f.price)}</div><div className="text-xs" style={muted}>{f.priceFrom === "quote" ? "accepted quote, ex VAT" : f.priceFrom === "agreed" ? "agreed price" : "no accepted quote yet"}</div></div>
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
          )}

          {/* Drawings for client sign-off (the build gate) */}
          <DrawingRegister jobId={initial.id} initial={initialDrawings} isAdmin={me.isAdmin} onBlockers={setBlockers} />

          {/* Design & contacts: the designer, drawings and model box */}
          <BuildDesign jobId={initial.id} initialContacts={initialContacts} initialFiles={initialFiles} me={me} />

          {/* Materials & purchase orders */}
          <section style={card} className="flex flex-col gap-3.5 min-w-0" aria-label="Materials and purchase orders">
            <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Materials &amp; purchase orders</h2>
              <Link href={`${base}/materials?new=1&job=${job.id}`} className="text-[13px]" style={link}>+ Raise PO</Link></div>
            {mat.pos.length === 0 && mat.moves.length === 0 ? <p className="text-sm" style={muted}>Nothing ordered or booked out for this build yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
                  <thead><tr className="text-xs" style={{ ...muted, borderBottom: "1px solid var(--tws-line-soft)" }}><th className={th}>Item</th><th className={th}>Qty</th><th className={th}>Supplier</th><th className={th}>PO</th><th className={th}>Status</th></tr></thead>
                  <tbody>
                    {mat.pos.flatMap(p => p.lines.map(l => (
                      <tr key={`l${l.id}`} style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                        <td className={td}>{l.description}</td><td className={td}>{l.quantity} {l.unit ?? ""}</td>
                        <td className={td}>{p.supplier?.name ?? p.supplierName ?? "–"}</td>
                        <td className={td}><Link href={`${base}/materials`} style={link}>{p.number}</Link></td>
                        <td className={td}>{p.status === "awaiting_approval" ? <strong style={{ color: "var(--tws-warn-ink)" }}>Awaiting approval</strong> : `${PO_STATUS[p.status] ?? p.status}${p.inSage ? " · in Sage" : ""}`}</td>
                      </tr>
                    )))}
                    {mat.moves.map(m => (
                      <tr key={`m${m.id}`} style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                        <td className={td}>{m.item.name}</td><td className={td}>{Math.abs(m.change)} {m.item.unit}</td>
                        <td className={td}>From stock</td><td className={td}>–</td><td className={td}>{m.kind === "return" ? "Returned to stock" : "Booked out"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {mat.items.length > 0 && (
              <form onSubmit={bookOut} className="grid gap-2 items-end pt-3 sm:grid-cols-[2fr_100px_auto]" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                <div><label htmlFor="fs-item" style={lbl}>Add from stock</label>
                  <select id="fs-item" required style={input} value={fromStock.itemId} onChange={e => setFromStock({ ...fromStock, itemId: e.target.value })}>
                    <option value="">Pick an item</option>{mat.items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} in stock)</option>)}
                  </select></div>
                <div><label htmlFor="fs-qty" style={lbl}>Quantity</label><input id="fs-qty" type="number" min={0} step="any" required style={input} value={fromStock.quantity} onChange={e => setFromStock({ ...fromStock, quantity: e.target.value })} /></div>
                <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Book out</button>
              </form>
            )}
          </section>

          {/* Parts */}
          <section style={card} className="flex flex-col gap-3.5 min-w-0">
            <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Parts of this build</h2><Link href={`${base}/planner`} className="text-[13px]" style={link}>Open in planner →</Link></div>
            {parts.length === 0 ? <p className="text-sm" style={muted}>Break the build into parts (e.g. truck frames, flats and doors, paint) so the team can plan them.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
                  <thead><tr className="text-xs" style={{ ...muted, borderBottom: "1px solid var(--tws-line-soft)" }}><th className={th}>Done</th><th className={th}>Part</th><th className={th}>Who</th><th className={th}>When</th><th className={th}>Planned hours</th><th /></tr></thead>
                  <tbody>
                    {parts.map(p => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--tws-line-soft)", opacity: p.done ? 0.6 : 1 }}>
                        <td className={td}><input type="checkbox" checked={p.done} onChange={() => togglePart(p)} aria-label={`${p.label} done`} className="w-4 h-4 mt-0.5" /></td>
                        <td className={td} style={{ textDecoration: p.done ? "line-through" : undefined }}>{p.label}</td>
                        <td className={td}>{p.user?.name ?? <span style={muted}>Nobody yet</span>}</td>
                        <td className={td}>{when(p)}{p.days > 1 ? ` (${p.days}d)` : ""}</td>
                        <td className={`${td} tabular-nums`}>{p.hours ?? "–"}</td>
                        <td className={`${td} text-right`}><button type="button" onClick={() => removePart(p)} aria-label={`Delete part ${p.label}`} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }}>Delete</button></td>
                      </tr>
                    ))}
                    <tr className="font-extrabold"><td /><td className={td}>Total</td><td /><td className={td}>{loggedDays} day{loggedDays === 1 ? "" : "s"} logged</td><td className={`${td} tabular-nums`}>{plannedHours || "–"}</td><td /></tr>
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={addPart} className="grid gap-2 items-end pt-3 sm:grid-cols-[1.5fr_1.2fr_1fr_70px_80px_auto]" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
              <div><label htmlFor="p-label" style={lbl}>Part</label><input id="p-label" required style={input} value={part.label} onChange={e => setPart({ ...part, label: e.target.value })} placeholder="e.g. Flats and doors" /></div>
              <div><label htmlFor="p-who" style={lbl}>Who</label>
                <select id="p-who" style={input} value={part.userId} onChange={e => setPart({ ...part, userId: e.target.value })}><option value="">Plan later</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label htmlFor="p-start" style={lbl}>Starts</label><input id="p-start" type="date" style={input} value={part.startDate} onChange={e => setPart({ ...part, startDate: e.target.value })} /></div>
              <div><label htmlFor="p-days" style={lbl}>Days</label><input id="p-days" type="number" min={1} max={60} required style={input} value={part.days} onChange={e => setPart({ ...part, days: e.target.value })} /></div>
              <div><label htmlFor="p-hours" style={lbl}>Hours</label><input id="p-hours" type="number" min={0} step="0.5" style={input} value={part.hours} onChange={e => setPart({ ...part, hours: e.target.value })} /></div>
              <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Add part</button>
            </form>
          </section>

          {/* Days logged */}
          <section id="log-days" style={card} className="flex flex-col gap-3.5 scroll-mt-20">
            <h2 style={h2}>Days logged</h2>
            <form onSubmit={logTime} className="grid gap-2 items-end sm:grid-cols-[1fr_90px_2fr_auto]">
              <div><label htmlFor="t-date" style={lbl}>Date</label><input id="t-date" type="date" required style={input} value={time.date} onChange={e => setTime({ ...time, date: e.target.value })} /></div>
              <div><label htmlFor="t-days" style={lbl}>Days</label>
                <select id="t-days" style={input} value={time.days} onChange={e => setTime({ ...time, days: e.target.value })}>{[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label htmlFor="t-note" style={lbl}>Note</label><input id="t-note" style={input} value={time.note} onChange={e => setTime({ ...time, note: e.target.value })} placeholder="e.g. rostra and trial fit" /></div>
              <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Log days</button>
            </form>
            {job.time.length === 0 ? <p className="text-sm" style={muted}>No days logged yet.</p> : (
              <ul className="flex flex-col">
                {job.time.map(t => (
                  <li key={t.id} className="py-2 flex justify-between gap-3 text-sm group" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                    <span><strong>{t.user.name}</strong> · {t.days} day{t.days === 1 ? "" : "s"} <span style={muted}>· {fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</span></span>
                    {(t.userId === me.id || me.isAdmin) && <button type="button" onClick={() => removeTime(t.id)} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }} aria-label="Remove time entry">Remove</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {/* Collection / delivery */}
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

          {/* Snags & tasks */}
          <section style={card} className="flex flex-col gap-2.5" aria-label="Snags and tasks">
            <h2 style={h2}>Snags &amp; tasks <span className="text-sm font-medium" style={muted}>{checks.filter(c => c.kind === "snag").length ? `${checks.filter(c => c.kind === "snag" && c.done).length}/${checks.filter(c => c.kind === "snag").length}` : ""}</span></h2>
            <BuildChecklist jobId={job.id} kind="snag" checks={checks} onChange={setChecks} placeholder="e.g. Trial fit of flats before paint" />
          </section>

          {/* Build photos */}
          <section style={card} className="flex flex-col gap-2.5" aria-label="Build photos">
            <h2 style={h2}>Build photos</h2>
            {photos.length === 0 ? <p className="text-sm" style={muted}>No photos yet. Photos added this month put the build up for build of the month.</p> : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map(p => (
                  <figure key={p.id} className="flex flex-col gap-1 group" style={{ margin: 0 }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                      <img src={p.url} alt={p.caption ?? `${job.title} build photo`} loading="lazy" className="w-full h-24 object-cover" style={{ background: "var(--tws-tint)" }} />
                    </a>
                    <figcaption className="text-[11px] flex justify-between gap-1" style={muted}>
                      <span className="truncate">{p.caption ?? p.uploadedBy?.name ?? ""}</span>
                      <span className="flex gap-2 shrink-0">
                        {p.postId ? <span>On board</span> : <button type="button" onClick={() => sharePhoto(p)} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Share</button>}
                        {(p.uploadedById === me.id || me.isAdmin) && <button type="button" onClick={() => deletePhoto(p)} aria-label="Delete photo" style={{ color: "var(--tws-bad-ink)" }}>✕</button>}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
              <div><label htmlFor="ph-cap" style={lbl}>Caption (optional)</label><input id="ph-cap" style={input} value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="e.g. Truck frames welded" /></div>
              <label className="text-center cursor-pointer text-sm font-bold py-2.5" style={{ border: "2px solid var(--tws-char)", opacity: uploading ? 0.5 : 1 }}>
                {uploading ? "Uploading…" : "+ Add photos"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
              <Link href={`${base}/noticeboard`} className="text-[13px] font-semibold" style={link}>Noticeboard →</Link>
            </div>
          </section>

          {/* Drawings & files */}
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
        </div>
      </div>
    </>
  );
}
