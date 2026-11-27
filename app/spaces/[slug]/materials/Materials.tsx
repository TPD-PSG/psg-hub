"use client";

// Materials & kit: the workshop's stock (low items flagged), booking stock out to builds, and
// purchase orders from raising through approval, ordering and delivery.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { PO_STATUS } from "@/lib/poStatus";
import { downloadPoPDF } from "@/lib/poPdf";
import { fmtDate } from "@/lib/format";
import { STOCK_SECTIONS, NO_SECTION, groupBySection } from "@/lib/stockSections";
import LabourTypes from "@/components/LabourTypes";
import { caps, card, h2, muted, link, btnSolid, btnLine, input, label as lbl, pageHeader } from "@/lib/twsUi";

type Opt = { id: number; name: string };
type Item = {
  id: number; name: string; unit: string; quantity: number; reorderLevel: number | null; unitCost: number | null; location: string | null; section: string | null; low: boolean;
  supplier: Opt | null; supplierId: number | null;
  moves: { id: number; change: number; kind: string; note: string | null; createdAt: string; job: { id: number; title: string } | null; user: { name: string } | null }[];
};
type Line = { id?: number; description: string; quantity: number; unit: string | null; unitCost: number; stockItemId: number | null };
export type PO = {
  id: number; number: string; status: string; notes: string | null; total: number; inSage: boolean; createdAt: string; approvedAt: string | null; orderedAt: string | null; deliveredAt: string | null;
  supplierId: number | null; supplierName: string | null; supplier: (Opt & { email: string | null; phone: string | null }) | null;
  job: { id: number; number: string; title: string } | null; raisedBy: Opt | null; approvedBy: Opt | null; lines: Line[];
};
export type MaterialsData = {
  space: SpaceTheme; limit: number; canApprove: boolean; isAdmin: boolean; me: number;
  items: Item[]; pos: PO[]; jobs: { id: number; number: string; title: string }[]; suppliers: Opt[];
};

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));
const blankLine = (): Line => ({ description: "", quantity: 1, unit: "", unitCost: 0, stockItemId: null });
const STATUS_TONE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--tws-tint)", color: "#4e545b" },
  awaiting_approval: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" },
  approved: { background: "var(--tws-accent-light)", color: "var(--tws-ink)" },
  ordered: { background: "var(--tws-accent)", color: "var(--tws-ink)" },
  delivered: { background: "var(--tws-char)", color: "#fff" },
  cancelled: { background: "transparent", color: "var(--tws-muted)", textDecoration: "line-through", border: "1px solid var(--tws-line)" },
};
const FILTERS = [["open", "Open"], ["awaiting_approval", "Awaiting approval"], ["delivered", "Delivered"], ["all", "All"]] as const;

