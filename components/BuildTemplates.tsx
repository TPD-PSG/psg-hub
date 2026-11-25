"use client";

// Build templates on a build's page (28 Nov 2026): add a typical piece of work ("Standard flat"
// × 8) as parts with materials, or save this build's parts and materials as a template per unit.
import { useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";

type T = { id: number; name: string; unitName: string; notes: string | null; createdById: number | null; parts: string[]; materials: number; materialsCost: number; days: number };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default function BuildTemplates<P>({ jobId, slug, hasParts, me, onParts }: { jobId: number; slug: string; hasParts: boolean; me: { id: number; isAdmin: boolean }; onParts: (parts: P[]) => void }) {
  const [mode, setMode] = useState<null | "add" | "save">(null);
  const [list, setList] = useState<T[] | null>(null);
  const [pick, setPick] = useState({ templateId: "", units: "1" });
  const [save, setSave] = useState({ name: "", unitName: "flat", units: "1", notes: "" });
  const [busy, setBusy] = useState(false);

  async function open(m: "add" | "save") {
    setMode(m);
    if (m === "add") {
      const d = await fetch(`/api/spaces/${slug}/build-templates`).then(r => (r.ok ? r.json() : [])).catch(() => []);
      setList(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d[0]) setPick(p => ({ ...p, templateId: p.templateId || String(d[0].id) }));
    }
  }
  async function post(url: string, body: unknown) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    return { res, d: await res.json().catch(() => ({})) };
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { res, d } = await post(`/api/jobs/${jobId}/apply-template`, { templateId: pick.templateId, units: pick.units });
    if (!res.ok) return alertDialog(d.error ?? "Couldn't add it");
    onParts(d); setMode(null);
  }
  async function saveIt(e: React.FormEvent, replace = false) {
    e.preventDefault();
    const { res, d } = await post(`/api/jobs/${jobId}/build-template`, { ...save, replace });
    if (res.status === 409 && d.exists) {
      if (await confirmDialog(`There's already a template called "${save.name}". Replace it with this build?`)) return saveIt(e, true);
      return;
    }
    if (!res.ok) return alertDialog(d.error ?? "Couldn't save it");
    setMode(null);
    alertDialog(`Saved "${d.name}". Add it to any build with "Add from a template".`);
  }
  async function remove(t: T) {
    if (!(await confirmDialog(`Delete the template "${t.name}"? Builds made from it aren't changed.`))) return;
    const res = await fetch(`/api/build-templates/${t.id}`, { method: "DELETE" });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
    setList(l => (l ?? []).filter(x => x.id !== t.id));
    if (pick.templateId === String(t.id)) setPick({ ...pick, templateId: "" });
  }

  const chosen = list?.find(t => String(t.id) === pick.templateId);
  const n = Number(pick.units) || 0;

  return (
    <div className="flex flex-col gap-2">
      {!mode && (
        <div className="flex gap-4 flex-wrap text-[13px]">
          <button type="button" onClick={() => open("add")} className="font-semibold" style={link}>+ Add from a template</button>
          {hasParts && <button type="button" onClick={() => open("save")} className="font-semibold" style={link}>Save as template</button>}
        </div>
      )}

      {mode === "add" && (
        <form onSubmit={add} className="flex flex-col gap-2.5 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
          <strong className="text-sm">Add from a template</strong>
          {list && list.length === 0 ? <p className="text-sm m-0" style={muted}>No templates yet. Plan a typical build&apos;s parts and materials, then use &ldquo;Save as template&rdquo;.</p> : (
            <>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <div><label htmlFor="bt-pick" style={lbl}>Template</label>
                  <select id="bt-pick" required style={input} value={pick.templateId} onChange={e => setPick({ ...pick, templateId: e.target.value })}>{(list ?? []).map(t => <option key={t.id} value={t.id}>{t.name} (per {t.unitName})</option>)}</select></div>
                <div><label htmlFor="bt-units" style={lbl}>How many {chosen?.unitName ?? ""}</label><input id="bt-units" type="number" min={0.01} step="any" required style={input} value={pick.units} onChange={e => setPick({ ...pick, units: e.target.value })} /></div>
              </div>
              {chosen && (
                <p className="text-xs m-0" style={muted}>
                  Per {chosen.unitName}: {chosen.parts.join(", ")} · about {chosen.days} day{chosen.days === 1 ? "" : "s"} · {chosen.materials} material{chosen.materials === 1 ? "" : "s"} ({gbp(chosen.materialsCost)}).
                  {n > 0 && <> For {n}: about {Math.round(chosen.days * n * 10) / 10} days and {gbp(chosen.materialsCost * n)} of materials.</>}
                  {chosen.notes ? ` ${chosen.notes}` : ""}
                  {(chosen.createdById === me.id || me.isAdmin) && <> · <button type="button" onClick={() => remove(chosen)} style={{ color: "var(--tws-bad-ink)" }}>delete template</button></>}
                </p>
              )}
              <div className="flex gap-2"><button type="submit" disabled={busy || !pick.templateId} style={{ ...btnSolid, padding: "8px 14px" }}>Add to this build</button><button type="button" onClick={() => setMode(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
              <span className="text-xs" style={muted}>Adds its parts (no one planned yet) with their materials, scaled; sheets and lengths round up. Adjust anything after.</span>
            </>
          )}
          {list && list.length === 0 && <button type="button" onClick={() => setMode(null)} className="self-start text-sm underline" style={muted}>Close</button>}
        </form>
      )}

      {mode === "save" && (
        <form onSubmit={e => saveIt(e)} className="flex flex-col gap-2.5 p-3" style={{ background: "var(--tws-ground)", borderTop: "4px solid var(--tws-accent)" }}>
          <strong className="text-sm">Save this build as a template</strong>
          <div><label htmlFor="bs-name" style={lbl}>Template name</label><input id="bs-name" required autoFocus style={input} value={save.name} onChange={e => setSave({ ...save, name: e.target.value })} placeholder="e.g. Standard flat 2400 × 1200" /></div>
          <div className="grid gap-2 grid-cols-2">
            <div><label htmlFor="bs-units" style={lbl}>This build was how many…</label><input id="bs-units" type="number" min={0.01} step="any" required style={input} value={save.units} onChange={e => setSave({ ...save, units: e.target.value })} /></div>
            <div><label htmlFor="bs-unit" style={lbl}>…of what?</label><input id="bs-unit" required list="bs-units-list" style={input} value={save.unitName} onChange={e => setSave({ ...save, unitName: e.target.value })} />
              <datalist id="bs-units-list">{["flat", "flats", "truck", "trucks", "m²", "door", "each", "set"].map(u => <option key={u} value={u} />)}</datalist></div>
          </div>
          <div><label htmlFor="bs-notes" style={lbl}>Notes (optional)</label><input id="bs-notes" style={input} value={save.notes} onChange={e => setSave({ ...save, notes: e.target.value })} placeholder="e.g. Hard-covered, ply face, no doors" /></div>
          <div className="flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Save template</button><button type="button" onClick={() => setMode(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
          <span className="text-xs" style={muted}>Keeps this build&apos;s parts and materials divided by that number, so it can be scaled to any size. People aren&apos;t kept.</span>
        </form>
      )}
    </div>
  );
}
