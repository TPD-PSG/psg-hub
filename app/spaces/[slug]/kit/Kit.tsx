"use client";

// Kit: rental products by category, each with its serialised units (barcode on every unit,
// cables included). Search finds products by name, or a unit by its barcode: a handheld
// scanner types the code and presses Enter.
import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { groupByCategory, RENTAL_CATEGORIES, UNIT_STATUS } from "@/lib/rentals";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, Chip, api, th, td } from "@/components/rentals/shared";
import { gbp, day, HIRE_TONE, HIRE_LABEL, type RentalsData, type Product } from "@/components/rentals/format";

type Unit = { id: number; barcode: string; serial: string | null; status: string; location: string | null; notes: string | null; containerId: number | null;
  container: { id: number; barcode: string; product: { name: string } } | null; contents: { id: number; barcode: string; product: { name: string } }[];
  hireUnits?: { hire: { id: number; number: string; title: string } }[] };
type Detail = Product & { units: Unit[]; hireLines: { id: number; quantity: number; hire: { id: number; number: string; title: string; status: string; outDate: string; returnDate: string } }[] };
type Form = { id?: number; name: string; category: string; manufacturer: string; model: string; dayRate: string; weekRate: string; replacementCost: string; weightKg: string; powerW: string; isCase: boolean; notes: string; count: string; barcodes: string };

const blank = (): Form => ({ name: "", category: "", manufacturer: "", model: "", dayRate: "", weekRate: "", replacementCost: "", weightKg: "", powerW: "", isCase: false, notes: "", count: "1", barcodes: "" });
const num = (v: number | null) => (v == null ? "" : String(v));

