"use client";

// Edit a quote: header, line items (our cost and the sell price), live totals and margin,
// status, PDF for the client, and "Save as template".
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { JOB_TYPES, quoteTotals } from "@/lib/quotes";
import { downloadQuotePDF } from "@/lib/quotePdf";
import { fmtDate } from "@/lib/format";
import { STATUS_STYLE } from "../QuotesView";

export type Option = { id: number; name: string };
type Line = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number };
export type QuoteDetail = {
  id: number; number: string; title: string; jobType: string; status: string; vatRate: number;
  validUntil: string | null; terms: string | null; internalNotes: string | null; createdAt: string; sentAt: string | null; decidedAt: string | null;
  entity: Option | null; client: (Option & { billingName: string | null; billingAddress: string | null; billingEmail: string | null; address: string | null }) | null;
  opportunity: { id: number; title: string; stage: string } | null; job: { id: number; number: string; title: string } | null;
  createdBy: Option | null; lines: Line[];
};
type Row = { section: string; description: string; quantity: string; unit: string; unitCost: string; unitPrice: string };

const inp = "w-full rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const toRow = (l: Line): Row => ({ section: l.section ?? "", description: l.description, quantity: String(l.quantity), unit: l.unit ?? "", unitCost: String(l.unitCost), unitPrice: String(l.unitPrice) });
const num = (s: string) => (s.trim() === "" ? 0 : Number(s) || 0);
const BLANK_ROW: Row = { section: "", description: "", quantity: "1", unit: "", unitCost: "", unitPrice: "" };

