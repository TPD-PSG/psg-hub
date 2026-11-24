"use client";

// Hub Settings: the group's companies (entities) and each one's yearly revenue target.
// Deals, productions and the Director forecast are split by these.
import { useEffect, useState } from "react";
import type { EntityRow } from "@/lib/entities";
import { confirmDialog, alertDialog } from "@/components/Dialogs";

const inp = "rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export default function EntitiesPanel({ initial }: { initial: EntityRow[] | null }) {
  const [entities, setEntities] = useState<EntityRow[]>(initial ?? []);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const year = new Date().getFullYear();
  const years = [year, year + 1];

  async function reload() {
    const d = await fetch("/api/entities").then(r => r.json()).catch(() => null);
    if (Array.isArray(d)) setEntities(d);
  }
  // Only when the list didn't arrive with the page
  useEffect(() => {
    if (initial) return;
    fetch("/api/entities").then(r => r.json()).then(d => { if (Array.isArray(d)) setEntities(d); }).catch(() => {});
  }, [initial]);

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) await alertDialog((await res.json().catch(() => ({}))).error ?? "That didn't work");
    return res.ok;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (await call("/api/entities", "POST", { name })) { setName(""); reload(); }
  }
  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    if (await call(`/api/entities/${renaming.id}`, "PUT", { name: renaming.name })) { setRenaming(null); reload(); }
  }
  async function setTarget(id: number, y: number, raw: string, current: number | undefined) {
    const amount = raw.replace(/[£,\s]/g, "");
    if ((amount === "" && current === undefined) || Number(amount) === current) return;
    if (await call(`/api/entities/${id}/targets`, "PUT", { year: y, amount })) reload();
  }
  async function archive(en: EntityRow) {
    if (await call(`/api/entities/${en.id}`, "PUT", { archived: !en.archived })) reload();
  }
  async function remove(en: EntityRow) {
    if (!await confirmDialog(`Delete ${en.name}? This can't be undone. (An entity already used by deals or productions can only be archived.)`)) return;
    if (await call(`/api/entities/${en.id}`, "DELETE")) reload();
  }
  async function move(en: EntityRow, dir: -1 | 1) {
    const list = entities.filter(e => !e.archived);
    const i = list.findIndex(e => e.id === en.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // Number them 0, 1, 2… in the new order, saving only those whose number changed
    await Promise.all(list.map((e, k) => (e.sortOrder === k ? null : call(`/api/entities/${e.id}`, "PUT", { sortOrder: k }))));
    reload();
  }

  const active = entities.filter(e => !e.archived);
  const archived = entities.filter(e => e.archived);
  const shown = showArchived ? [...active, ...archived] : active;

  return (
    <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div>
        <h2 className="font-semibold text-white">Entities &amp; revenue targets</h2>
        <p className="text-sm mt-1" style={{ color: "var(--psg-muted)" }}>
          The group&apos;s companies. Deals and productions belong to one, and the Director forecast compares each one&apos;s confirmed and pipeline revenue with its target for the year.
        </p>
      </div>

      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--psg-muted)" }}>
                <th className="text-left font-medium py-2 pr-3">Entity</th>
                {years.map(y => <th key={y} className="text-left font-medium py-2 pr-3">Target {y}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(en => (
                <tr key={en.id} className="border-t" style={{ borderColor: "var(--psg-card-border)", opacity: en.archived ? 0.5 : 1 }}>
                  <td className="py-2 pr-3">
                    {renaming?.id === en.id ? (
                      <form onSubmit={rename} className="flex gap-2">
                        <input autoFocus className={inp} style={inpStyle} value={renaming.name} onChange={e => setRenaming({ id: en.id, name: e.target.value })} />
                        <button type="submit" className="text-xs text-blue-400">Save</button>
                        <button type="button" onClick={() => setRenaming(null)} className="text-xs" style={{ color: "var(--psg-muted)" }}>Cancel</button>
                      </form>
                    ) : (
                      <span className="text-white">{en.name}{en.archived && <span className="text-xs ml-2" style={{ color: "var(--psg-muted)" }}>archived</span>}</span>
                    )}
                  </td>
                  {years.map(y => {
                    const current = en.targets.find(t => t.year === y)?.amount;
                    return (
                      <td key={y} className="py-2 pr-3">
                        <input
                          key={`${en.id}-${y}-${current ?? ""}`}
                          className={`${inp} w-32`} style={inpStyle} inputMode="numeric" placeholder="£ not set"
                          defaultValue={current != null ? gbp(current) : ""}
                          aria-label={`${en.name} target for ${y}`}
                          onFocus={e => { e.target.value = current != null ? String(current) : ""; }}
                          onBlur={e => setTarget(en.id, y, e.target.value, current)}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 text-right whitespace-nowrap">
                    <div className="flex gap-3 justify-end text-xs">
                      {!en.archived && <>
                        <button type="button" onClick={() => move(en, -1)} aria-label={`Move ${en.name} up`} style={{ color: "var(--psg-muted)" }}>↑</button>
                        <button type="button" onClick={() => move(en, 1)} aria-label={`Move ${en.name} down`} style={{ color: "var(--psg-muted)" }}>↓</button>
                        <button type="button" onClick={() => setRenaming({ id: en.id, name: en.name })} className="text-blue-400">Rename</button>
                      </>}
                      <button type="button" onClick={() => archive(en)} style={{ color: "var(--psg-muted)" }}>{en.archived ? "Restore" : "Archive"}</button>
                      <button type="button" onClick={() => remove(en)} className="text-red-400">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {active.length === 0 && <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No entities yet. Add the group&apos;s companies below.</p>}

      <form onSubmit={add} className="flex gap-2 flex-wrap">
        <input className={`${inp} flex-1 min-w-[200px]`} style={inpStyle} placeholder="Company name, e.g. PSG Ltd" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="text-white px-4 py-1.5 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add entity</button>
        {archived.length > 0 && (
          <button type="button" onClick={() => setShowArchived(v => !v)} className="text-xs" style={{ color: "var(--psg-muted)" }}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
        )}
      </form>
    </div>
  );
}
