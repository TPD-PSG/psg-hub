"use client";

// Variations on a build (27 Nov 2026), in the space's look: extra or changed work after the quote,
// priced in lines like a quote (stock and last-paid lookup, units by section, markup). Draft →
// Send to client → the client approves or declines in My builds (an admin can record it instead).
// Approved variations add to the build's price.
import { useEffect, useRef, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import { QUOTE_SECTIONS, unitsFor } from "@/lib/quoteUnits";
import { caps, card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";

type Line = { id?: number; section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number };
export type VariationRow = {
  id: number; label: string; number: number; title: string; notes: string | null; vatRate: number; status: string; createdAt: string;
  sentAt: string | null; decidedAt: string | null; decidedByName: string | null; decidedOnBehalf: boolean; decisionComment: string | null;
  lines: Line[]; totals: { cost: number; net: number; vat: number; gross: number; margin: number; marginPct: number | null };
};
type Row = { section: string; description: string; quantity: string; unit: string; unitCost: string; unitPrice: string };
type Lookup = { stock: { id: number; name: string; unit: string; quantity: number; unitCost: number | null; section: string | null }[]; recent: { description: string; unit: string | null; unitCost: number; supplier: string | null; poNumber: string; date: string }[] };

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const num = (s: string) => (s.trim() === "" ? 0 : Number(s) || 0);
const BLANK: Row = { section: "", description: "", quantity: "1", unit: "", unitCost: "", unitPrice: "" };
const toRow = (l: Line): Row => ({ section: l.section ?? "", description: l.description, quantity: String(l.quantity), unit: l.unit ?? "", unitCost: String(l.unitCost), unitPrice: String(l.unitPrice) });
const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  draft: { label: "Draft", style: { background: "var(--tws-tint)", color: "#4e545b" } },
  sent: { label: "With the client", style: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" } },
  approved: { label: "Approved", style: { background: "var(--tws-char)", color: "#fff" } },
  declined: { label: "Declined", style: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" } },
};
const small: React.CSSProperties = { ...btnLine, padding: "6px 10px", fontSize: 13 };
const cell: React.CSSProperties = { ...input, padding: "6px 8px", fontSize: 13 };

export default function Variations({ jobId, entityId, isAdmin, hasClient, initial, onChange }: {
  jobId: number; entityId: number | null; isAdmin: boolean; hasClient: boolean; initial: VariationRow[]; onChange: () => void;
}) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<null | { id?: number; title: string; notes: string; rows: Row[] }>(null);
  const [entry, setEntry] = useState<Row>({ ...BLANK });
  const [markup, setMarkup] = useState("30");
  const [found, setFound] = useState<Lookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [record, setRecord] = useState<null | { id: number; decision: "approved" | "declined"; comment: string }>(null);
  const [busy, setBusy] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  const priced = (cost: number) => Math.round(cost * (1 + (Number(markup) || 0) / 100) * 100) / 100;

  useEffect(() => {
    const text = entry.description.trim();
    if (text.length < 2 || !searching) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/quotes/lookup?q=${encodeURIComponent(text)}${entityId ? `&entityId=${entityId}` : ""}`, { signal: ctl.signal })
        .then(r => (r.ok ? r.json() : null)).then(d => setFound(d && (d.stock.length || d.recent.length) ? d : null)).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [entry.description, entityId, searching]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return null; }
    return d;
  }
  const after = (d: unknown) => { if (Array.isArray(d)) setList(d as VariationRow[]); onChange(); };

  function addEntry(e?: React.FormEvent) {
    e?.preventDefault();
    if (!editing) return;
    if (!entry.description.trim()) { descRef.current?.focus(); return; }
    const row = { ...entry, unitPrice: entry.unitPrice.trim() === "" && entry.unitCost.trim() ? String(priced(num(entry.unitCost))) : entry.unitPrice };
    setEditing({ ...editing, rows: [...editing.rows, row] });
    setEntry({ ...BLANK, section: entry.section });
    setFound(null); setSearching(false);
    descRef.current?.focus();
  }
  async function save(send: boolean) {
    if (!editing) return;
    if (!editing.title.trim()) return alertDialog("Say what the variation is (a short title).");
    const pending = entry.description.trim() ? [{ ...entry, unitPrice: entry.unitPrice.trim() === "" && entry.unitCost.trim() ? String(priced(num(entry.unitCost))) : entry.unitPrice }] : [];
    const lines = [...editing.rows, ...pending];
    if (send && !lines.length) return alertDialog("Add at least one line before sending.");
    if (send && !(await confirmDialog(hasClient ? "Send this variation to the client? They'll see it in their builds and can approve or decline it." : "Mark this variation as sent to the client? This build has no client login, so record their answer when you get it."))) return;
    const body = { title: editing.title, notes: editing.notes, lines };
    let d = editing.id ? await call(`/api/jobs/${jobId}/variations/${editing.id}`, "PATCH", { action: "edit", ...body }) : await call(`/api/jobs/${jobId}/variations`, "POST", body);
    if (!d) return;
    const id = editing.id ?? (d as VariationRow).id;
    if (send) d = await call(`/api/jobs/${jobId}/variations/${id}`, "PATCH", { action: "send" });
    else if (!editing.id) d = await call(`/api/jobs/${jobId}/variations`, "GET");
    if (d) { after(d); setEditing(null); setEntry({ ...BLANK }); setOpen(id); }
  }
  async function act(v: VariationRow, action: string, extra: Record<string, unknown> = {}) {
    if (action === "withdraw" && !(await confirmDialog(`Withdraw ${v.label}? The client won't see it until you send it again.`))) return;
    const d = await call(`/api/jobs/${jobId}/variations/${v.id}`, "PATCH", { action, ...extra });
    if (d) { after(d); setRecord(null); }
  }
  async function pdf(v: VariationRow) {
    const d = await fetch(`/api/jobs/${jobId}/variations/${v.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return alertDialog("Couldn't make the PDF");
    const { downloadVariationPDF } = await import("@/lib/quotePdf");
    await downloadVariationPDF(d);
  }
  async function remove(v: VariationRow) {
    if (!(await confirmDialog(`Delete ${v.label} (${v.title})? This can't be undone.`))) return;
    const d = await call(`/api/jobs/${jobId}/variations/${v.id}`, "DELETE");
    if (d) after(d);
  }

  const approvedNet = list.filter(v => v.status === "approved").reduce((s, v) => s + v.totals.net, 0);
  const waiting = list.filter(v => v.status === "sent").length;
  const draftTotals = editing ? editing.rows.reduce((a, r) => ({ cost: a.cost + num(r.quantity) * num(r.unitCost), net: a.net + num(r.quantity) * num(r.unitPrice) }), { cost: 0, net: 0 }) : null;

  return (
    <section style={card} className="flex flex-col gap-3.5" aria-label="Variations">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h2 style={h2}>Variations</h2>
        <span className="text-[13px]" style={muted}>
          {list.length === 0 ? "Extra or changed work after the quote" : `${gbp(approvedNet)} approved, added to the price${waiting ? ` · ${waiting} with the client` : ""}`}
        </span>
      </div>

      {list.length > 0 && (
        <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
          {list.map(v => {
            const st = STATUS[v.status] ?? STATUS.draft;
            const isOpen = open === v.id;
            return (
              <li key={v.id} className="py-2.5 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left" style={{ background: "none", border: 0, padding: 0, color: "inherit" }}>
                  <strong className="text-sm">{v.label}</strong>
                  <span className="text-sm flex-1 min-w-0 break-words">{v.title}</span>
                  <span className="text-sm tabular-nums font-bold">{gbp(v.totals.net)}</span>
                  <span className="text-xs tabular-nums" style={muted}>{v.totals.marginPct != null ? `${Math.round(v.totals.marginPct)}% margin` : ""}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5" style={st.style}>{st.label}</span>
                </button>
                {(v.status === "approved" || v.status === "declined") && (
                  <p className="text-xs m-0" style={muted}>
                    {v.status === "approved" ? "Approved" : "Declined"} by {v.decidedByName}{v.decidedOnBehalf ? " (recorded by PSG)" : ""}{v.decidedAt ? ` · ${fmtDate(v.decidedAt)}` : ""}
                    {v.decisionComment ? <span className="block" style={{ color: "var(--tws-ink)" }}>“{v.decisionComment}”</span> : null}
                  </p>
                )}
                {v.status === "sent" && v.sentAt && <p className="text-xs m-0" style={muted}>Sent {fmtDate(v.sentAt)}{hasClient ? ": waiting for the client to approve it in their builds" : ""}</p>}
                {isOpen && (
                  <div className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-ground)" }}>
                    {v.notes && <p className="text-[13px] m-0 whitespace-pre-wrap">{v.notes}</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]" style={{ borderCollapse: "collapse", minWidth: 520 }}>
                        <thead><tr className="text-xs text-left" style={muted}><th className="py-1 pr-2 font-semibold">Item</th><th className="py-1 pr-2 font-semibold">Qty</th><th className="py-1 pr-2 font-semibold text-right">Cost</th><th className="py-1 pr-2 font-semibold text-right">Price</th><th className="py-1 font-semibold text-right">Amount</th></tr></thead>
                        <tbody>
                          {v.lines.map((l, i) => (
                            <tr key={l.id ?? i} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                              <td className="py-1 pr-2">{l.description}{l.section ? <span style={muted}> · {l.section}</span> : null}</td>
                              <td className="py-1 pr-2 whitespace-nowrap">{l.quantity} {l.unit ?? ""}</td>
                              <td className="py-1 pr-2 text-right tabular-nums" style={muted}>{gbp(l.unitCost)}</td>
                              <td className="py-1 pr-2 text-right tabular-nums">{gbp(l.unitPrice)}</td>
                              <td className="py-1 text-right tabular-nums">{gbp(l.quantity * l.unitPrice)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold" style={{ borderTop: "2px solid var(--tws-char)" }}><td className="py-1 pr-2" colSpan={2}>Total ex VAT · inc VAT {gbp(v.totals.gross)}</td><td className="py-1 pr-2 text-right tabular-nums" style={muted}>{gbp(v.totals.cost)}</td><td /><td className="py-1 text-right tabular-nums">{gbp(v.totals.net)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {v.status === "draft" && <>
                        <button type="button" disabled={busy} onClick={() => { setEditing({ id: v.id, title: v.title, notes: v.notes ?? "", rows: v.lines.map(toRow) }); setEntry({ ...BLANK, section: v.lines[v.lines.length - 1]?.section ?? "" }); }} style={small}>Edit</button>
                        <button type="button" disabled={busy || !v.lines.length} onClick={async () => { if (await confirmDialog(hasClient ? `Send ${v.label} to the client to approve?` : `Mark ${v.label} as sent?`)) act(v, "send"); }} style={{ ...small, ...btnSolid, padding: "6px 10px", fontSize: 13 }}>{hasClient ? "Send to client" : "Mark sent"}</button>
                      </>}
                      {v.status === "sent" && <button type="button" disabled={busy} onClick={() => act(v, "withdraw")} style={small}>Withdraw</button>}
                      {v.lines.length > 0 && <button type="button" disabled={busy} onClick={() => pdf(v)} style={small}>PDF</button>}
                      {isAdmin && (v.status === "draft" || v.status === "sent") && v.lines.length > 0 && <>
                        <button type="button" disabled={busy} onClick={() => setRecord({ id: v.id, decision: "approved", comment: "" })} style={small}>Record approval</button>
                        <button type="button" disabled={busy} onClick={() => setRecord({ id: v.id, decision: "declined", comment: "" })} style={small}>Record declined</button>
                      </>}
                      {(v.status === "draft" || v.status === "declined") && <button type="button" disabled={busy} onClick={() => remove(v)} className="text-xs font-semibold ml-auto" style={{ color: "var(--tws-bad-ink)" }}>Delete</button>}
                    </div>
                    {record?.id === v.id && (
                      <form onSubmit={e => { e.preventDefault(); act(v, "record", { decision: record.decision, comment: record.comment }); }} className="flex flex-col gap-2">
                        <label htmlFor={`rec-${v.id}`} style={lbl}>{record.decision === "approved" ? "How did the client approve it? (optional)" : "Why did they decline it?"}</label>
                        <input id={`rec-${v.id}`} autoFocus required={record.decision === "declined"} style={input} value={record.comment} onChange={e => setRecord({ ...record, comment: e.target.value })} placeholder={record.decision === "approved" ? "e.g. Email from the producer, 27 Nov" : "e.g. Over budget, they'll keep the old design"} />
                        <div className="flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Record {record.decision}</button><button type="button" onClick={() => setRecord(null)} style={small}>Cancel</button></div>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* New or edit */}
      {editing ? (
        <div className="flex flex-col gap-3 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
          <span style={caps}>{editing.id ? `Edit ${list.find(v => v.id === editing.id)?.label}` : `New variation V${(list.reduce((m, v) => Math.max(m, v.number), 0)) + 1}`}</span>
          <div><label htmlFor="var-title" style={lbl}>What is it?</label><input id="var-title" style={input} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Extra pair of flats, stage left" /></div>
          <div><label htmlFor="var-notes" style={lbl}>Note for the client (optional)</label><textarea id="var-notes" rows={2} style={input} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Why it's needed, and any effect on the delivery date" /></div>

          {editing.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr className="text-xs text-left" style={muted}><th className="py-1 pr-1 font-semibold">Section</th><th className="py-1 pr-1 font-semibold">Description</th><th className="py-1 pr-1 font-semibold w-16">Qty</th><th className="py-1 pr-1 font-semibold w-20">Unit</th><th className="py-1 pr-1 font-semibold w-20">Cost</th><th className="py-1 pr-1 font-semibold w-20">Price</th><th className="w-6" /></tr></thead>
                <tbody>
                  {editing.rows.map((r, i) => {
                    const set = (patch: Partial<Row>) => setEditing({ ...editing, rows: editing.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <tr key={i}>
                        <td className="py-0.5 pr-1"><input aria-label="Section" list="var-sections" style={cell} value={r.section} onChange={e => set({ section: e.target.value })} /></td>
                        <td className="py-0.5 pr-1"><input aria-label="Description" style={cell} value={r.description} onChange={e => set({ description: e.target.value })} /></td>
                        <td className="py-0.5 pr-1"><input aria-label="Quantity" type="number" step="any" style={cell} value={r.quantity} onChange={e => set({ quantity: e.target.value })} /></td>
                        <td className="py-0.5 pr-1"><input aria-label="Unit" list={`var-units-${i}`} style={cell} value={r.unit} onChange={e => set({ unit: e.target.value })} /><datalist id={`var-units-${i}`}>{unitsFor(r.section).map(u => <option key={u} value={u} />)}</datalist></td>
                        <td className="py-0.5 pr-1"><input aria-label="Our cost each" type="number" step="any" style={cell} value={r.unitCost} onChange={e => set({ unitCost: e.target.value })} /></td>
                        <td className="py-0.5 pr-1"><input aria-label="Price each" type="number" step="any" style={cell} value={r.unitPrice} onChange={e => set({ unitPrice: e.target.value })} /></td>
                        <td><button type="button" aria-label="Remove line" onClick={() => setEditing({ ...editing, rows: editing.rows.filter((_, j) => j !== i) })} style={{ color: "var(--tws-bad-ink)" }}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <datalist id="var-sections">{QUOTE_SECTIONS.map(s => <option key={s} value={s} />)}</datalist>

          {/* Add a line: clears after each one */}
          <form onSubmit={addEntry} className="grid gap-2 grid-cols-2 sm:grid-cols-3 2xl:grid-cols-[8rem_minmax(0,1fr)_4.5rem_5.5rem_6rem_6rem_auto] items-start" aria-label="Add a line to the variation">
            <input aria-label="New line section" list="var-sections" placeholder="Section" style={cell} value={entry.section} onChange={e => setEntry({ ...entry, section: e.target.value })} />
            <div className="relative col-span-2 2xl:col-span-1">
              <input ref={descRef} aria-label="New line description" placeholder="Description: type to search stock and past prices" autoComplete="off" style={cell}
                value={entry.description} onChange={e => { setEntry({ ...entry, description: e.target.value }); setSearching(true); }} onKeyDown={e => { if (e.key === "Escape") { setFound(null); setSearching(false); } }} />
              {found && searching && entry.description.trim().length >= 2 && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto text-xs shadow-xl" style={{ background: "#fff", border: "1px solid var(--tws-line)" }} role="listbox" aria-label="Stock and past prices">
                  {found.stock.map(st => (
                    <button key={`s${st.id}`} type="button" role="option" aria-selected={false} className="w-full text-left px-2 py-1.5 flex justify-between gap-3 hover:bg-black/5"
                      onClick={() => { const c = st.unitCost ?? 0; setEntry(en => ({ ...en, description: st.name, unit: st.unit, unitCost: c ? String(c) : en.unitCost, unitPrice: c ? String(priced(c)) : en.unitPrice, section: st.section || en.section })); setFound(null); setSearching(false); }}>
                      <span className="truncate">{st.name}</span><span className="shrink-0" style={muted}>{st.quantity} {st.unit} in stock{st.unitCost != null ? ` · ${gbp(st.unitCost)}/${st.unit}` : ""}</span>
                    </button>
                  ))}
                  {found.recent.map(rc => (
                    <button key={`r${rc.poNumber}${rc.description}`} type="button" role="option" aria-selected={false} className="w-full text-left px-2 py-1.5 flex justify-between gap-3 hover:bg-black/5"
                      onClick={() => { setEntry(en => ({ ...en, description: rc.description, unit: rc.unit ?? en.unit, unitCost: String(rc.unitCost), unitPrice: String(priced(rc.unitCost)) })); setFound(null); setSearching(false); }}>
                      <span className="truncate">{rc.description}</span><span className="shrink-0" style={muted}>last paid {gbp(rc.unitCost)}{rc.unit ? `/${rc.unit}` : ""} · {rc.supplier ?? "supplier"}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setFound(null); setSearching(false); }} className="w-full text-left px-2 py-1.5" style={{ ...muted, borderTop: "1px solid var(--tws-line-soft)" }}>Custom line: keep what I typed</button>
                </div>
              )}
            </div>
            <input aria-label="New line quantity" type="number" step="any" placeholder="Qty" style={cell} value={entry.quantity} onChange={e => setEntry({ ...entry, quantity: e.target.value })} />
            <div><input aria-label="New line unit" list="var-entry-units" placeholder="Unit" style={cell} value={entry.unit} onChange={e => setEntry({ ...entry, unit: e.target.value })} /><datalist id="var-entry-units">{unitsFor(entry.section).map(u => <option key={u} value={u} />)}</datalist></div>
            <input aria-label="New line our cost each" type="number" step="any" placeholder="Our cost" style={cell} value={entry.unitCost} onChange={e => setEntry({ ...entry, unitCost: e.target.value })} />
            <input aria-label="New line price each" type="number" step="any" style={cell} value={entry.unitPrice} placeholder={entry.unitCost.trim() ? String(priced(num(entry.unitCost))) : "Price"} onChange={e => setEntry({ ...entry, unitPrice: e.target.value })} />
            <button type="submit" style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Add line</button>
          </form>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <label className="flex items-center gap-1.5" style={muted}>Markup <input aria-label="Markup percent" type="number" step="any" style={{ ...cell, width: 64 }} value={markup} onChange={e => setMarkup(e.target.value)} />%</label>
            {draftTotals && <span>Cost <strong className="tabular-nums">{gbp(draftTotals.cost)}</strong> · Price <strong className="tabular-nums">{gbp(draftTotals.net)}</strong> · Margin <strong className="tabular-nums">{gbp(draftTotals.net - draftTotals.cost)}</strong></span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy} onClick={() => save(false)} style={btnLine}>Save draft</button>
            <button type="button" disabled={busy} onClick={() => save(true)} style={btnSolid}>{hasClient ? "Save and send to client" : "Save and mark sent"}</button>
            <button type="button" onClick={() => { setEditing(null); setEntry({ ...BLANK }); }} className="text-sm underline" style={muted}>Cancel</button>
          </div>
          <p className="text-xs m-0" style={muted}>The client sees the description, quantity and price of each line, never our cost or margin.</p>
        </div>
      ) : (
        <button type="button" onClick={() => { setEditing({ title: "", notes: "", rows: [] }); setEntry({ ...BLANK }); }} className="self-start text-[13px] font-semibold" style={link}>+ New variation</button>
      )}
    </section>
  );
}
