// "Materials & purchase orders" card: ordering the parts' estimated materials, POs and stock moves, booking out from stock.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { PO_STATUS } from "@/lib/poStatus";
import { materialsCost, ordered } from "@/components/PartMaterials";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { gbp, th, td, type Call, type JobMaterials, type PartRow } from "./spaceJobTypes";

export default function JobMaterialsPanel({ space, base, jobId, parts, setParts, initialMaterials, seeMoney, busy, setBusy, call, reload }: {
  space: SpaceTheme; base: string; jobId: number; parts: PartRow[]; setParts: (ps: PartRow[]) => void; initialMaterials: JobMaterials; seeMoney: boolean;
  busy: boolean; setBusy: (b: boolean) => void; call: Call; reload: () => void;
}) {
  const [mat, setMat] = useState(initialMaterials);
  const [fromStock, setFromStock] = useState({ itemId: "", quantity: "" });
  // Ordering the estimated materials: tick lines, pick a supplier, raise one PO for this build
  const toOrder = parts.flatMap(p => (p.materials ?? []).filter(m => !ordered(m)).map(m => ({ ...m, partLabel: p.label })));
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderPick, setOrderPick] = useState<Set<number>>(new Set());
  const [orderSup, setOrderSup] = useState({ supplierId: "", supplierName: "" });
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[] | null>(null);
  async function openOrder() {
    setOrderOpen(true); setOrderPick(new Set(toOrder.filter(m => !m.stockItemId).map(m => m.id)));
    if (!suppliers) { const d = await fetch(`/api/spaces/${space.slug}/materials`).then(r => (r.ok ? r.json() : null)).catch(() => null); setSuppliers(Array.isArray(d?.suppliers) ? d.suppliers : []); }
  }
  async function bookOutMaterials() {
    const ids = toOrder.filter(m => m.stockItemId && orderPick.has(m.id)).map(m => m.id);
    if (!ids.length) return alertDialog("Tick the lines picked from stock to book out.");
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/book-out-materials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialIds: ids }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't book them out");
    if (Array.isArray(d.parts)) setParts(d.parts);
    setOrderPick(p => { const n = new Set(p); ids.forEach(i => n.delete(i)); return n; });
    reloadMat(); reload();
    if (toOrder.length === ids.length) setOrderOpen(false);
  }
  async function orderMaterials(submit: boolean) {
    if ([...orderPick].some(id => toOrder.find(m => m.id === id)?.stockItemId) && !(await confirmDialog("Some ticked lines are in stock. Order them anyway? (Use \"Book out from stock\" to use what's on the rack.)"))) return;
    if (!orderPick.size) return alertDialog("Tick the materials to order.");
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/order-materials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialIds: [...orderPick], submit, ...orderSup }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't raise the purchase order");
    if (Array.isArray(d.parts)) setParts(d.parts);
    setOrderOpen(false); setOrderPick(new Set());
    reloadMat();
    alertDialog(`${d.po.number} ${d.po.status === "draft" ? "saved as a draft" : d.po.status === "approved" ? "is approved and ready to send to the supplier" : "is waiting for approval"} (${gbp(d.po.total)}). It's in Materials & kit.`);
  }
  const reloadMat = async () => { const d = await fetch(`/api/jobs/${jobId}/materials`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (d?.pos) setMat(d); };
  async function bookOut(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/stock/${fromStock.itemId}/moves`, "POST", { kind: "book_out", quantity: fromStock.quantity, jobId })) { setFromStock({ itemId: "", quantity: "" }); reloadMat(); reload(); }
  }

  return (
    <section style={card} className="flex flex-col gap-3.5 min-w-0" aria-label="Materials and purchase orders">
      <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Materials &amp; purchase orders</h2>
        <Link href={`${base}/materials?new=1&job=${jobId}`} className="text-[13px]" style={link}>+ Raise PO</Link></div>
      {toOrder.length > 0 && !orderOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5" style={{ background: "var(--tws-ground)" }}>
          <span className="text-[13px]">{toOrder.length} estimated material{toOrder.length === 1 ? "" : "s"} on the parts not ordered yet ({gbp(materialsCost(toOrder))})</span>
          <button type="button" onClick={openOrder} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Order from the estimates</button>
        </div>
      )}
      {orderOpen && (
        <div className="flex flex-col gap-2.5 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
          <div className="flex justify-between items-baseline gap-2 flex-wrap">
            <strong className="text-sm">Order from the estimates</strong>
            <span className="flex gap-3 text-xs">
              <button type="button" onClick={() => setOrderPick(new Set(toOrder.map(m => m.id)))} style={link}>Pick all</button>
              <button type="button" onClick={() => setOrderPick(new Set())} style={muted}>Clear</button>
            </span>
          </div>
          <ul className="flex flex-col m-0 p-0 list-none text-[13px]">
            {toOrder.map(m => (
              <li key={m.id} className="py-1.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                <input type="checkbox" aria-label={`Order ${m.description}`} checked={orderPick.has(m.id)} onChange={() => setOrderPick(s => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} style={{ accentColor: "var(--tws-char)" }} />
                <span className="flex-1 min-w-0 break-words">{m.description} <span style={muted}>· {m.quantity} {m.unit ?? ""} · {m.partLabel}</span>{m.stockItemId && <span className="ml-1 text-[11px] font-bold" style={{ color: "var(--tws-warn-ink)" }}>in stock</span>}</span>
                {seeMoney && <span className="tabular-nums shrink-0">{gbp(m.quantity * m.unitCost)}</span>}
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label htmlFor="om-sup" style={lbl}>Supplier</label>
              <select id="om-sup" style={input} value={orderSup.supplierId} onChange={e => setOrderSup({ ...orderSup, supplierId: e.target.value })}>
                <option value="">Not in the list (type it)</option>{(suppliers ?? []).map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select></div>
            {!orderSup.supplierId && <div><label htmlFor="om-supname" style={lbl}>Supplier name</label><input id="om-supname" style={input} value={orderSup.supplierName} onChange={e => setOrderSup({ ...orderSup, supplierName: e.target.value })} placeholder="e.g. Stoke Timber Ltd" /></div>}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" disabled={busy || !orderPick.size} onClick={() => orderMaterials(true)} style={{ ...btnSolid, padding: "8px 14px" }}>Submit PO ({gbp(materialsCost(toOrder.filter(m => orderPick.has(m.id))))})</button>
            <button type="button" disabled={busy || !orderPick.size} onClick={() => orderMaterials(false)} style={{ ...btnLine, padding: "8px 14px" }}>Save as draft</button>
            {toOrder.some(m => m.stockItemId && orderPick.has(m.id)) && <button type="button" disabled={busy} onClick={bookOutMaterials} style={{ ...btnLine, padding: "8px 14px" }}>Book out from stock ({toOrder.filter(m => m.stockItemId && orderPick.has(m.id)).length})</button>}
            <button type="button" onClick={() => setOrderOpen(false)} className="text-sm underline" style={muted}>Cancel</button>
          </div>
          <span className="text-xs" style={muted}>Submit or save makes one purchase order for this build at the estimated costs (change prices on the PO if the supplier&apos;s differ); over the approval limit it waits for approval. Lines marked &ldquo;in stock&rdquo; can be booked out from stock instead.</span>
        </div>
      )}
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
  );
}
