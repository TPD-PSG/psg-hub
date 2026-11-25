"use client";

// Set storage (27 Nov 2026): built pieces and where they've been put. Nothing is charged.
// Full page: search and filter by location, build and in/out; put pieces in (several at once),
// move, send out, bring back, and manage the workshop's locations. On a build's page (jobId set)
// it shows just that build's pieces with the same actions.
import { useMemo, useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import { sizeText } from "@/lib/pieceSize";
import { caps, card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";

type Loc = { id: number; name: string; notes: string | null; archived: boolean; inStore: number };
type Move = { id: number; kind: string; location: string | null; note: string | null; byName: string | null; createdAt: string };
export type Piece = {
  id: number; name: string; quantity: number; notes: string | null; storedAt: string;
  lengthMm?: number | null; widthMm?: number | null; heightMm?: number | null; weightKg?: number | null; outAt: string | null; outNote: string | null; jobId: number | null;
  job: { id: number; number: string; title: string; client: { name: string } | null } | null; location: { id: number; name: string } | null; moves: Move[];
};
export type StorageData = { locations: Loc[]; pieces: Piece[]; jobs?: { id: number; number: string; title: string }[]; me?: { staff: boolean; admin: boolean } };



const MOVE_WORD: Record<string, string> = { in: "Put in", move: "Moved to", out: "Went out", back: "Back in" };
const small: React.CSSProperties = { ...btnLine, padding: "5px 10px", fontSize: 12 };

export default function SetStorage({ slug, initial, jobId, base }: { slug: string; initial: StorageData; jobId?: number; base: string }) {
  const [data, setData] = useState(initial);
  const jobs = initial.jobs ?? [];
  const staff = initial.me?.staff ?? true;
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState<string>("all");
  const [show, setShow] = useState<"in" | "out" | "all">("in");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<null | { names: string; jobId: string; locationId: string; notes: string }>(null);
  const [action, setAction] = useState<null | { id: number; kind: "move" | "out" | "back"; locationId: string; note: string }>(null);
  const [editing, setEditing] = useState<null | { id: number; name: string; quantity: string; lengthMm: string; widthMm: string; heightMm: string; weightKg: string; notes: string }>(null);
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, ...rest } = editing;
    if (await call(`/api/stored-pieces/${id}`, "PATCH", { action: "edit", ...rest })) setEditing(null);
  }
  const [history, setHistory] = useState<number | null>(null);
  const [newLoc, setNewLoc] = useState("");
  const [manage, setManage] = useState(false);
  const live = data.locations.filter(l => !l.archived);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return false; }
    if (d.pieces) setData(x => ({ ...x, locations: d.locations, pieces: jobId ? d.pieces.filter((p: Piece) => p.jobId === jobId) : d.pieces }));
    return true;
  }

  // "Panto flats x2" on its own line → name + quantity
  const parseNames = (s: string) => s.split(/\n|;/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*(?:[x×]\s*(\d+))$/i);
    return m && m[1] ? { name: m[1], quantity: Number(m[2]) } : { name: l, quantity: 1 };
  });
  async function putIn(e: React.FormEvent) {
    e.preventDefault();
    if (!adding) return;
    const pieces = parseNames(adding.names);
    if (!pieces.length) return alertDialog("Name at least one piece.");
    if (await call(`/api/spaces/${slug}/storage`, "POST", { pieces, jobId: jobId ?? (adding.jobId || null), locationId: adding.locationId || null, notes: adding.notes })) setAdding(null);
  }
  async function doAction(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    if (await call(`/api/stored-pieces/${action.id}`, "PATCH", { action: action.kind, locationId: action.locationId || null, note: action.note })) setAction(null);
  }
  async function remove(p: Piece) {
    if (await confirmDialog(`Delete "${p.name}" from the register? Only do this if it was added by mistake; use "Gone out" when it leaves.`)) await call(`/api/stored-pieces/${p.id}`, "DELETE");
  }
  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (newLoc.trim() && await call(`/api/spaces/${slug}/storage/locations`, "POST", { name: newLoc })) setNewLoc("");
  }

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.pieces.filter(p =>
      (show === "all" || (show === "in" ? !p.outAt : !!p.outAt)) &&
      (loc === "all" || (loc === "none" ? !p.location : String(p.location?.id) === loc)) &&
      words.every(w => `${p.name} ${p.job?.title ?? ""} ${p.job?.number ?? ""} ${p.job?.client?.name ?? ""} ${p.location?.name ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(w)));
  }, [data.pieces, q, loc, show]);
  const inStore = data.pieces.filter(p => !p.outAt);
  const noLocation = inStore.filter(p => !p.location).length;

  const addForm = adding && (
    <form onSubmit={putIn} className="flex flex-col gap-3 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
      <span style={caps}>Put pieces into store</span>
      <div><label htmlFor="sp-names" style={lbl}>Pieces, one per line (add &ldquo;x2&rdquo; for more than one)</label>
        <textarea id="sp-names" rows={3} autoFocus style={input} value={adding.names} onChange={e => setAdding({ ...adding, names: e.target.value })} placeholder={"Palace flats x2\nStaircase truck\nChandelier"} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!jobId && <div><label htmlFor="sp-job" style={lbl}>From build</label>
          <select id="sp-job" style={input} value={adding.jobId} onChange={e => setAdding({ ...adding, jobId: e.target.value })}><option value="">Not from a build</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.number} · {j.title}</option>)}</select></div>}
        <div><label htmlFor="sp-loc" style={lbl}>Where it&apos;s been put</label>
          <select id="sp-loc" style={input} value={adding.locationId} onChange={e => setAdding({ ...adding, locationId: e.target.value })}><option value="">Not placed yet</option>{live.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      </div>
      <div><label htmlFor="sp-notes" style={lbl}>Notes (optional)</label><input id="sp-notes" style={input} value={adding.notes} onChange={e => setAdding({ ...adding, notes: e.target.value })} placeholder="e.g. Wrapped, stacked face to face" /></div>
      <div className="flex gap-2 flex-wrap"><button type="submit" disabled={busy} style={btnSolid}>Put in store</button><button type="button" onClick={() => setAdding(null)} style={btnLine}>Cancel</button></div>
      {live.length === 0 && <p className="text-xs m-0" style={muted}>No locations yet. {jobId ? <Link href={`${base}/storage`} style={link}>Set them up on the Storage page</Link> : "Add them below"} so pieces can be placed.</p>}
    </form>
  );

  const list = (
    <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
      {shown.map(p => (
        <li key={p.id} className="py-3 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--tws-line-soft)", opacity: p.outAt ? 0.7 : 1 }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link href={`${base}/pieces/${p.id}`} className="text-[15px] font-bold break-words min-w-0 hover:underline" style={{ color: "var(--tws-ink)" }}>{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ""}</Link>
            {!jobId && p.job && <Link href={`${base}/jobs/${p.job.id}`} className="text-[13px]" style={link}>{p.job.title}</Link>}
            {!jobId && p.job?.client && <span className="text-xs" style={muted}>{p.job.client.name}</span>}
            <span className="ml-auto text-[13px] font-bold px-2 py-0.5" style={p.outAt ? { background: "var(--tws-tint)", color: "#4e545b" } : p.location ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" }}>
              {p.outAt ? "Gone out" : p.location ? p.location.name : "Not placed"}
            </span>
          </div>
          <div className="text-xs" style={muted}>
            {sizeText(p) ? <>{sizeText(p)} · </> : null}In since {fmtDate(p.storedAt)}{p.outAt ? ` · went out ${fmtDate(p.outAt)}${p.outNote ? `: ${p.outNote}` : ""}` : ""}{p.notes ? ` · ${p.notes}` : ""}
          </div>
          {staff && (
            <div className="flex flex-wrap gap-2 items-center">
              {!p.outAt ? <>
                <button type="button" disabled={busy} onClick={() => setAction({ id: p.id, kind: "move", locationId: "", note: "" })} style={small}>{p.location ? "Move" : "Place"}</button>
                <button type="button" disabled={busy} onClick={() => setAction({ id: p.id, kind: "out", locationId: "", note: "" })} style={small}>Gone out</button>
              </> : <button type="button" disabled={busy} onClick={() => setAction({ id: p.id, kind: "back", locationId: "", note: "" })} style={small}>Back in store</button>}
              <button type="button" disabled={busy} onClick={() => setEditing({ id: p.id, name: p.name, quantity: String(p.quantity), lengthMm: p.lengthMm?.toString() ?? "", widthMm: p.widthMm?.toString() ?? "", heightMm: p.heightMm?.toString() ?? "", weightKg: p.weightKg?.toString() ?? "", notes: p.notes ?? "" })} style={small}>Size &amp; weight</button>
              <button type="button" onClick={() => setHistory(history === p.id ? null : p.id)} aria-expanded={history === p.id} className="text-xs underline" style={muted}>{history === p.id ? "Hide history" : "History"}</button>
              <button type="button" disabled={busy} onClick={() => remove(p)} className="text-xs ml-auto" style={{ color: "var(--tws-bad-ink)" }} aria-label={`Delete ${p.name}`}>Delete</button>
            </div>
          )}
          {action?.id === p.id && (
            <form onSubmit={doAction} className="flex flex-wrap gap-2 items-end p-3" style={{ background: "var(--tws-ground)" }}>
              {action.kind !== "out" && (
                <div className="min-w-[12rem]"><label htmlFor={`act-l${p.id}`} style={lbl}>{action.kind === "back" ? "Back into" : "Move to"}</label>
                  <select id={`act-l${p.id}`} required={action.kind === "move"} autoFocus style={input} value={action.locationId} onChange={e => setAction({ ...action, locationId: e.target.value })}>
                    <option value="">{action.kind === "back" ? "Not placed yet" : "Pick a location"}</option>{live.filter(l => action.kind === "back" || l.id !== p.location?.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select></div>
              )}
              <div className="flex-1 min-w-[12rem]"><label htmlFor={`act-n${p.id}`} style={lbl}>{action.kind === "out" ? "Where did it go?" : "Note (optional)"}</label>
                <input id={`act-n${p.id}`} required={action.kind === "out"} autoFocus={action.kind === "out"} style={input} value={action.note} onChange={e => setAction({ ...action, note: e.target.value })} placeholder={action.kind === "out" ? "e.g. Delivered to the Lyceum for the get-in" : "e.g. Made room for the panto"} /></div>
              <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{action.kind === "out" ? "Mark gone out" : action.kind === "back" ? "Back in store" : "Move"}</button>
              <button type="button" onClick={() => setAction(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button>
            </form>
          )}
          {editing?.id === p.id && (
            <form onSubmit={saveEdit} className="grid gap-2 p-3 grid-cols-2 sm:grid-cols-4 items-end" style={{ background: "var(--tws-ground)" }}>
              <div className="col-span-2 sm:col-span-3"><label htmlFor={`ed-n${p.id}`} style={lbl}>Piece</label><input id={`ed-n${p.id}`} required style={input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label htmlFor={`ed-q${p.id}`} style={lbl}>How many</label><input id={`ed-q${p.id}`} type="number" min={1} required style={input} value={editing.quantity} onChange={e => setEditing({ ...editing, quantity: e.target.value })} /></div>
              <div><label htmlFor={`ed-l${p.id}`} style={lbl}>Length mm</label><input id={`ed-l${p.id}`} type="number" min={1} style={input} value={editing.lengthMm} onChange={e => setEditing({ ...editing, lengthMm: e.target.value })} /></div>
              <div><label htmlFor={`ed-w${p.id}`} style={lbl}>Width mm</label><input id={`ed-w${p.id}`} type="number" min={1} style={input} value={editing.widthMm} onChange={e => setEditing({ ...editing, widthMm: e.target.value })} /></div>
              <div><label htmlFor={`ed-h${p.id}`} style={lbl}>Height mm</label><input id={`ed-h${p.id}`} type="number" min={1} style={input} value={editing.heightMm} onChange={e => setEditing({ ...editing, heightMm: e.target.value })} /></div>
              <div><label htmlFor={`ed-kg${p.id}`} style={lbl}>Weight kg (each)</label><input id={`ed-kg${p.id}`} type="number" min={0} step="any" style={input} value={editing.weightKg} onChange={e => setEditing({ ...editing, weightKg: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-4"><label htmlFor={`ed-no${p.id}`} style={lbl}>Notes</label><input id={`ed-no${p.id}`} style={input} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-4 flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Save</button><button type="button" onClick={() => setEditing(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
            </form>
          )}
          {history === p.id && (
            <ol className="text-xs flex flex-col gap-1 pl-3 m-0 list-none" style={{ ...muted, borderLeft: "3px solid var(--tws-tint)" }}>
              {p.moves.map(mv => <li key={mv.id}>{fmtDate(mv.createdAt)} · {MOVE_WORD[mv.kind] ?? mv.kind}{mv.kind === "out" ? "" : ` ${mv.location ?? "(not placed)"}`}{mv.note ? `: ${mv.note}` : ""}{mv.byName ? ` · ${mv.byName}` : ""}</li>)}
            </ol>
          )}
        </li>
      ))}
      {shown.length === 0 && <li className="py-4 text-sm" style={muted}>{data.pieces.length ? "Nothing matches." : jobId ? "Nothing from this build is in store." : "Nothing in store yet. Put the first pieces in above."}</li>}
    </ul>
  );

  // On a build's page: just this build's pieces
  if (jobId) {
    return (
      <section style={card} className="flex flex-col gap-3" aria-label="In storage">
        <div className="flex justify-between items-baseline gap-3 flex-wrap">
          <h2 style={h2}>In storage</h2>
          <span className="flex gap-3"><Link href={`${base}/labels?job=${jobId}`} className="text-[13px]" style={link}>Print QR labels</Link><Link href={`${base}/storage`} className="text-[13px]" style={link}>Storage →</Link></span>
        </div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
          {([["in", "In store"], ["out", "Gone out"], ["all", "All"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className="text-xs font-bold px-2.5 py-1" style={show === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", border: "1px solid var(--tws-line)", color: "var(--tws-ink)" }}>{l} ({data.pieces.filter(p => k === "all" || (k === "in" ? !p.outAt : !!p.outAt)).length})</button>)}
        </div>
        {list}
        {staff && (adding ? addForm : <button type="button" onClick={() => setAdding({ names: "", jobId: String(jobId), locationId: "", notes: "" })} className="self-start text-[13px] font-semibold" style={link}>+ Put pieces into store</button>)}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Stored pieces">
          <div className="flex justify-between items-baseline gap-3 flex-wrap">
            <h2 style={h2}>Pieces</h2>
            <span className="flex gap-2 flex-wrap items-center">
              {shown.some(p => !p.outAt) && <Link href={`${base}/labels?ids=${shown.filter(p => !p.outAt).map(p => p.id).join(",")}`} className="text-[13px] font-semibold" style={link}>Print QR labels ({shown.filter(p => !p.outAt).length})</Link>}
              {staff && !adding && <button type="button" onClick={() => setAdding({ names: "", jobId: "", locationId: loc !== "all" && loc !== "none" ? loc : "", notes: "" })} style={btnSolid}>+ Put pieces into store</button>}
            </span>
          </div>
          {addForm}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <input aria-label="Search pieces" type="search" style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search: piece, build, client or location" />
            <select aria-label="Location" style={input} value={loc} onChange={e => setLoc(e.target.value)}>
              <option value="all">All locations</option>{data.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.archived ? " (retired)" : ""}</option>)}<option value="none">Not placed</option>
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Show">
            {([["in", "In store"], ["out", "Gone out"], ["all", "All"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className="text-xs font-bold px-2.5 py-1.5" style={show === k ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", border: "1px solid var(--tws-line)", color: "var(--tws-ink)" }}>{l} ({data.pieces.filter(p => k === "all" || (k === "in" ? !p.outAt : !!p.outAt)).length})</button>)}
          </div>
          {list}
        </section>

        <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Locations">
          <div className="flex justify-between items-baseline gap-3"><h2 style={h2}>Locations</h2>
            {staff && data.locations.length > 0 && <button type="button" onClick={() => setManage(!manage)} className="text-[13px]" style={link}>{manage ? "Done" : "Manage"}</button>}</div>
          <ul className="flex flex-col m-0 p-0 list-none">
            {data.locations.filter(l => manage || !l.archived).map(l => (
              <li key={l.id} className="py-2 flex items-center gap-2 text-sm" style={{ borderTop: "1px solid var(--tws-line-soft)", opacity: l.archived ? 0.6 : 1 }}>
                {manage ? (
                  <LocationEditor l={l} busy={busy} onSave={name => call(`/api/storage-locations/${l.id}`, "PATCH", { name })} onArchive={archived => call(`/api/storage-locations/${l.id}`, "PATCH", { archived })} />
                ) : (
                  <button type="button" onClick={() => { setLoc(String(l.id)); setShow("in"); }} className="flex-1 flex justify-between gap-2 text-left" style={{ background: "none", border: 0, padding: 0, color: "inherit" }}>
                    <span className="font-semibold">{l.name}</span><span className="tabular-nums" style={muted}>{l.inStore} piece{l.inStore === 1 ? "" : "s"}</span>
                  </button>
                )}
              </li>
            ))}
            {noLocation > 0 && !manage && (
              <li className="py-2 text-sm" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                <button type="button" onClick={() => { setLoc("none"); setShow("in"); }} className="w-full flex justify-between gap-2 text-left" style={{ background: "none", border: 0, padding: 0, color: "var(--tws-warn-ink)" }}><span className="font-semibold">Not placed yet</span><span>{noLocation}</span></button>
              </li>
            )}
          </ul>
          {data.locations.length === 0 && <p className="text-sm m-0" style={muted}>Add the places pieces go: bays, racking, containers, offsite units.</p>}
          {staff && (
            <form onSubmit={addLocation} className="flex gap-2 pt-1">
              <input aria-label="New location" style={input} value={newLoc} onChange={e => setNewLoc(e.target.value)} placeholder="e.g. Bay 3, Racking A2, Container 1" />
              <button type="submit" disabled={busy || !newLoc.trim()} style={{ ...btnSolid, padding: "8px 12px" }}>Add</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function LocationEditor({ l, busy, onSave, onArchive }: { l: Loc; busy: boolean; onSave: (name: string) => Promise<boolean>; onArchive: (archived: boolean) => Promise<boolean> }) {
  const [name, setName] = useState(l.name);
  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim() && name !== l.name) onSave(name); }} className="flex-1 flex flex-wrap gap-2 items-center">
      <input aria-label={`Rename ${l.name}`} style={{ ...input, flex: "1 1 8rem", padding: "6px 8px" }} value={name} onChange={e => setName(e.target.value)} />
      {name !== l.name && <button type="submit" disabled={busy} style={{ ...small, ...btnSolid, padding: "5px 10px", fontSize: 12 }}>Rename</button>}
      <button type="button" disabled={busy} onClick={() => onArchive(!l.archived)} style={small} title={l.archived ? "Use it again" : "No longer used (it must be empty)"}>{l.archived ? "Restore" : "Retire"}</button>
    </form>
  );
}
