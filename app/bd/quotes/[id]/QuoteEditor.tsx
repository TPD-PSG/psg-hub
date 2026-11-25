"use client";

// Edit a quote: header, line items (our cost and the sell price), live totals and margin,
// status, PDF for the client, and "Save as template". Workshop feedback (27 Nov 2026): an
// "Add a line" bar that clears after each line, stock and last-paid-price lookup, units that
// follow the section, insert a line anywhere, section subtotals, a running total, and Preview.
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { JOB_TYPES, quoteTotals } from "@/lib/quotes";
import { downloadQuotePDF, quotePdfUrl } from "@/lib/quotePdf";
import { QUOTE_SECTIONS, unitsFor } from "@/lib/quoteUnits";
import { fmtDate } from "@/lib/format";
import { STATUS_STYLE } from "../QuotesView";

export type Option = { id: number; name: string };
type Line = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number };
export type QuoteDetail = {
  id: number; number: string; title: string; jobType: string; status: string; vatRate: number;
  validUntil: string | null; terms: string | null; internalNotes: string | null; showSubtotals?: boolean; createdAt: string; sentAt: string | null; decidedAt: string | null;
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
type Lookup = {
  stock: { id: number; name: string; unit: string; quantity: number; unitCost: number | null; section: string | null; supplier: string | null }[];
  recent: { description: string; unit: string | null; unitCost: number; supplier: string | null; poNumber: string; date: string }[];
};
const qtyFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));
const sameSection = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// listHref/jobsBase: inside a company space the editor's links stay in that space
export default function QuoteEditor({ initial, entities, clients, deals, listHref = "/bd/quotes", jobsBase = "/jobs" }: {
  initial: QuoteDetail; entities: Option[]; clients: Option[]; deals: Option[]; listHref?: string; jobsBase?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [head, setHead] = useState({
    title: initial.title, jobType: initial.jobType, entityId: initial.entity ? String(initial.entity.id) : "", clientId: initial.client ? String(initial.client.id) : "",
    opportunityId: initial.opportunity ? String(initial.opportunity.id) : "", vatRate: String(initial.vatRate),
    validUntil: initial.validUntil?.slice(0, 10) ?? "", terms: initial.terms ?? "", internalNotes: initial.internalNotes ?? "",
    showSubtotals: !!initial.showSubtotals,
  });
  const [rows, setRows] = useState<Row[]>(initial.lines.map(toRow));
  // The "Add a line" bar: fill it in, press Add (or Enter), it joins the quote and the boxes clear
  const [entry, setEntry] = useState<Row>({ ...BLANK_ROW, section: initial.lines[initial.lines.length - 1]?.section ?? "" });
  const [insertAt, setInsertAt] = useState<number | null>(null); // add the next line below this row instead of at the end
  const [markup, setMarkup] = useState("30");
  const [found, setFound] = useState<Lookup | null>(null);
  const [inStock, setInStock] = useState<{ quantity: number; unit: string } | null>(null);
  const [searching, setSearching] = useState(false); // only search while someone is typing the description
  const descRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
  const priced = (cost: number) => Math.round(cost * (1 + (Number(markup) || 0) / 100) * 100) / 100;

  // Section subtotals: shown after the last line of each section
  const sectionNames: string[] = [];
  for (const r of rows) if (r.description.trim() && !sectionNames.some(x => sameSection(x, r.section))) sectionNames.push(r.section);
  const subtotal = (sec: string) => rows.filter(r => r.description.trim() && sameSection(r.section, sec))
    .reduce((a, r) => ({ cost: a.cost + num(r.quantity) * num(r.unitCost), price: a.price + num(r.quantity) * num(r.unitPrice) }), { cost: 0, price: 0 });
  const lastOfSection = (i: number) => sectionNames.length > 1 && rows[i].description.trim() && !rows.slice(i + 1).some(r => r.description.trim() && sameSection(r.section, rows[i].section));

  // Look up stock and last-paid prices as the description is typed
  useEffect(() => {
    const text = entry.description.trim();
    if (text.length < 2 || !searching) return; // the list only shows for 2+ typed characters (see below)
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/quotes/lookup?q=${encodeURIComponent(text)}${head.entityId ? `&entityId=${head.entityId}` : ""}`, { signal: ctl.signal })
        .then(r => (r.ok ? r.json() : null)).then(d => setFound(d && (d.stock.length || d.recent.length) ? d : null)).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [entry.description, head.entityId, searching]);

  function pick(fill: { description: string; unit: string | null; unitCost: number | null; section?: string | null }, stock?: { quantity: number; unit: string }) {
    const cost = fill.unitCost ?? 0;
    setEntry(e => ({ ...e, description: fill.description, unit: fill.unit ?? e.unit, unitCost: cost ? String(cost) : e.unitCost, unitPrice: cost ? String(priced(cost)) : e.unitPrice, section: fill.section || e.section }));
    setInStock(stock ?? null);
    setFound(null); setSearching(false);
  }
  function addEntry(e?: React.FormEvent) {
    e?.preventDefault();
    if (!entry.description.trim()) { descRef.current?.focus(); return; }
    const row: Row = { ...entry, unitPrice: entry.unitPrice.trim() === "" && entry.unitCost.trim() !== "" ? String(priced(num(entry.unitCost))) : entry.unitPrice };
    setRows(rs => (insertAt == null ? [...rs, row] : [...rs.slice(0, insertAt + 1), row, ...rs.slice(insertAt + 1)]));
    if (insertAt != null) setInsertAt(insertAt + 1); // keep adding below the line just added
    setDirty(true);
    setEntry({ ...BLANK_ROW, section: entry.section }); // clear the boxes, keep the section
    setInStock(null); setFound(null); setSearching(false);
    descRef.current?.focus();
  }
  async function showPreview() {
    const saved = dirty ? await put() : q;
    if (saved) setPreview(await quotePdfUrl(saved));
  }
  function closePreview() { if (preview) URL.revokeObjectURL(preview); setPreview(null); }

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
    router.push(listHref);
  }

  const st = STATUS_STYLE[q.status];
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href={listHref} className="text-xs" style={{ color: "var(--psg-muted)" }}>← Quotes</Link>
          <h1 className="text-2xl font-bold text-white mt-1 break-words">{q.number}</h1>
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
            <span style={{ color: st?.color }}>{st?.label ?? q.status}</span>
            {q.sentAt && ` · sent ${fmtDate(q.sentAt)}`}{q.decidedAt && ` · ${q.status} ${fmtDate(q.decidedAt)}`}
            {q.createdBy && ` · by ${q.createdBy.name}`}
            {q.job && <> · job <Link href={`${jobsBase}/${q.job.id}`} className="text-blue-400">{q.job.number}</Link></>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => put()} disabled={saving || !dirty} className="text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-40" style={{ backgroundColor: "var(--psg-blue)" }}>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>
          <button type="button" onClick={showPreview} className="border px-3 py-2 rounded text-sm hover:bg-white/5 text-white" style={{ borderColor: "var(--psg-card-border)" }}>Preview</button>
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
              const sub = lastOfSection(i) ? subtotal(r.section) : null;
              return (
                <Fragment key={i}>
                <tr className="border-t align-top" style={{ borderColor: "var(--psg-card-border)", ...(insertAt === i ? { boxShadow: "inset 0 -2px 0 #5b8def" } : {}) }}>
                  <td className="px-2 py-1.5"><input aria-label="Section" list="q-sections" className={inp} style={inpStyle} value={r.section} onChange={e => setRow(i, { section: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Description" className={inp} style={inpStyle} value={r.description} onChange={e => setRow(i, { description: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Quantity" type="number" step="any" className={inp} style={inpStyle} value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Unit" list={`q-units-${i}`} className={inp} style={inpStyle} value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} />
                    <datalist id={`q-units-${i}`}>{unitsFor(r.section).map(u => <option key={u} value={u} />)}</datalist></td>
                  <td className="px-2 py-1.5"><input aria-label="Our cost each" type="number" step="any" className={inp} style={inpStyle} value={r.unitCost} onChange={e => setRow(i, { unitCost: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Price each" type="number" step="any" className={inp} style={inpStyle} value={r.unitPrice} onChange={e => setRow(i, { unitPrice: e.target.value })} /></td>
                  <td className="px-2 py-2 text-right text-white tabular-nums">{gbp(total)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs" style={{ color: m != null && m < 0 ? "#f87171" : "var(--psg-muted)" }}>{m == null ? "—" : `${m}%`}</td>
                  <td className="px-1 py-2 whitespace-nowrap text-xs">
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)} style={{ color: "var(--psg-muted)" }}>↑</button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="ml-1" style={{ color: "var(--psg-muted)" }}>↓</button>
                    <button type="button" aria-label="Add a line below this one" title="Add the next line below this one" onClick={() => { setInsertAt(insertAt === i ? null : i); setEntry(en => ({ ...en, section: r.section })); descRef.current?.focus(); }} className="ml-2" style={{ color: insertAt === i ? "#5b8def" : "var(--psg-muted)" }}>＋</button>
                    <button type="button" aria-label="Remove line" onClick={() => { setRows(rs => rs.filter((_, j) => j !== i)); setInsertAt(null); setDirty(true); }} className="ml-2 text-red-400">×</button>
                  </td>
                </tr>
                {sub && (
                  <tr className="text-xs" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <td colSpan={4} className="px-2 py-1.5 text-right font-medium">{r.section || "No section"} subtotal</td>
                    <td className="px-2 py-1.5 tabular-nums">{gbp(sub.cost)}</td><td />
                    <td className="px-2 py-1.5 text-right tabular-nums text-white font-semibold">{gbp(sub.price)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{sub.price ? `${Math.round(((sub.price - sub.cost) / sub.price) * 100)}%` : "—"}</td><td />
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <datalist id="q-sections">{[...new Set([...rows.map(r => r.section).filter(Boolean), ...QUOTE_SECTIONS])].map(s => <option key={s} value={s} />)}</datalist>
        {rows.length === 0 && <p className="px-3 py-4 text-sm" style={{ color: "var(--psg-muted)" }}>No lines yet. Add the first one below.</p>}

        {/* Add a line */}
        <form onSubmit={addEntry} className="border-t p-3 space-y-2" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(91,141,239,0.06)" }} aria-label="Add a line">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-white">{insertAt == null ? "Add a line" : `Add a line below line ${insertAt + 1}`}{insertAt != null && <button type="button" onClick={() => setInsertAt(null)} className="ml-2 font-normal text-blue-400">add at the end instead</button>}</span>
            <label className="text-xs flex items-center gap-1.5" style={{ color: "var(--psg-muted)" }}>Markup on cost
              <input aria-label="Markup percent" type="number" step="any" className={inp} style={{ ...inpStyle, width: 64 }} value={markup} onChange={e => setMarkup(e.target.value)} />%</label>
          </div>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-[9rem_minmax(0,1fr)_5rem_6rem_7rem_7rem_auto] items-start">
            <input aria-label="New line section" list="q-sections" placeholder="Section" className={inp} style={inpStyle} value={entry.section} onChange={e => setEntry({ ...entry, section: e.target.value })} />
            <div className="relative col-span-2 md:col-span-1">
              <input ref={descRef} aria-label="New line description" placeholder="Description: type to search stock and past prices" autoComplete="off" className={inp} style={inpStyle}
                value={entry.description} onChange={e => { setEntry({ ...entry, description: e.target.value }); setInStock(null); setSearching(true); }}
                onKeyDown={e => { if (e.key === "Escape") { setFound(null); setSearching(false); } }} />
              {found && searching && entry.description.trim().length >= 2 && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded border shadow-xl max-h-72 overflow-y-auto text-xs" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }} role="listbox" aria-label="Stock and past prices">
                  {found.stock.length > 0 && <div className="px-2 pt-2 pb-1 uppercase tracking-wider text-[10px]" style={{ color: "var(--psg-muted)" }}>In stock</div>}
                  {found.stock.map(st => (
                    <button key={`s${st.id}`} type="button" role="option" aria-selected={false} onClick={() => pick({ description: st.name, unit: st.unit, unitCost: st.unitCost, section: st.section }, { quantity: st.quantity, unit: st.unit })}
                      className="w-full text-left px-2 py-1.5 hover:bg-white/10 flex justify-between gap-3">
                      <span className="text-white truncate">{st.name}{st.section ? <span style={{ color: "var(--psg-muted)" }}> · {st.section}</span> : null}</span>
                      <span className="shrink-0 tabular-nums" style={{ color: "var(--psg-muted)" }}>{qtyFmt(st.quantity)} {st.unit} in stock{st.unitCost != null ? ` · ${gbp(st.unitCost)}/${st.unit}` : ""}</span>
                    </button>
                  ))}
                  {found.recent.length > 0 && <div className="px-2 pt-2 pb-1 uppercase tracking-wider text-[10px]" style={{ color: "var(--psg-muted)" }}>Last paid (purchase orders)</div>}
                  {found.recent.map(rc => (
                    <button key={`r${rc.poNumber}${rc.description}`} type="button" role="option" aria-selected={false} onClick={() => pick({ description: rc.description, unit: rc.unit, unitCost: rc.unitCost })}
                      className="w-full text-left px-2 py-1.5 hover:bg-white/10 flex justify-between gap-3">
                      <span className="text-white truncate">{rc.description}</span>
                      <span className="shrink-0 tabular-nums" style={{ color: "var(--psg-muted)" }}>{gbp(rc.unitCost)}{rc.unit ? `/${rc.unit}` : ""} · {rc.supplier ?? "supplier"} · {fmtDate(rc.date)}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setFound(null); setSearching(false); }} className="w-full text-left px-2 py-1.5 border-t" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Custom line: keep what I typed</button>
                </div>
              )}
            </div>
            <input aria-label="New line quantity" type="number" step="any" placeholder="Qty" className={inp} style={inpStyle} value={entry.quantity} onChange={e => setEntry({ ...entry, quantity: e.target.value })} />
            <div>
              <input aria-label="New line unit" list="q-entry-units" placeholder="Unit" className={inp} style={inpStyle} value={entry.unit} onChange={e => setEntry({ ...entry, unit: e.target.value })} />
              <datalist id="q-entry-units">{unitsFor(entry.section).map(u => <option key={u} value={u} />)}</datalist>
            </div>
            <input aria-label="New line our cost each" type="number" step="any" placeholder="Our cost" className={inp} style={inpStyle} value={entry.unitCost}
              onChange={e => setEntry({ ...entry, unitCost: e.target.value })} />
            <input aria-label="New line price each" type="number" step="any" className={inp} style={inpStyle} value={entry.unitPrice}
              placeholder={entry.unitCost.trim() ? `${priced(num(entry.unitCost))}` : "Price"} onChange={e => setEntry({ ...entry, unitPrice: e.target.value })} />
            <button type="submit" className="text-white px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap" style={{ backgroundColor: "var(--psg-blue)" }}>Add line</button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--psg-muted)" }}>
            {unitsFor(entry.section).length > 0 && entry.section && <span>Units for {entry.section}: {unitsFor(entry.section).join(", ")}</span>}
            {inStock && <span style={{ color: num(entry.quantity) > inStock.quantity ? "#fbbf24" : undefined }}>{qtyFmt(inStock.quantity)} {inStock.unit} in stock{num(entry.quantity) > inStock.quantity ? ": not enough for this quantity" : ""}</span>}
            {entry.unitCost.trim() && !entry.unitPrice.trim() && <span>Price left blank = cost + {Number(markup) || 0}% ({gbp(priced(num(entry.unitCost)))})</span>}
            <span className="ml-auto">&ldquo;Our cost&rdquo; and margin never appear on the PDF. Enter adds the line.</span>
          </div>
        </form>
      </div>

      {/* Running totals, always in view while building the quote */}
      <div className="sticky bottom-0 z-20 rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm shadow-xl" style={{ ...card, backgroundColor: "var(--psg-card-bg)" }} aria-label="Running totals">
        <span><span style={{ color: "var(--psg-muted)" }}>Lines </span><span className="text-white tabular-nums">{liveLines.length}</span></span>
        <span><span style={{ color: "var(--psg-muted)" }}>Our cost </span><span className="text-white tabular-nums">{gbp(t.cost)}</span></span>
        <span><span style={{ color: "var(--psg-muted)" }}>Price </span><span className="text-white tabular-nums font-semibold">{gbp(t.net)}</span></span>
        <span><span style={{ color: "var(--psg-muted)" }}>Margin </span><span className="tabular-nums font-semibold" style={{ color: t.margin < 0 ? "#f87171" : "#1fae7a" }}>{gbp(t.margin)}{t.marginPct != null ? ` · ${Math.round(t.marginPct)}%` : ""}</span></span>
        <span className="ml-auto"><span style={{ color: "var(--psg-muted)" }}>Total inc VAT </span><span className="text-white tabular-nums font-semibold">{gbp(t.gross)}</span></span>
        {dirty && <button type="button" onClick={() => put()} disabled={saving} className="text-white px-3 py-1 rounded text-xs font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>{saving ? "Saving…" : "Save"}</button>}
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
          <label className="flex items-center gap-2 pt-2 text-xs cursor-pointer" style={{ color: "var(--psg-muted)" }}>
            <input type="checkbox" checked={head.showSubtotals} onChange={e => setH({ showSubtotals: e.target.checked })} />Show section subtotals on the PDF
          </label>
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

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col p-3 sm:p-6" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-label="Quote preview"
          onKeyDown={e => { if (e.key === "Escape") closePreview(); }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-white font-semibold">Preview: {q.number}, as the client will see it</span>
            <div className="flex gap-2">
              <button type="button" onClick={pdf} className="text-white px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>Download PDF</button>
              <button type="button" autoFocus onClick={closePreview} className="px-3 py-1.5 rounded text-sm border text-white" style={{ borderColor: "rgba(255,255,255,0.4)" }}>Close</button>
            </div>
          </div>
          <iframe src={preview} title="Quote preview" className="flex-1 w-full rounded bg-white" />
        </div>
      )}
    </div>
  );
}
