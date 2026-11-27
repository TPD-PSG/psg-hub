"use client";

// Packages: a ready-made group of products (e.g. "Small PA": 2 tops, 2 subs, a desk and cables).
// Adding one to a hire adds its products as lines, which can then be changed for that hire.
import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { card, h2, muted, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";
import { RentalsHeader, api } from "@/components/rentals/shared";
import { gbp, type RentalsData, type Pkg } from "@/components/rentals/format";
import LineEditor, { type EditLine } from "@/components/rentals/LineEditor";

export default function Packages({ initial }: { initial: RentalsData }) {
  const [data, setData] = useState(initial);
  const { space, products, packages } = data;
  const [form, setForm] = useState<{ id?: number; name: string; description: string; items: EditLine[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = async () => { const d = await api<RentalsData>(`/api/spaces/${space.slug}/rentals`); if (d) setData(d); };
  const dayTotal = (p: { items: { productId: number; quantity: number }[] }) => p.items.reduce((a, i) => a + (products.find(x => x.id === i.productId)?.dayRate ?? 0) * i.quantity, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body = { name: form.name, description: form.description, items: form.items.filter(i => i.quantity > 0) };
    const ok = await api(form.id ? `/api/rentals/packages/${form.id}` : `/api/spaces/${space.slug}/rentals/packages`, form.id ? "PATCH" : "POST", body);
    setBusy(false);
    if (ok) { setForm(null); reload(); }
  }
  async function remove(p: Pkg) {
    if (!(await confirmDialog(`Delete the ${p.name} package? Hires it was added to keep their kit. This can't be undone.`, { danger: true, confirmLabel: "Delete" }))) return;
    if (await api(`/api/rentals/packages/${p.id}`, "DELETE")) reload();
  }

  return (
    <>
      <RentalsHeader space={space} title="Packages" line="Ready-made groups of kit to add to a hire in one go">
        <button type="button" style={btnSolid} disabled={!products.length} onClick={() => setForm({ name: "", description: "", items: [] })}>+ New package</button>
      </RentalsHeader>
      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-2 items-start">
        <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Packages">
          {!products.length ? <p className="text-sm" style={muted}>Add kit first, then group it into packages.</p>
            : !packages.length ? <p className="text-sm" style={muted}>No packages yet. Make one for anything you often send out together.</p>
            : packages.map(p => (
              <div key={p.id} className="flex flex-col gap-1 pb-3" style={{ borderBottom: "1px solid var(--tws-line)" }}>
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0"><h2 style={h2}>{p.name}</h2>{p.description && <p className="text-sm" style={muted}>{p.description}</p>}</div>
                  <div className="flex gap-3 shrink-0">
                    <button type="button" className="text-sm font-semibold" style={{ color: "var(--tws-accent-ink)" }} onClick={() => setForm({ id: p.id, name: p.name, description: p.description ?? "", items: p.items.map(i => ({ productId: i.productId, quantity: i.quantity })) })}>Edit</button>
                    <button type="button" className="text-sm font-semibold" style={{ color: "var(--tws-bad-ink)" }} onClick={() => remove(p)}>Delete</button>
                  </div>
                </div>
                <ul className="text-sm">{p.items.map(i => <li key={i.productId}>{i.quantity} × {i.product.name}</li>)}</ul>
                <span className="text-xs" style={muted}>{gbp(dayTotal(p))} a day at list rates</span>
              </div>
            ))}
        </section>
        {form && (
          <form onSubmit={save} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-3" aria-label={form.id ? "Edit package" : "New package"}>
            <h2 style={h2}>{form.id ? `Edit ${form.name}` : "New package"}</h2>
            <div><label style={lbl} htmlFor="pk-name">Name</label><input id="pk-name" style={input} required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Small PA" /></div>
            <div><label style={lbl} htmlFor="pk-desc">Description</label><input id="pk-desc" style={input} maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <LineEditor products={products} lines={form.items} onChange={items => setForm({ ...form, items })} label="Products in it" />
            <span className="text-sm" style={muted}>{gbp(dayTotal(form))} a day at list rates</span>
            <div className="flex gap-2"><button type="submit" disabled={busy || !form.items.some(i => i.quantity > 0)} style={btnSolid}>Save package</button><button type="button" style={btnLine} onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        )}
      </div>
    </>
  );
}