export default function QuoteEditor({ initial, entities, clients, deals }: { initial: QuoteDetail; entities: Option[]; clients: Option[]; deals: Option[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [head, setHead] = useState({
    title: initial.title, jobType: initial.jobType, entityId: initial.entity ? String(initial.entity.id) : "", clientId: initial.client ? String(initial.client.id) : "",
    opportunityId: initial.opportunity ? String(initial.opportunity.id) : "", vatRate: String(initial.vatRate),
    validUntil: initial.validUntil?.slice(0, 10) ?? "", terms: initial.terms ?? "", internalNotes: initial.internalNotes ?? "",
  });
  const [rows, setRows] = useState<Row[]>(initial.lines.length ? initial.lines.map(toRow) : [{ ...BLANK_ROW }]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const setH = (patch: Partial<typeof head>) => { setHead(h => ({ ...h, ...patch })); setDirty(true); };
  const setRow = (i: number, patch: Partial<Row>) => { setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); setDirty(true); };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const c = [...rows];
    [c[i], c[j]] = [c[j], c[i]];
    setRows(c); setDirty(true);
  };

  const liveLines = rows.filter(r => r.description.trim()).map(r => ({ quantity: num(r.quantity), unitCost: num(r.unitCost), unitPrice: num(r.unitPrice) }));
  const t = quoteTotals(liveLines, Number(head.vatRate) || 0);

  async function put(extra: Record<string, unknown> = {}) {
    setSaving(true);
    const res = await fetch(`/api/quotes/${q.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...head, lines: rows.filter(r => r.description.trim()), ...extra }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { await alertDialog(body.error ?? "Couldn't save the quote"); return null; }
    setQ(body); setDirty(false);
    return body as QuoteDetail;
  }

  async function setStatus(status: string) {
    if (status === "accepted" && !await confirmDialog("Mark this quote accepted? Its price becomes the job's price.")) return;
    await put({ status });
  }
  async function pdf() {
    const saved = dirty ? await put() : q;
    if (saved) await downloadQuotePDF(saved);
  }
  // "Save as template" opens a small inline form, named after the quote to start with
  const [tplName, setTplName] = useState<string | null>(null);
  const saveTemplate = () => setTplName(q.title);
  async function confirmTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplName?.trim()) return;
    if (dirty && !(await put())) return;
    const res = await fetch("/api/quote-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: q.id, name: tplName }) });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't save the template");
    setTplName(null);
    await alertDialog("Saved. It's now offered when you start a new quote.");
  }
  async function remove() {
    if (!await confirmDialog(`Delete quote ${q.number}? This can't be undone.`)) return;
    const res = await fetch(`/api/quotes/${q.id}`, { method: "DELETE" });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
    router.push("/bd/quotes");
  }

  const st = STATUS_STYLE[q.status];
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href="/bd/quotes" className="text-xs" style={{ color: "var(--psg-muted)" }}>← Quotes</Link>
          <h1 className="text-2xl font-bold text-white mt-1 break-words">{q.number}</h1>
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
            <span style={{ color: st?.color }}>{st?.label ?? q.status}</span>
            {q.sentAt && ` · sent ${fmtDate(q.sentAt)}`}{q.decidedAt && ` · ${q.status} ${fmtDate(q.decidedAt)}`}
            {q.createdBy && ` · by ${q.createdBy.name}`}
            {q.job && <> · job <Link href={`/jobs/${q.job.id}`} className="text-blue-400">{q.job.number}</Link></>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => put()} disabled={saving || !dirty} className="text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-40" style={{ backgroundColor: "var(--psg-blue)" }}>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>
          <button type="button" onClick={pdf} className="border px-3 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>PDF for client</button>
          {q.status === "draft" && <button type="button" onClick={() => setStatus("sent")} className="border px-3 py-2 rounded text-sm" style={{ borderColor: "#5b8def", color: "#5b8def" }}>Mark sent</button>}
          {(q.status === "sent" || q.status === "draft") && <>
            <button type="button" onClick={() => setStatus("accepted")} className="border px-3 py-2 rounded text-sm" style={{ borderColor: "#1fae7a", color: "#1fae7a" }}>Accepted</button>
            <button type="button" onClick={() => setStatus("declined")} className="border px-3 py-2 rounded text-sm" style={{ borderColor: "#f87171", color: "#f87171" }}>Declined</button>
          </>}
          {(q.status === "accepted" || q.status === "declined") && <button type="button" onClick={() => setStatus("sent")} className="text-xs" style={{ color: "var(--psg-muted)" }}>Reopen</button>}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-lg border p-4 grid gap-3 md:grid-cols-3" style={card}>
        <div className="md:col-span-3"><label htmlFor="q-title" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Title (on the PDF)</label>
          <input id="q-title" className={inp} style={inpStyle} value={head.title} onChange={e => setH({ title: e.target.value })} /></div>
        <div><label htmlFor="q-client" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Client</label>
          <select id="q-client" className={inp} style={inpStyle} value={head.clientId} onChange={e => setH({ clientId: e.target.value })}>
            <option value="">— None —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label htmlFor="q-deal" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>BD deal</label>
          <select id="q-deal" className={inp} style={inpStyle} value={head.opportunityId} onChange={e => setH({ opportunityId: e.target.value })}>
            <option value="">— None —</option>{deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div><label htmlFor="q-entity" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Company (on the PDF)</label>
          <select id="q-entity" className={inp} style={inpStyle} value={head.entityId} onChange={e => setH({ entityId: e.target.value })}>
            <option value="">Production Solutions Group</option>{entities.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
          </select></div>
        <div><label htmlFor="q-type" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type of work</label>
          <select id="q-type" className={inp} style={inpStyle} value={head.jobType} onChange={e => setH({ jobType: e.target.value })}>
            {JOB_TYPES.map(jt => <option key={jt.key} value={jt.key}>{jt.label}</option>)}
          </select></div>
        <div><label htmlFor="q-valid" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Valid until</label>
          <input id="q-valid" type="date" className={inp} style={inpStyle} value={head.validUntil} onChange={e => setH({ validUntil: e.target.value })} /></div>
        <div><label htmlFor="q-vat" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>VAT %</label>
          <input id="q-vat" type="number" min={0} max={100} step="0.5" className={inp} style={inpStyle} value={head.vatRate} onChange={e => setH({ vatRate: e.target.value })} /></div>
      </div>

      {/* Lines */}
      <div className="rounded-lg border overflow-x-auto" style={card}>
        <table className="w-full text-sm" style={{ minWidth: 980 }}>
          <thead>
            <tr className="text-xs" style={{ color: "var(--psg-muted)" }}>
              <th className="text-left font-medium px-2 py-2 w-36">Section</th><th className="text-left font-medium px-2 py-2">Description *</th>
              <th className="text-left font-medium px-2 py-2 w-20">Qty</th><th className="text-left font-medium px-2 py-2 w-24">Unit</th>
              <th className="text-left font-medium px-2 py-2 w-28" title="What it costs us (not on the PDF)">Our cost</th><th className="text-left font-medium px-2 py-2 w-28">Price</th>
              <th className="text-right font-medium px-2 py-2 w-28">Line total</th><th className="text-right font-medium px-2 py-2 w-20">Margin</th><th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const total = num(r.quantity) * num(r.unitPrice), cost = num(r.quantity) * num(r.unitCost);
              const m = total ? Math.round(((total - cost) / total) * 100) : null;
              return (
                <tr key={i} className="border-t align-top" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="px-2 py-1.5"><input aria-label="Section" list="q-sections" className={inp} style={inpStyle} value={r.section} onChange={e => setRow(i, { section: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Description" className={inp} style={inpStyle} value={r.description} onChange={e => setRow(i, { description: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Quantity" type="number" step="any" className={inp} style={inpStyle} value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Unit" list="q-units" className={inp} style={inpStyle} value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Our cost each" type="number" step="any" className={inp} style={inpStyle} value={r.unitCost} onChange={e => setRow(i, { unitCost: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Price each" type="number" step="any" className={inp} style={inpStyle} value={r.unitPrice} onChange={e => setRow(i, { unitPrice: e.target.value })} /></td>
                  <td className="px-2 py-2 text-right text-white tabular-nums">{gbp(total)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs" style={{ color: m != null && m < 0 ? "#f87171" : "var(--psg-muted)" }}>{m == null ? "—" : `${m}%`}</td>
                  <td className="px-1 py-2 whitespace-nowrap text-xs">
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)} style={{ color: "var(--psg-muted)" }}>↑</button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="ml-1" style={{ color: "var(--psg-muted)" }}>↓</button>
                    <button type="button" aria-label="Remove line" onClick={() => { setRows(rs => rs.filter((_, j) => j !== i)); setDirty(true); }} className="ml-2 text-red-400">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="q-sections">{[...new Set(rows.map(r => r.section).filter(Boolean))].concat(["Pre-production", "Fit-up", "Running", "Get-out", "Materials", "Labour", "Transport"]).map(s => <option key={s} value={s} />)}</datalist>
        <datalist id="q-units">{["day", "days", "week", "weeks", "each", "hour", "hours", "load", "mile"].map(u => <option key={u} value={u} />)}</datalist>
        <div className="px-3 py-2 border-t flex justify-between" style={{ borderColor: "var(--psg-card-border)" }}>
          <button type="button" onClick={() => { setRows(rs => [...rs, { ...BLANK_ROW, section: rs[rs.length - 1]?.section ?? "" }]); setDirty(true); }} className="text-xs text-blue-400">+ Add line</button>
          <span className="text-xs" style={{ color: "var(--psg-muted)" }}>&ldquo;Our cost&rdquo; and margin never appear on the PDF.</span>
        </div>
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-5">
        <div className="space-y-3">
          <div><label htmlFor="q-terms" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Terms (on the PDF)</label>
            <textarea id="q-terms" rows={4} className={inp} style={inpStyle} value={head.terms} onChange={e => setH({ terms: e.target.value })} placeholder="e.g. Fee payable 30% on signing, 40% at fit-up, 30% on opening." /></div>
          <div><label htmlFor="q-notes" className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Internal notes (not on the PDF)</label>
            <textarea id="q-notes" rows={2} className={inp} style={inpStyle} value={head.internalNotes} onChange={e => setH({ internalNotes: e.target.value })} /></div>
        </div>
        <div className="rounded-lg border p-4 text-sm space-y-1.5 self-start" style={card}>
          {[["Our cost", t.cost], ["Price (ex VAT)", t.net], [`VAT ${Number(head.vatRate) || 0}%`, t.vat]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between"><span style={{ color: "var(--psg-muted)" }}>{l}</span><span className="text-white tabular-nums">{gbp(v as number)}</span></div>
          ))}
          <div className="flex justify-between border-t pt-1.5 font-semibold" style={{ borderColor: "var(--psg-card-border)" }}><span className="text-white">Total</span><span className="text-white tabular-nums">{gbp(t.gross)}</span></div>
          <div className="flex justify-between pt-1.5"><span style={{ color: "var(--psg-muted)" }}>Margin</span>
            <span className="tabular-nums font-semibold" style={{ color: t.margin < 0 ? "#f87171" : "#1fae7a" }}>{gbp(t.margin)}{t.marginPct != null ? ` · ${Math.round(t.marginPct)}%` : ""}</span></div>
        </div>
      </div>

      <div className="flex gap-4 items-center flex-wrap text-sm">
        {tplName === null ? (
          <button type="button" onClick={saveTemplate} className="text-blue-400">Save as template</button>
        ) : (
          <form onSubmit={confirmTemplate} className="flex gap-2 items-center">
            <input aria-label="Template name" autoFocus className={inp} style={{ ...inpStyle, width: 280 }} value={tplName} onChange={e => setTplName(e.target.value)} />
            <button type="submit" className="text-white px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>Save template</button>
            <button type="button" onClick={() => setTplName(null)} style={{ color: "var(--psg-muted)" }}>Cancel</button>
          </form>
        )}
        {q.opportunity && <Link href="/bd" className="text-blue-400">Deal: {q.opportunity.title}</Link>}
        {q.client && <Link href={`/bd/clients/${q.client.id}`} className="text-blue-400">Client: {q.client.name}</Link>}
        <button type="button" onClick={remove} className="text-red-400 ml-auto">Delete quote</button>
      </div>
    </div>
  );
}
