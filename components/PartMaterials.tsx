"use client";

// Estimated materials for one part of a build (27 Nov 2026), in the space's look. Type to search
// stock and what we last paid on purchase orders; units follow the section; "Add" clears the
// boxes for the next line. These feed "Quote this build" (each part's labour + materials).
import { useEffect, useRef, useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { QUOTE_SECTIONS, unitsFor } from "@/lib/quoteUnits";
import { muted, btnSolid, input } from "@/lib/twsUi";

export type PartMaterial = { id: number; section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; stockItemId: number | null; po?: { id: number; number: string; status: string } | null };
/** On a live purchase order (a cancelled one frees it again). */
export const ordered = (m: PartMaterial) => !!m.po && m.po.status !== "cancelled";
type Lookup = { stock: { id: number; name: string; unit: string; quantity: number; unitCost: number | null; section: string | null }[]; recent: { description: string; unit: string | null; unitCost: number; supplier: string | null; poNumber: string; date: string }[] };
type Row = { section: string; description: string; quantity: string; unit: string; unitCost: string; stockItemId: number | null };

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const BLANK: Row = { section: "", description: "", quantity: "1", unit: "", unitCost: "", stockItemId: null };
const cell: React.CSSProperties = { ...input, padding: "6px 8px", fontSize: 13 };

export const materialsCost = (ms: PartMaterial[]) => ms.reduce((s, m) => s + m.quantity * m.unitCost, 0);

export default function PartMaterials({ jobId, partId, entityId, materials, onChange }: {
  jobId: number; partId: number; entityId: number | null; materials: PartMaterial[]; onChange: (materials: PartMaterial[]) => void;
}) {
  const [entry, setEntry] = useState<Row>({ ...BLANK, section: materials[materials.length - 1]?.section ?? "" });
  const [found, setFound] = useState<Lookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [stockNote, setStockNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  const url = `/api/jobs/${jobId}/parts/${partId}/materials`;

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

  async function call(u: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(u, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return false; }
    if (Array.isArray(d.materials)) onChange(d.materials);
    return true;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!entry.description.trim()) { descRef.current?.focus(); return; }
    if (await call(url, "POST", entry)) {
      setEntry({ ...BLANK, section: entry.section }); setFound(null); setSearching(false); setStockNote(null);
      descRef.current?.focus();
    }
  }
  const update = (m: PartMaterial, patch: Partial<Record<keyof Row, string>>) => call(`${url}/${m.id}`, "PATCH", patch);

  const total = materialsCost(materials);
  return (
    <div className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-ground)" }}>
      {materials.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr className="text-xs text-left" style={muted}><th className="py-1 pr-1 font-semibold">Material</th><th className="py-1 pr-1 font-semibold w-20">Qty</th><th className="py-1 pr-1 font-semibold w-20">Unit</th><th className="py-1 pr-1 font-semibold w-24">£ each</th><th className="py-1 pr-1 font-semibold w-24 text-right">Cost</th><th className="w-6" /></tr></thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id} style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                  <td className="py-1 pr-1">{m.description}{m.section ? <span style={muted}> · {m.section}</span> : null}
                    {ordered(m) && <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5" style={{ background: "var(--tws-char)", color: "#fff" }}>On {m.po!.number}</span>}
                    {!ordered(m) && m.stockItemId && <span className="ml-1.5 text-[11px]" style={muted}>(from stock)</span>}</td>
                  <td className="py-1 pr-1"><input aria-label={`Quantity of ${m.description}`} type="number" step="any" min={0} disabled={ordered(m)} style={cell} defaultValue={m.quantity} onBlur={e => Number(e.target.value) !== m.quantity && update(m, { quantity: e.target.value })} /></td>
                  <td className="py-1 pr-1">{m.unit ?? ""}</td>
                  <td className="py-1 pr-1"><input aria-label={`Cost each of ${m.description}`} type="number" step="any" min={0} disabled={ordered(m)} style={cell} defaultValue={m.unitCost} onBlur={e => Number(e.target.value) !== m.unitCost && update(m, { unitCost: e.target.value })} /></td>
                  <td className="py-1 pr-1 text-right tabular-nums">{gbp(m.quantity * m.unitCost)}</td>
                  <td><button type="button" aria-label={`Remove ${m.description}`} disabled={busy || ordered(m)} title={ordered(m) ? `On ${m.po!.number}: change the purchase order instead` : undefined} onClick={() => call(`${url}/${m.id}`, "DELETE")} style={{ color: "var(--tws-bad-ink)" }}>✕</button></td>
                </tr>
              ))}
              <tr className="font-bold" style={{ borderTop: "2px solid var(--tws-char)" }}><td className="py-1" colSpan={4}>Materials for this part</td><td className="py-1 pr-1 text-right tabular-nums">{gbp(total)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={add} className="grid gap-2 grid-cols-2 sm:grid-cols-3 2xl:grid-cols-[8rem_minmax(0,1fr)_4.5rem_5.5rem_6rem_auto] items-start" aria-label="Add a material to this part">
        <input aria-label="Material section" list={`pm-sections-${partId}`} placeholder="Section" style={cell} value={entry.section} onChange={e => setEntry({ ...entry, section: e.target.value })} />
        <datalist id={`pm-sections-${partId}`}>{QUOTE_SECTIONS.map(s => <option key={s} value={s} />)}</datalist>
        <div className="relative col-span-2 2xl:col-span-1">
          <input ref={descRef} aria-label="Material" placeholder="Material: type to search stock and past prices" autoComplete="off" style={cell}
            value={entry.description} onChange={e => { setEntry({ ...entry, description: e.target.value, stockItemId: null }); setSearching(true); setStockNote(null); }}
            onKeyDown={e => { if (e.key === "Escape") { setFound(null); setSearching(false); } }} />
          {found && searching && entry.description.trim().length >= 2 && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto text-xs shadow-xl" style={{ background: "#fff", border: "1px solid var(--tws-line)" }} role="listbox" aria-label="Stock and past prices">
              {found.stock.map(st => (
                <button key={`s${st.id}`} type="button" role="option" aria-selected={false} className="w-full text-left px-2 py-1.5 flex justify-between gap-3 hover:bg-black/5"
                  onClick={() => { setEntry(en => ({ ...en, description: st.name, unit: st.unit, unitCost: st.unitCost != null ? String(st.unitCost) : en.unitCost, section: st.section || en.section, stockItemId: st.id })); setStockNote(`${st.quantity} ${st.unit} in stock`); setFound(null); setSearching(false); }}>
                  <span className="truncate">{st.name}</span><span className="shrink-0" style={muted}>{st.quantity} {st.unit} in stock{st.unitCost != null ? ` · ${gbp(st.unitCost)}/${st.unit}` : ""}</span>
                </button>
              ))}
              {found.recent.map(rc => (
                <button key={`r${rc.poNumber}${rc.description}`} type="button" role="option" aria-selected={false} className="w-full text-left px-2 py-1.5 flex justify-between gap-3 hover:bg-black/5"
                  onClick={() => { setEntry(en => ({ ...en, description: rc.description, unit: rc.unit ?? en.unit, unitCost: String(rc.unitCost), stockItemId: null })); setStockNote(`last paid ${gbp(rc.unitCost)} (${rc.supplier ?? "supplier"})`); setFound(null); setSearching(false); }}>
                  <span className="truncate">{rc.description}</span><span className="shrink-0" style={muted}>last paid {gbp(rc.unitCost)}{rc.unit ? `/${rc.unit}` : ""} · {rc.supplier ?? "supplier"}</span>
                </button>
              ))}
              <button type="button" onClick={() => { setFound(null); setSearching(false); }} className="w-full text-left px-2 py-1.5" style={{ ...muted, borderTop: "1px solid var(--tws-line-soft)" }}>Something else: keep what I typed</button>
            </div>
          )}
        </div>
        <input aria-label="Material quantity" type="number" step="any" min={0} placeholder="Qty" style={cell} value={entry.quantity} onChange={e => setEntry({ ...entry, quantity: e.target.value })} />
        <div><input aria-label="Material unit" list={`pm-units-${partId}`} placeholder="Unit" style={cell} value={entry.unit} onChange={e => setEntry({ ...entry, unit: e.target.value })} /><datalist id={`pm-units-${partId}`}>{unitsFor(entry.section).map(u => <option key={u} value={u} />)}</datalist></div>
        <input aria-label="Material cost each" type="number" step="any" min={0} placeholder="£ each" style={cell} value={entry.unitCost} onChange={e => setEntry({ ...entry, unitCost: e.target.value })} />
        <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Add</button>
      </form>
      <span className="text-xs" style={muted}>
        {stockNote ? `${stockNote} · ` : ""}{entry.section ? `Units for ${entry.section}: ${unitsFor(entry.section).join(", ")} · ` : ""}Costs are what it costs us, ex VAT. Markup is added when you quote.
      </span>
    </div>
  );
}