export default function Materials({ initial, start }: { initial: MaterialsData; start: { open: boolean; jobId: number | null; itemId: number | null } }) {
  const [data, setData] = useState(initial);
  const { space, items, pos, jobs, suppliers, canApprove, limit } = data;
  const base = `/spaces/${space.slug}`;
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>(pos.some(p => p.status === "awaiting_approval") && canApprove ? "awaiting_approval" : "open");
  const [openPo, setOpenPo] = useState<number | null>(null);
  const [backReason, setBackReason] = useState<Record<number, string>>({});
  const [limitEdit, setLimitEdit] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<null | { id?: number; name: string; unit: string; quantity: string; reorderLevel: string; unitCost: string; supplierId: string; location: string; section: string }>(null);
  const [section, setSection] = useState("all");
  const [move, setMove] = useState<null | { itemId: number; kind: "book_out" | "return" | "count"; quantity: string; jobId: string; note: string }>(null);
  const startItem = start.itemId ? items.find(i => i.id === start.itemId) : null;
  const [poForm, setPoForm] = useState<null | { id?: number; supplierId: string; supplierName: string; jobId: string; notes: string; lines: Line[] }>(start.open ? {
    supplierId: startItem?.supplierId ? String(startItem.supplierId) : "", supplierName: "", jobId: start.jobId ? String(start.jobId) : "", notes: "",
    lines: [startItem ? { description: startItem.name, quantity: Math.max(1, (startItem.reorderLevel ?? 0) * 2 - startItem.quantity), unit: startItem.unit, unitCost: startItem.unitCost ?? 0, stockItemId: startItem.id } : blankLine()],
  } : null);

  async function reload() {
    const d = await fetch(`/api/spaces/${space.slug}/materials`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (d?.space) setData(d);
  }
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { await alertDialog(out.error ?? "That didn't work"); return null; }
    return out;
  }

  // Stock
  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm) return;
    const { id, ...f } = itemForm;
    const ok = id ? await call(`/api/stock/${id}`, "PATCH", { ...f, quantity: undefined }) : await call(`/api/spaces/${space.slug}/stock`, "POST", f);
    if (ok) { setItemForm(null); reload(); }
  }
  const newItem = (sec: string) => setItemForm({ name: "", unit: "sheets", quantity: "", reorderLevel: "", unitCost: "", supplierId: "", location: "", section: sec });
  async function saveMove(e: React.FormEvent) {
    e.preventDefault();
    if (!move) return;
    if (await call(`/api/stock/${move.itemId}/moves`, "POST", move)) { setMove(null); reload(); }
  }
  async function archive(i: Item) {
    if (await confirmDialog(`Remove ${i.name} from the stock list? (Its history is kept.)`) && await call(`/api/stock/${i.id}`, "PATCH", { archived: true })) reload();
  }

  // POs
  const poTotal = (ls: Line[]) => ls.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  async function savePo(submit: boolean) {
    if (!poForm) return;
    const body = { ...poForm, lines: poForm.lines.filter(l => l.description.trim()) };
    let po = poForm.id ? await call(`/api/purchase-orders/${poForm.id}`, "PATCH", { action: "edit", ...body }) : await call(`/api/spaces/${space.slug}/purchase-orders`, "POST", { ...body, submit });
    if (po && poForm.id && submit) po = await call(`/api/purchase-orders/${poForm.id}`, "PATCH", { action: "submit" });
    if (po) {
      setPoForm(null); setOpenPo(po.id); await reload();
      if (submit) alertDialog(po.status === "approved" ? `${po.number} is approved and ready to order.` : `${po.number} is over ${gbp(limit)} and is waiting for approval.`);
    }
  }
  async function act(po: PO, action: string, extra: Record<string, unknown> = {}) {
    if (action === "cancel" && !(await confirmDialog(`Cancel ${po.number}?`))) return;
    if (action === "deliver" && !(await confirmDialog(`Mark ${po.number} as delivered?${po.lines.some(l => l.stockItemId) ? " Its stock lines will be added to stock." : ""}`))) return;
    if (await call(`/api/purchase-orders/${po.id}`, "PATCH", { action, ...extra })) reload();
  }
  async function sendBack(po: PO) {
    if (await call(`/api/purchase-orders/${po.id}`, "PATCH", { action: "send_back", reason: backReason[po.id] ?? "" })) { setBackReason(r => ({ ...r, [po.id]: "" })); reload(); }
  }
  async function removeDraft(po: PO) {
    if (await confirmDialog(`Delete draft ${po.number}?`) && await call(`/api/purchase-orders/${po.id}`, "DELETE")) reload();
  }
  async function setLimit(e: React.FormEvent) {
    e.preventDefault();
    if (limitEdit != null && await call(`/api/spaces/${space.slug}/materials`, "PUT", { poApprovalLimit: limitEdit })) { setLimitEdit(null); reload(); }
  }
  const editPo = (po: PO) => setPoForm({ id: po.id, supplierId: po.supplierId ? String(po.supplierId) : "", supplierName: po.supplierName ?? "", jobId: po.job ? String(po.job.id) : "", notes: po.notes ?? "", lines: po.lines.map(l => ({ ...l, unit: l.unit ?? "" })) });

  const low = items.filter(i => i.low);
  const groups = groupBySection(items);
  const sectionNames = [...new Set([...STOCK_SECTIONS, ...items.map(i => i.section).filter((x): x is string => !!x)])];
  const sec = groups.length > 1 && groups.some(g => g.section === section) ? section : "all"; // a section that's emptied falls back to All
  const shownGroups = groups.filter(g => sec === "all" || g.section === sec);
  const shown = pos.filter(p => filter === "all" ? true : filter === "open" ? !["delivered", "cancelled"].includes(p.status) : p.status === filter);
  const supplierOf = (p: PO) => p.supplier?.name ?? p.supplierName ?? "No supplier yet";
  const setLine = (i: number, patch: Partial<Line>) => setPoForm(f => f && { ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-3">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Materials &amp; kit</div>
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Materials &amp; kit</h1>
            <span className="text-sm" style={muted}>{items.length} stock item{items.length === 1 ? "" : "s"} · {low.length} low · {pos.filter(p => !["delivered", "cancelled", "draft"].includes(p.status)).length} purchase orders open</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={() => setPoForm({ supplierId: "", supplierName: "", jobId: "", notes: "", lines: [blankLine()] })} style={btnSolid}>+ Raise PO</button>
            <button type="button" onClick={() => newItem(section === "all" || section === NO_SECTION ? "" : section)} style={btnLine}>+ Stock item</button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-6">
        {low.length > 0 && (
          <div role="status" className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)" }}>
            <strong style={{ color: "var(--tws-warn-ink)" }}>Below reorder level</strong>
            {low.map(i => <Link key={i.id} href={`${base}/materials?order=${i.id}`} onClick={e => { e.preventDefault(); setPoForm({ supplierId: i.supplierId ? String(i.supplierId) : "", supplierName: "", jobId: "", notes: "", lines: [{ description: i.name, quantity: Math.max(1, (i.reorderLevel ?? 0) * 2 - i.quantity), unit: i.unit, unitCost: i.unitCost ?? 0, stockItemId: i.id }] }); }}
              className="hover:underline" style={{ color: "var(--tws-ink)" }}>{i.name}: {qty(i.quantity)} {i.unit} · order more</Link>)}
          </div>
        )}

        {/* PO form */}
        {poForm && (
          <section style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-4" aria-label="Purchase order">
            <div className="flex justify-between items-baseline gap-3 flex-wrap">
              <h2 style={h2}>{poForm.id ? `Edit ${pos.find(p => p.id === poForm.id)?.number}` : "Raise a purchase order"}</h2>
              <span className="text-[13px]" style={muted}>Up to {gbp(limit)} ex VAT is approved when you submit; above that it waits for approval.</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label htmlFor="po-sup" style={lbl}>Supplier</label>
                <select id="po-sup" style={input} value={poForm.supplierId} onChange={e => setPoForm({ ...poForm, supplierId: e.target.value })}>
                  <option value="">Not in the list (type it)</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              {!poForm.supplierId && <div><label htmlFor="po-supname" style={lbl}>Supplier name</label>
                <input id="po-supname" style={input} value={poForm.supplierName} onChange={e => setPoForm({ ...poForm, supplierName: e.target.value })} placeholder="e.g. Stoke Timber Ltd" /></div>}
              <div><label htmlFor="po-job" style={lbl}>For build</label>
                <select id="po-job" style={input} value={poForm.jobId} onChange={e => setPoForm({ ...poForm, jobId: e.target.value })}>
                  <option value="">Workshop stock (no build)</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.number} · {j.title}</option>)}
                </select></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 680 }}>
                <thead><tr className="text-xs text-left" style={muted}><th className="py-1.5 pr-2 font-semibold">Stock item</th><th className="py-1.5 pr-2 font-semibold">Description</th><th className="py-1.5 pr-2 font-semibold w-20">Qty</th><th className="py-1.5 pr-2 font-semibold w-24">Unit</th><th className="py-1.5 pr-2 font-semibold w-28">£ each (ex VAT)</th><th className="py-1.5 font-semibold w-24 text-right">Line</th><th className="w-8" /></tr></thead>
                <tbody>
                  {poForm.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2"><select aria-label="Stock item" style={input} value={l.stockItemId ?? ""} onChange={e => {
                        const it = items.find(x => x.id === Number(e.target.value));
                        setLine(i, it ? { stockItemId: it.id, description: l.description || it.name, unit: it.unit, unitCost: l.unitCost || it.unitCost || 0 } : { stockItemId: null });
                      }}><option value="">Not stock</option>{groups.map(g => <optgroup key={g.section} label={g.section}>{g.items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</optgroup>)}</select></td>
                      <td className="py-1 pr-2"><input aria-label="Description" style={input} value={l.description} onChange={e => setLine(i, { description: e.target.value })} placeholder="e.g. 18mm ply, 2440×1220" /></td>
                      <td className="py-1 pr-2"><input aria-label="Quantity" type="number" min={0} step="any" style={input} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value as unknown as number })} /></td>
                      <td className="py-1 pr-2"><input aria-label="Unit" style={input} value={l.unit ?? ""} onChange={e => setLine(i, { unit: e.target.value })} placeholder="sheets" /></td>
                      <td className="py-1 pr-2"><input aria-label="Price each" type="number" min={0} step="0.01" style={input} value={l.unitCost} onChange={e => setLine(i, { unitCost: e.target.value as unknown as number })} /></td>
                      <td className="py-1 text-right tabular-nums">{gbp((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}</td>
                      <td className="py-1 text-right">{poForm.lines.length > 1 && <button type="button" aria-label="Remove line" onClick={() => setPoForm({ ...poForm, lines: poForm.lines.filter((_, j) => j !== i) })} style={{ color: "var(--tws-bad-ink)" }}>✕</button>}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={5} className="pt-2"><button type="button" onClick={() => setPoForm({ ...poForm, lines: [...poForm.lines, blankLine()] })} className="text-[13px]" style={link}>+ Add a line</button></td>
                    <td className="pt-2 text-right font-extrabold tabular-nums">{gbp(poTotal(poForm.lines))}</td><td /></tr>
                </tbody>
              </table>
            </div>
            <div><label htmlFor="po-notes" style={lbl}>Notes for the supplier or approver</label>
              <textarea id="po-notes" rows={2} style={input} value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} placeholder="Delivery to the workshop, Mon–Fri 8–4…" /></div>
            <div className="flex gap-3 flex-wrap items-center">
              <button type="button" disabled={busy} onClick={() => savePo(true)} style={btnSolid}>{poTotal(poForm.lines) > limit ? "Submit for approval" : "Submit"}</button>
              <button type="button" disabled={busy} onClick={() => savePo(false)} style={btnLine}>Save draft</button>
              <button type="button" onClick={() => setPoForm(null)} className="text-sm underline" style={muted}>Cancel</button>
            </div>
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-5 items-start">
          {/* Stock */}
          <section style={card} className="xl:col-span-2 flex flex-col gap-3 min-w-0" aria-label="Stock">
            <h2 style={h2}>Stock</h2>
            {itemForm && (
              <form onSubmit={saveItem} className="grid gap-2 grid-cols-2 p-3" style={{ background: "var(--tws-ground)" }}>
                <div className="col-span-2"><label htmlFor="si-name" style={lbl}>Item</label><input id="si-name" required style={input} value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="18mm ply" /></div>
                <div className="col-span-2"><label htmlFor="si-sec" style={lbl}>Section</label>
                  <input id="si-sec" list="stock-sections" style={input} value={itemForm.section} onChange={e => setItemForm({ ...itemForm, section: e.target.value })} placeholder="Pick one or type a new section" />
                  <datalist id="stock-sections">{sectionNames.map(n => <option key={n} value={n} />)}</datalist></div>
                <div><label htmlFor="si-unit" style={lbl}>Unit</label><input id="si-unit" style={input} value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
                {!itemForm.id && <div><label htmlFor="si-qty" style={lbl}>In stock now</label><input id="si-qty" type="number" min={0} step="any" style={input} value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>}
                <div><label htmlFor="si-re" style={lbl}>Reorder at</label><input id="si-re" type="number" min={0} step="any" style={input} value={itemForm.reorderLevel} onChange={e => setItemForm({ ...itemForm, reorderLevel: e.target.value })} /></div>
                <div><label htmlFor="si-cost" style={lbl}>£ each (ex VAT)</label><input id="si-cost" type="number" min={0} step="0.01" style={input} value={itemForm.unitCost} onChange={e => setItemForm({ ...itemForm, unitCost: e.target.value })} /></div>
                <div><label htmlFor="si-sup" style={lbl}>Usual supplier</label>
                  <select id="si-sup" style={input} value={itemForm.supplierId} onChange={e => setItemForm({ ...itemForm, supplierId: e.target.value })}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label htmlFor="si-loc" style={lbl}>Where it&apos;s kept</label><input id="si-loc" style={input} value={itemForm.location} onChange={e => setItemForm({ ...itemForm, location: e.target.value })} placeholder="Timber rack" /></div>
                <div className="col-span-2 flex gap-3"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{itemForm.id ? "Save" : "Add to stock"}</button><button type="button" onClick={() => setItemForm(null)} className="text-sm underline" style={muted}>Cancel</button></div>
              </form>
            )}
            {items.length === 0 ? <p className="text-sm" style={muted}>No stock items yet. Add what the workshop keeps (ply, MDF, steel, paint…) with a reorder level so it flags when it&apos;s low.</p> : (
              <div className="flex flex-col gap-4">
                {groups.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Stock sections">
                    {[{ section: "all", items }, ...groups].map(g => {
                      const nLow = g.items.filter(i => i.low).length;
                      return <button key={g.section} type="button" aria-pressed={sec === g.section} onClick={() => setSection(g.section)} className="text-xs font-bold px-2.5 py-1.5"
                        style={sec === g.section ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>
                        {g.section === "all" ? "All" : g.section} ({g.items.length}){nLow > 0 && <span style={{ color: sec === g.section ? "var(--tws-accent)" : "var(--tws-bad-ink)" }}> · {nLow} low</span>}</button>;
                    })}
                  </div>
                )}
                {shownGroups.map(g => (
                <div key={g.section} className="flex flex-col">
                  <div className="flex items-baseline justify-between gap-2 pb-1.5" style={{ borderBottom: "2px solid var(--tws-char)" }}>
                    <h3 style={{ ...caps, margin: 0 }}>{g.section} <span style={muted}>· {g.items.length}</span></h3>
                    <button type="button" onClick={() => newItem(g.section === NO_SECTION ? "" : g.section)} className="text-xs font-semibold" style={{ color: "var(--tws-accent-ink)" }}>+ Add to {g.section}</button>
                  </div>
              <ul className="flex flex-col">
                {g.items.map(i => (
                  <li key={i.id} className="py-2.5 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0"><strong>{i.name}</strong> <span style={muted}>{[i.location, i.supplier?.name, i.unitCost != null ? `${gbp(i.unitCost)} each` : null].filter(Boolean).join(" · ")}</span></span>
                      <span className="shrink-0 text-right">
                        <span className="tabular-nums font-bold">{qty(i.quantity)} {i.unit}</span>{" "}
                        {i.low ? <strong style={{ color: "var(--tws-bad-ink)" }}>Low · reorder</strong> : i.reorderLevel != null ? <span style={muted}>OK</span> : null}
                      </span>
                    </div>
                    <div className="flex gap-3 flex-wrap text-xs">
                      {[["book_out", "Book out to a build"], ["return", "Return"], ["count", "Count"]].map(([k, l]) => (
                        <button key={k} type="button" onClick={() => setMove({ itemId: i.id, kind: k as "book_out", quantity: k === "count" ? String(i.quantity) : "", jobId: "", note: "" })} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>{l}</button>
                      ))}
                      <button type="button" onClick={() => setPoForm({ supplierId: i.supplierId ? String(i.supplierId) : "", supplierName: "", jobId: "", notes: "", lines: [{ description: i.name, quantity: Math.max(1, (i.reorderLevel ?? 0) * 2 - i.quantity), unit: i.unit, unitCost: i.unitCost ?? 0, stockItemId: i.id }] })} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Order more</button>
                      <button type="button" onClick={() => setItemForm({ id: i.id, name: i.name, unit: i.unit, quantity: "", reorderLevel: i.reorderLevel?.toString() ?? "", unitCost: i.unitCost?.toString() ?? "", supplierId: i.supplierId ? String(i.supplierId) : "", location: i.location ?? "", section: i.section ?? "" })} style={muted}>Edit</button>
                      <button type="button" onClick={() => archive(i)} style={muted}>Remove</button>
                    </div>
                    {move?.itemId === i.id && (
                      <form onSubmit={saveMove} className="grid gap-2 items-end p-3 sm:grid-cols-[90px_1fr_auto]" style={{ background: "var(--tws-ground)" }}>
                        <div><label htmlFor={`mv-q${i.id}`} style={lbl}>{move.kind === "count" ? "Counted" : "Quantity"}</label>
                          <input id={`mv-q${i.id}`} type="number" min={0} step="any" required style={input} value={move.quantity} onChange={e => setMove({ ...move, quantity: e.target.value })} /></div>
                        {move.kind !== "count" ? (
                          <div><label htmlFor={`mv-j${i.id}`} style={lbl}>{move.kind === "return" ? "Back from build (optional)" : "For build"}</label>
                            <select id={`mv-j${i.id}`} required={move.kind === "book_out"} style={input} value={move.jobId} onChange={e => setMove({ ...move, jobId: e.target.value })}>
                              <option value="">{move.kind === "return" ? "—" : "Pick a build"}</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                            </select></div>
                        ) : <span className="text-xs self-center" style={muted}>Sets the level to what you counted</span>}
                        <div className="flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 12px" }}>{move.kind === "book_out" ? "Book out" : move.kind === "return" ? "Return" : "Save count"}</button>
                          <button type="button" onClick={() => setMove(null)} className="text-sm underline" style={muted}>Cancel</button></div>
                      </form>
                    )}
                    {i.moves.length > 0 && (
                      <details className="text-xs" style={muted}>
                        <summary className="cursor-pointer">Recent changes</summary>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {i.moves.map(m => <li key={m.id}>{fmtDate(m.createdAt)} · {m.change > 0 ? "+" : ""}{qty(m.change)} {i.unit} · {m.kind === "book_out" ? `booked out${m.job ? ` to ${m.job.title}` : ""}` : m.kind === "return" ? `returned${m.job ? ` from ${m.job.title}` : ""}` : m.kind === "delivery" ? `delivered (${m.note})` : m.note ?? "adjusted"}{m.user ? ` · ${m.user.name}` : ""}</li>)}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
                </div>
                ))}
              </div>
            )}
          </section>

          {/* Purchase orders */}
          <section style={card} className="xl:col-span-3 flex flex-col gap-3 min-w-0" aria-label="Purchase orders">
            <div className="flex justify-between items-baseline gap-3 flex-wrap">
              <h2 style={h2}>Purchase orders</h2>
              {limitEdit == null ? (
                <span className="text-xs" style={muted}>Approval over {gbp(limit)}{data.isAdmin && <> · <button type="button" onClick={() => setLimitEdit(String(limit))} className="underline">change</button></>}</span>
              ) : (
                <form onSubmit={setLimit} className="flex items-center gap-2 text-xs">
                  <label htmlFor="po-limit" style={muted}>Approval over £</label>
                  <input id="po-limit" type="number" min={0} step="1" style={{ ...input, width: 90, padding: "4px 6px" }} value={limitEdit} onChange={e => setLimitEdit(e.target.value)} />
                  <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "4px 10px", fontSize: 12 }}>Save</button>
                  <button type="button" onClick={() => setLimitEdit(null)} className="underline" style={muted}>Cancel</button>
                </form>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
              {FILTERS.map(([k, l]) => {
                const n = k === "all" ? pos.length : k === "open" ? pos.filter(p => !["delivered", "cancelled"].includes(p.status)).length : pos.filter(p => p.status === k).length;
                return <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className="text-xs font-bold px-2.5 py-1.5"
                  style={filter === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>{l} ({n})</button>;
              })}
            </div>
            {shown.length === 0 ? <p className="text-sm py-2" style={muted}>{pos.length ? "None here." : "No purchase orders yet."}</p> : (
              <ul className="flex flex-col">
                {shown.map(p => {
                  const isOpen = openPo === p.id;
                  return (
                    <li key={p.id} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                      <button type="button" onClick={() => setOpenPo(isOpen ? null : p.id)} aria-expanded={isOpen} className="w-full text-left py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex flex-col">
                          <span><strong>{p.number}</strong> · {supplierOf(p)}</span>
                          <span className="text-xs" style={muted}>{[p.job?.title ?? "Workshop stock", p.raisedBy && `raised by ${p.raisedBy.name}`, fmtDate(p.createdAt)].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums font-bold">{gbp(p.total)}</span>
                          <span className="text-[11px] font-bold px-2 py-1" style={STATUS_TONE[p.status]}>{PO_STATUS[p.status] ?? p.status}{p.inSage ? " · in Sage" : ""}</span>
                        </span>
                      </button>
                      {isOpen && (
                        <div className="pb-3 flex flex-col gap-3">
                          <div className="overflow-x-auto">
                          <table className="w-full text-[13px]" style={{ borderCollapse: "collapse", minWidth: 480 }}>
                            <tbody>
                              {p.lines.map(l => (
                                <tr key={l.id} style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                                  <td className="py-1.5 pr-2">{l.description}{l.stockItemId ? <span style={muted}> · to stock</span> : null}</td>
                                  <td className="py-1.5 pr-2 whitespace-nowrap">{qty(l.quantity)} {l.unit ?? ""}</td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{gbp(l.unitCost)}</td>
                                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{gbp(l.quantity * l.unitCost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                          {p.notes && <p className="text-[13px] whitespace-pre-wrap" style={muted}>{p.notes}</p>}
                          <p className="text-xs" style={muted}>
                            {[p.approvedAt && `Approved ${fmtDate(p.approvedAt)}${p.approvedBy ? ` by ${p.approvedBy.name}` : " (under the limit)"}`, p.orderedAt && `ordered ${fmtDate(p.orderedAt)}`, p.deliveredAt && `delivered ${fmtDate(p.deliveredAt)}`, p.supplier?.email, p.supplier?.phone].filter(Boolean).join(" · ")}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={() => downloadPoPDF(p, { name: space.name, color: space.color, logoUrl: space.logoUrl })}
                              style={{ ...btnLine, padding: "6px 12px", fontSize: 13 }} title={["draft", "awaiting_approval", "cancelled"].includes(p.status) ? "Marked “not for ordering” until it's approved" : undefined}>PDF for supplier</button>
                            {p.status === "draft" && <><button type="button" disabled={busy} onClick={() => editPo(p)} style={{ ...btnLine, padding: "6px 12px", fontSize: 13 }}>Edit</button>
                              <button type="button" disabled={busy} onClick={() => act(p, "submit")} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Submit</button>
                              <button type="button" disabled={busy} onClick={() => removeDraft(p)} className="text-[13px] font-semibold px-2" style={{ color: "var(--tws-bad-ink)" }}>Delete draft</button></>}
                            {p.status === "awaiting_approval" && (canApprove
                              ? <><button type="button" disabled={busy} onClick={() => act(p, "approve")} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Approve</button>
                                <input aria-label="Why it's going back" style={{ ...input, width: 220, padding: "6px 8px" }} placeholder="Why it's going back (optional)" value={backReason[p.id] ?? ""} onChange={e => setBackReason(r => ({ ...r, [p.id]: e.target.value }))} />
                                <button type="button" disabled={busy} onClick={() => sendBack(p)} style={{ ...btnLine, padding: "6px 12px", fontSize: 13 }}>Send back</button></>
                              : <span className="text-[13px]" style={{ color: "var(--tws-warn-ink)" }}>Waiting for an admin or Finance to approve</span>)}
                            {p.status === "approved" && <button type="button" disabled={busy} onClick={() => act(p, "order")} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Mark ordered</button>}
                            {(p.status === "approved" || p.status === "ordered") && <button type="button" disabled={busy} onClick={() => act(p, "deliver")} style={{ ...btnLine, padding: "6px 12px", fontSize: 13 }}>Mark delivered</button>}
                            {p.status === "delivered" && canApprove && (
                              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={p.inSage} onChange={e => act(p, "sage", { inSage: e.target.checked })} /> Entered in Sage</label>
                            )}
                            {!["delivered", "cancelled", "draft"].includes(p.status) && <button type="button" disabled={busy} onClick={() => act(p, "cancel")} className="text-[13px] font-semibold px-2" style={muted}>Cancel PO</button>}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <LabourTypes slug={space.slug} />
        <p className="text-xs" style={{ ...caps, letterSpacing: "0.15em", color: "var(--tws-muted)" }}>Delivered POs and stock booked out count towards each build&apos;s actual cost</p>
      </div>
    </>
  );
}
