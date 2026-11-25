"use client";

// Labour types for a workshop (28 Nov 2026), in the space's look: the kinds of work it prices,
// each with what a day costs us. Searched in quotes and variations like stock; picked on parts.
import { useEffect, useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { card, h2, muted, link, btnSolid, input } from "@/lib/twsUi";

type L = { id: number; name: string; dayRate: number | null; notes: string | null; archived: boolean; _count: { parts: number } };
const cell: React.CSSProperties = { ...input, padding: "6px 8px", fontSize: 13 };

export default function LabourTypes({ slug }: { slug: string }) {
  const [list, setList] = useState<L[] | null>(null);
  const [add, setAdd] = useState({ name: "", dayRate: "" });
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  useEffect(() => { fetch(`/api/spaces/${slug}/labour-types`).then(r => (r.ok ? r.json() : [])).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([])); }, [slug]);

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return false; }
    if (Array.isArray(d)) setList(d);
    return true;
  }
  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/spaces/${slug}/labour-types`, "POST", add)) setAdd({ name: "", dayRate: "" });
  }
  const shown = (list ?? []).filter(l => showRetired || !l.archived);
  const noRate = (list ?? []).filter(l => !l.archived && l.dayRate == null).length;

  return (
    <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Labour types">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h2 style={h2}>Labour types</h2>
        <span className="text-xs" style={muted}>Cost per day (an hour is ÷ 8). Search them in quotes; pick them on parts.</span>
      </div>
      {list === null ? <p className="text-sm m-0" style={muted}>Loading…</p> : list.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span style={muted}>None yet.</span>
          <button type="button" disabled={busy} onClick={() => call(`/api/spaces/${slug}/labour-types`, "POST", { usual: true })} className="font-semibold" style={link}>Add the usual ones (Carpenter, Scenic artist, Welder…)</button>
        </div>
      ) : (
        <ul className="flex flex-col m-0 p-0 list-none">
          {shown.map(l => (
            <li key={`${l.id}-${l.name}-${l.dayRate}`} className="py-2 grid gap-2 items-center grid-cols-[minmax(0,1fr)_7rem_auto]" style={{ borderTop: "1px solid var(--tws-line-soft)", opacity: l.archived ? 0.55 : 1 }}>
              <input aria-label={`Name of ${l.name}`} style={cell} defaultValue={l.name} onBlur={e => e.target.value.trim() && e.target.value.trim() !== l.name && call(`/api/labour-types/${l.id}`, "PATCH", { name: e.target.value })} />
              <label className="flex items-center gap-1 text-xs" style={muted}>£<input aria-label={`Day rate for ${l.name}`} type="number" min={0} step="any" placeholder="/day" style={{ ...cell, ...(l.dayRate == null ? { borderColor: "var(--tws-warn-line)" } : {}) }} defaultValue={l.dayRate ?? ""}
                onBlur={e => (e.target.value === "" ? l.dayRate !== null : Number(e.target.value) !== l.dayRate) && call(`/api/labour-types/${l.id}`, "PATCH", { dayRate: e.target.value })} /></label>
              <button type="button" disabled={busy} onClick={() => call(`/api/labour-types/${l.id}`, "PATCH", { archived: !l.archived })} className="text-xs" style={muted} title={l._count.parts ? `On ${l._count.parts} part${l._count.parts === 1 ? "" : "s"}` : undefined}>{l.archived ? "Restore" : "Retire"}</button>
            </li>
          ))}
        </ul>
      )}
      {noRate > 0 && <p className="text-xs m-0" style={{ color: "var(--tws-warn-ink)" }}>{noRate} without a day rate yet: parts of that type are costed at the standard workshop rate until you add one.</p>}
      <form onSubmit={addOne} className="grid gap-2 grid-cols-[minmax(0,1fr)_7rem_auto] items-center">
        <input aria-label="New labour type" placeholder="e.g. Upholsterer" style={cell} value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} />
        <input aria-label="New labour type day rate" type="number" min={0} step="any" placeholder="£/day" style={cell} value={add.dayRate} onChange={e => setAdd({ ...add, dayRate: e.target.value })} />
        <button type="submit" disabled={busy || !add.name.trim()} style={{ ...btnSolid, padding: "6px 12px", fontSize: 13 }}>Add</button>
      </form>
      {(list ?? []).some(l => l.archived) && <button type="button" onClick={() => setShowRetired(!showRetired)} className="self-start text-xs underline" style={muted}>{showRetired ? "Hide retired" : "Show retired"}</button>}
    </section>
  );
}
