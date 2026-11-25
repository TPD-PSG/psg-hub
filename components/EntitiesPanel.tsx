"use client";

// Hub Settings: the group's companies (entities) and each one's yearly revenue target.
// Deals, productions and the Director forecast are split by these.
import { Fragment, useEffect, useState } from "react";
import type { EntityRow } from "@/lib/entities";
import { confirmDialog, alertDialog } from "@/components/Dialogs";
import { spaceLogoUrl } from "@/lib/entities";

const inp = "rounded px-2 py-1.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export default function EntitiesPanel({ initial }: { initial: EntityRow[] | null }) {
  const [entities, setEntities] = useState<EntityRow[]>(initial ?? []);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Space settings for one company at a time
  const [space, setSpace] = useState<{ id: number; hasSpace: boolean; slug: string; shortName: string; color: string } | null>(null);
  const openSpace = (en: EntityRow) => setSpace({
    id: en.id, hasSpace: en.hasSpace, shortName: en.shortName ?? "", color: en.color ?? "#2a5de0",
    slug: en.slug ?? en.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30),
  });
  async function saveSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    // Address first, so switching the space on in the same save has one to use
    if (await call(`/api/entities/${space.id}`, "PUT", { slug: space.slug, shortName: space.shortName, color: space.color })
      && await call(`/api/entities/${space.id}`, "PUT", { hasSpace: space.hasSpace })) { setSpace(null); reload(); }
  }
  async function uploadLogo(id: number, file: File | undefined) {
    if (!file) return;
    const fd = new FormData(); fd.append("logo", file);
    const res = await fetch(`/api/entities/${id}/logo`, { method: "POST", body: fd });
    if (!res.ok) await alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't upload the logo");
    reload();
  }
  async function removeLogo(id: number) {
    if (await call(`/api/entities/${id}/logo`, "DELETE")) reload();
  }
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
                <Fragment key={en.id}>
                <tr className="border-t" style={{ borderColor: "var(--psg-card-border)", opacity: en.archived ? 0.5 : 1 }}>
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
                        <button type="button" onClick={() => (space?.id === en.id ? setSpace(null) : openSpace(en))} className="text-blue-400">{en.hasSpace ? "Space ✓" : "Space"}</button>
                      </>}
                      <button type="button" onClick={() => archive(en)} style={{ color: "var(--psg-muted)" }}>{en.archived ? "Restore" : "Archive"}</button>
                      <button type="button" onClick={() => remove(en)} className="text-red-400">Delete</button>
                    </div>
                  </td>
                </tr>
                {space?.id === en.id && (
                  <tr key={`${en.id}-space`}>
                    <td colSpan={years.length + 2} className="pb-4">
                      <form onSubmit={saveSpace} className="rounded-lg border p-4 grid gap-3 md:grid-cols-2" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                        <p className="md:col-span-2 text-xs" style={{ color: "var(--psg-muted)" }}>
                          A space gives {en.name} its own home page in the Hub, in its colours. People with {en.name} as their home company (Admin → Users) land there; PSG staff can open it too.
                        </p>
                        <label className="md:col-span-2 flex items-center gap-2 text-sm text-white">
                          <input type="checkbox" checked={space.hasSpace} onChange={e => setSpace({ ...space, hasSpace: e.target.checked })} /> Switch the space on
                        </label>
                        <div><label htmlFor={`sp-slug-${en.id}`} className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Web address</label>
                          <div className="flex items-center gap-1 text-sm" style={{ color: "var(--psg-muted)" }}>/spaces/
                            <input id={`sp-slug-${en.id}`} className={inp} style={inpStyle} value={space.slug} onChange={e => setSpace({ ...space, slug: e.target.value.toLowerCase() })} placeholder="tws" /></div></div>
                        <div><label htmlFor={`sp-short-${en.id}`} className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Short name</label>
                          <input id={`sp-short-${en.id}`} className={inp} style={inpStyle} value={space.shortName} maxLength={12} onChange={e => setSpace({ ...space, shortName: e.target.value })} placeholder="TWS" /></div>
                        <div><label htmlFor={`sp-colour-${en.id}`} className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Colour</label>
                          <div className="flex items-center gap-2">
                            <input id={`sp-colour-${en.id}`} type="color" value={space.color} onChange={e => setSpace({ ...space, color: e.target.value })} className="h-9 w-14 rounded border" style={{ borderColor: "var(--psg-card-border)" }} />
                            <input aria-label="Colour code" className={`${inp} w-28`} style={inpStyle} value={space.color} onChange={e => setSpace({ ...space, color: e.target.value })} />
                          </div></div>
                        <div><span className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Logo (PNG, JPEG or WebP, under 1 MB)</span>
                          <div className="flex items-center gap-3">
                            {en.logoMime && en.slug ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element -- our own API */}
                                <img src={spaceLogoUrl(en)!} alt={`${en.name} logo`} className="h-10 w-auto max-w-[120px] bg-white rounded p-1 object-contain" />
                                <button type="button" onClick={() => removeLogo(en.id)} className="text-xs text-red-400">Remove</button>
                              </>
                            ) : en.logoMime ? <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Uploaded (shows once the space has a web address)</span> : null}
                            <label className="text-xs text-blue-400 cursor-pointer">{en.logoMime ? "Replace" : "Upload"}
                              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => uploadLogo(en.id, e.target.files?.[0])} />
                            </label>
                          </div></div>
                        {/* Preview of the top bar */}
                        <div className="md:col-span-2 rounded h-10 flex items-center px-3 text-xs font-semibold tracking-widest uppercase" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(space.color) ? space.color : "#2a5de0", color: "#fff" }}>
                          {space.shortName || en.name} · PSG Hub <span className="ml-auto normal-case tracking-normal font-normal opacity-80">top bar preview</span>
                        </div>
                        <div className="md:col-span-2 flex gap-2 items-center">
                          <button type="submit" className="text-white px-4 py-1.5 rounded text-sm font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>Save space</button>
                          <button type="button" onClick={() => setSpace(null)} className="text-sm" style={{ color: "var(--psg-muted)" }}>Cancel</button>
                          {en.hasSpace && en.slug && <a href={`/spaces/${en.slug}`} className="text-sm text-blue-400 ml-auto">Open the space →</a>}
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
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