export default function Kit({ initial, openId, q: q0 }: { initial: RentalsData; openId: number | null; q: string }) {
  const [data, setData] = useState(initial);
  const { space } = data;
  const [q, setQ] = useState(q0);
  const [cat, setCat] = useState("all");
  const [form, setForm] = useState<Form | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [hit, setHit] = useState<string | null>(null); // barcode found by a scan
  const [addUnits, setAddUnits] = useState({ count: "1", barcodes: "" });
  const [busy, setBusy] = useState(false);
  const S = `/api/spaces/${space.slug}/rentals`;

  const reload = async () => { const d = await api<RentalsData>(S); if (d) setData(d); };
  const openProduct = async (id: number, barcode?: string) => {
    const d = await api<Detail>(`/api/rentals/products/${id}`);
    if (d) { setOpen(d); setHit(barcode ?? null); setForm(null); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- opens the product named in the link, once
  useEffect(() => { if (openId) openProduct(openId); }, [openId]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.products.filter(p => (cat === "all" || (p.category || "Other") === cat) && (!t || [p.name, p.manufacturer, p.model, p.category].some(x => x?.toLowerCase().includes(t))));
  }, [data.products, q, cat]);
  const groups = groupByCategory(shown);
  const cats = groupByCategory(data.products).map(g => g.category);
  const units = data.products.reduce((a, p) => a + p.units.total, 0);

  // Enter in the search box: a barcode opens its unit's product
  async function scan(e: React.FormEvent) {
    e.preventDefault();
    const code = q.trim();
    if (!code || shown.length === 1) { if (shown.length === 1) openProduct(shown[0].id); return; }
    const r = await fetch(`${S}/scan?barcode=${encodeURIComponent(code)}`);
    if (r.ok) { const u = await r.json(); setQ(""); openProduct(u.product.id, u.barcode); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body = { name: form.name, category: form.category, manufacturer: form.manufacturer, model: form.model, dayRate: form.dayRate, weekRate: form.weekRate, replacementCost: form.replacementCost, weightKg: form.weightKg, powerW: form.powerW, isCase: form.isCase, notes: form.notes,
      ...(form.id ? {} : form.barcodes.trim() ? { barcodes: form.barcodes } : { count: form.count }) };
    const r = await api<{ id: number }>(form.id ? `/api/rentals/products/${form.id}` : `${S}/products`, form.id ? "PATCH" : "POST", body);
    setBusy(false);
    if (r) { setForm(null); await reload(); openProduct(r.id); }
  }

  async function remove(p: Detail) {
    if (!(await confirmDialog(p.hireLines.length ? `Archive ${p.name}? It's been on hires, so it stays on record but leaves the kit list.` : `Delete ${p.name} and its ${p.units.length} unit${p.units.length === 1 ? "" : "s"}? This can't be undone.`, { danger: true, confirmLabel: p.hireLines.length ? "Archive" : "Delete" }))) return;
    if (await api(`/api/rentals/products/${p.id}`, "DELETE")) { setOpen(null); reload(); }
  }

  async function addMore(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    const r = await api(`/api/rentals/products/${open.id}/units`, "POST", addUnits.barcodes.trim() ? { barcodes: addUnits.barcodes } : { count: addUnits.count });
    setBusy(false);
    if (r) { setAddUnits({ count: "1", barcodes: "" }); openProduct(open.id); reload(); }
  }

  async function unit(u: Unit, change: Record<string, unknown>) {
    if (await api(`/api/rentals/units/${u.id}`, "PATCH", change) && open) { openProduct(open.id, hit ?? undefined); reload(); }
  }
  async function removeUnit(u: Unit) {
    if (!(await confirmDialog(`Delete unit ${u.barcode}? Only for units added by mistake: mark real ones retired or lost instead. This can't be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    if (await api(`/api/rentals/units/${u.id}`, "DELETE") && open) { openProduct(open.id); reload(); }
  }

  const f = (k: keyof Form) => ({ value: form![k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form!, [k]: e.target.value }) });

  return (
    <>
      <RentalsHeader space={space} title="Kit" line={`${data.products.length} product${data.products.length === 1 ? "" : "s"} · ${units} unit${units === 1 ? "" : "s"}, each with its own barcode`}>
        <button type="button" style={btnSolid} onClick={() => { setForm(blank()); setOpen(null); }}>+ Add product</button>
      </RentalsHeader>
      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 xl:grid-cols-5 items-start">
        <section style={card} className="xl:col-span-3 flex flex-col gap-4 min-w-0" aria-label="Products">
          <form onSubmit={scan} className="flex gap-2">
            <label htmlFor="kit-q" className="sr-only">Search or scan</label>
            <input id="kit-q" style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search products, or scan a barcode" autoComplete="off" />
            <button type="submit" style={btnLine}>Find</button>
          </form>
          {cats.length > 1 && <div className="flex flex-wrap gap-1.5">
            <Chip on={cat === "all"} onClick={() => setCat("all")}>All</Chip>
            {cats.map(c => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          </div>}
          {data.products.length === 0 ? (
            <p className="text-sm" style={muted}>No kit yet. Add your first product: give it a name and how many units you have, and each unit gets its own barcode (or type in the barcodes already on the stickers).</p>
          ) : shown.length === 0 ? <p className="text-sm" style={muted}>Nothing matches “{q}”. Press Enter to look it up as a barcode.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Product</th><th style={th}>Day rate</th><th style={{ ...th, textAlign: "right" }}>Units</th><th style={{ ...th, textAlign: "right" }}>Ready</th><th style={{ ...th, textAlign: "right" }}>Out today</th></tr></thead>
                {groups.map(g => (
                  <tbody key={g.category}>
                    <tr><td colSpan={5} style={{ ...td, background: "var(--tws-tint)", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>{g.category}</td></tr>
                    {g.items.map(p => (
                      <tr key={p.id} style={open?.id === p.id ? { background: "var(--tws-accent-light)" } : undefined}>
                        <td style={td}><button type="button" onClick={() => openProduct(p.id)} className="text-left font-semibold underline-offset-2 hover:underline" style={{ color: "var(--tws-ink)" }}>{p.name}</button>
                          <div className="text-xs" style={muted}>{[p.manufacturer, p.model].filter(Boolean).join(" ")}{p.isCase ? (p.manufacturer || p.model ? " · " : "") + "Case" : ""}</div></td>
                        <td style={td}>{gbp(p.dayRate)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{p.units.total}</td>
                        <td style={{ ...td, textAlign: "right" }}>{p.units.available}{p.units.repair ? <span className="block text-xs" style={{ color: "var(--tws-warn-ink)" }}>{p.units.repair} in repair</span> : null}</td>
                        <td style={{ ...td, textAlign: "right" }}>{p.outToday || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>

        <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
          {form && (
            <form onSubmit={save} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-3" aria-label={form.id ? "Edit product" : "Add product"}>
              <h2 style={h2}>{form.id ? `Edit ${form.name}` : "Add a product"}</h2>
              <div><label style={lbl} htmlFor="p-name">Name</label><input id="p-name" style={input} required maxLength={120} {...f("name")} placeholder="e.g. Robe MegaPointe, 16A 10m cable" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lbl} htmlFor="p-cat">Category</label><input id="p-cat" style={input} list="rental-cats" maxLength={40} {...f("category")} /></div>
                <div><label style={lbl} htmlFor="p-man">Make</label><input id="p-man" style={input} maxLength={80} {...f("manufacturer")} /></div>
                <div><label style={lbl} htmlFor="p-model">Model</label><input id="p-model" style={input} maxLength={80} {...f("model")} /></div>
                <div><label style={lbl} htmlFor="p-day">Day rate £ (ex VAT)</label><input id="p-day" style={input} inputMode="decimal" {...f("dayRate")} /></div>
                <div><label style={lbl} htmlFor="p-week">Week rate £</label><input id="p-week" style={input} inputMode="decimal" {...f("weekRate")} /></div>
                <div><label style={lbl} htmlFor="p-rep">Replacement cost £</label><input id="p-rep" style={input} inputMode="decimal" {...f("replacementCost")} /></div>
                <div><label style={lbl} htmlFor="p-kg">Weight kg</label><input id="p-kg" style={input} inputMode="decimal" {...f("weightKg")} /></div>
                <div><label style={lbl} htmlFor="p-w">Power W</label><input id="p-w" style={input} inputMode="decimal" {...f("powerW")} /></div>
              </div>
              <datalist id="rental-cats">{RENTAL_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isCase} onChange={e => setForm({ ...form, isCase: e.target.checked })} /> This is a case or rack that other units are packed in</label>
              {!form.id && (
                <div className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-tint)" }}>
                  <span className="text-sm font-semibold">Units</span>
                  <div><label style={lbl} htmlFor="p-count">How many (each gets a new barcode)</label><input id="p-count" style={{ ...input, maxWidth: 120 }} inputMode="numeric" {...f("count")} disabled={!!form.barcodes.trim()} /></div>
                  <div><label style={lbl} htmlFor="p-codes">…or the barcodes already on them, one per line (scan them in)</label><textarea id="p-codes" style={input} rows={3} {...f("barcodes")} /></div>
                </div>
              )}
              <div><label style={lbl} htmlFor="p-notes">Notes</label><textarea id="p-notes" style={input} rows={2} maxLength={2000} {...f("notes")} /></div>
              <div className="flex gap-2"><button type="submit" disabled={busy} style={btnSolid}>{form.id ? "Save" : "Add product"}</button><button type="button" style={btnLine} onClick={() => setForm(null)}>Cancel</button></div>
            </form>
          )}

          {open && !form && (
            <section style={card} className="flex flex-col gap-4 min-w-0" aria-label={open.name}>
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0"><h2 style={h2}>{open.name}</h2>
                  <p className="text-sm" style={muted}>{[open.category, [open.manufacturer, open.model].filter(Boolean).join(" "), open.isCase ? "Case" : null].filter(Boolean).join(" · ")}</p></div>
                <button type="button" style={btnLine} onClick={() => setForm({ id: open.id, name: open.name, category: open.category ?? "", manufacturer: open.manufacturer ?? "", model: open.model ?? "", dayRate: num(open.dayRate), weekRate: num(open.weekRate), replacementCost: num(open.replacementCost), weightKg: num(open.weightKg), powerW: num(open.powerW), isCase: open.isCase, notes: open.notes ?? "", count: "", barcodes: "" })}>Edit</button>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                {[["Day", gbp(open.dayRate)], ["Week", gbp(open.weekRate)], ["Replacement", gbp(open.replacementCost)], ["Weight", open.weightKg != null ? `${open.weightKg} kg` : "—"], ["Power", open.powerW != null ? `${open.powerW} W` : "—"]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs" style={muted}>{k}</dt><dd className="font-semibold">{v}</dd></div>))}
              </dl>
              {open.notes && <p className="text-sm whitespace-pre-wrap">{open.notes}</p>}

              <h3 className="font-bold text-sm">Units ({open.units.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Barcode</th><th style={th}>Status</th><th style={th}>Serial · shelf</th><th style={th}>{open.isCase ? "Holds" : "Case"}</th><th style={th}><span className="sr-only">Remove</span></th></tr></thead>
                  <tbody>{open.units.map(u => (
                    <tr key={u.id} style={hit === u.barcode ? { background: "var(--tws-accent-light)" } : undefined}>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{u.barcode}</td>
                      <td style={td}><select aria-label={`Status of ${u.barcode}`} style={{ ...input, padding: "4px 6px", width: "auto" }} value={u.status} onChange={e => unit(u, { status: e.target.value })}>
                        {Object.entries(UNIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                        {u.hireUnits?.[0] && <a href={`/spaces/${space.slug}/hires?hire=${u.hireUnits[0].hire.id}`} className="block text-xs font-bold mt-1" style={{ color: "var(--tws-accent-ink)" }}>Out on {u.hireUnits[0].hire.number}</a>}</td>
                      <td style={td}>
                        <input aria-label={`Serial of ${u.barcode}`} style={{ ...input, padding: "4px 6px" }} defaultValue={u.serial ?? ""} placeholder="Serial" onBlur={e => e.target.value !== (u.serial ?? "") && unit(u, { serial: e.target.value })} />
                        <input aria-label={`Shelf of ${u.barcode}`} style={{ ...input, padding: "4px 6px", marginTop: 4 }} defaultValue={u.location ?? ""} placeholder="Shelf" onBlur={e => e.target.value !== (u.location ?? "") && unit(u, { location: e.target.value })} />
                      </td>
                      <td style={td}>{open.isCase ? (u.contents.length ? u.contents.map(c => c.barcode).join(", ") : <span style={muted}>Empty</span>)
                        : <input aria-label={`Case for ${u.barcode}`} style={{ ...input, padding: "4px 6px" }} defaultValue={u.container?.barcode ?? ""} placeholder="Case barcode" onBlur={e => e.target.value.trim().toUpperCase() !== (u.container?.barcode ?? "") && unit(u, { case: e.target.value })} />}</td>
                      <td style={td}><button type="button" onClick={() => removeUnit(u)} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }}>Delete</button></td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <form onSubmit={addMore} className="flex flex-col gap-2 p-3" style={{ background: "var(--tws-tint)" }} aria-label="Add units">
                <span className="text-sm font-semibold">Add units</span>
                <div className="flex gap-2 items-end flex-wrap">
                  <div><label style={lbl} htmlFor="u-count">How many</label><input id="u-count" style={{ ...input, width: 90 }} inputMode="numeric" value={addUnits.count} disabled={!!addUnits.barcodes.trim()} onChange={e => setAddUnits({ ...addUnits, count: e.target.value })} /></div>
                  <div className="flex-1 min-w-[180px]"><label style={lbl} htmlFor="u-codes">…or their barcodes, one per line</label><textarea id="u-codes" style={input} rows={2} value={addUnits.barcodes} onChange={e => setAddUnits({ ...addUnits, barcodes: e.target.value })} /></div>
                  <button type="submit" disabled={busy} style={btnSolid}>Add</button>
                </div>
              </form>

              <h3 className="font-bold text-sm">On hires from today</h3>
              {open.hireLines.length === 0 ? <p className="text-sm" style={muted}>Not on any hire.</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">{open.hireLines.map(l => (
                  <li key={l.id} className="flex gap-2 items-center flex-wrap"><a href={`/spaces/${space.slug}/hires?hire=${l.hire.id}`} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>{l.hire.number} {l.hire.title}</a>
                    <span style={muted}>{l.quantity} · {day(l.hire.outDate)} – {day(l.hire.returnDate)}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5" style={HIRE_TONE[l.hire.status]}>{HIRE_LABEL[l.hire.status]}</span></li>))}</ul>
              )}
              <button type="button" onClick={() => remove(open)} className="self-start text-sm font-semibold" style={{ color: "var(--tws-bad-ink)" }}>{open.hireLines.length ? "Archive product" : "Delete product"}</button>
            </section>
          )}
          {!open && !form && <section style={card}><p className="text-sm" style={muted}>Pick a product to see its units, or scan a barcode into the search box. Every unit has its own barcode, cables included.</p></section>}
        </div>
      </div>
    </>
  );
}
