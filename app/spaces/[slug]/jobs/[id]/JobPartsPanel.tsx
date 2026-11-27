// "Parts of this build" card: the parts table (who, labour type, when, hours), per-part materials, templates and the add-a-part form.
import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import PartMaterials, { materialsCost, type PartMaterial } from "@/components/PartMaterials";
import BuildTemplates from "@/components/BuildTemplates";
import { card, h2, muted, link, btnSolid, input, label as lbl } from "@/lib/twsUi";
import { gbp, when, th, td, type Call, type Me, type Option, type PartRow } from "./spaceJobTypes";

export default function JobPartsPanel({ space, base, job, parts, setParts, people, seeMoney, me, busy, call }: {
  space: SpaceTheme; base: string; job: JobDetail; parts: PartRow[]; setParts: React.Dispatch<React.SetStateAction<PartRow[]>>; people: Option[]; seeMoney: boolean; me: Me;
  busy: boolean; call: Call;
}) {
  const [part, setPart] = useState({ label: "", userId: "", labourTypeId: "", startDate: "", days: "1", hours: "" });
  // The workshop's labour types (Carpenter, Scenic artist…), for parts
  const [labour, setLabour] = useState<{ id: number; name: string; dayRate: number | null; archived: boolean }[]>([]);
  useEffect(() => { fetch(`/api/spaces/${space.slug}/labour-types`).then(r => (r.ok ? r.json() : [])).then(d => Array.isArray(d) && setLabour(d)).catch(() => {}); }, [space.slug]);
  const labourOptions = (current?: number | null) => labour.filter(l => !l.archived || l.id === current);
  async function setPartLabour(p: PartRow, labourTypeId: string) { if (await call(`/api/jobs/${job.id}/parts/${p.id}`, "PATCH", { labourTypeId: labourTypeId || null })) reloadParts(); }
  const [openMats, setOpenMats] = useState<Set<number>>(new Set());
  const toggleMats = (id: number) => setOpenMats(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setPartMaterials = (id: number, materials: PartMaterial[]) => setParts(ps => ps.map(x => (x.id === id ? { ...x, materials } : x)));
  const materialsTotal = parts.reduce((s, p) => s + materialsCost(p.materials ?? []), 0);

  const reloadParts = async () => { const d = await fetch(`/api/jobs/${job.id}/parts`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (Array.isArray(d)) setParts(d); };
  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    if (await call(`/api/jobs/${job.id}/parts`, "POST", { ...part, userId: part.userId || null, labourTypeId: part.labourTypeId || null, startDate: part.startDate || null, days: Number(part.days) })) {
      setPart({ label: "", userId: "", labourTypeId: part.labourTypeId, startDate: "", days: "1", hours: "" }); reloadParts();
    }
  }
  async function togglePart(p: PartRow) { if (await call(`/api/jobs/${job.id}/parts/${p.id}`, "PATCH", { done: !p.done })) reloadParts(); }
  async function pencilPart(p: PartRow) { if (await call(`/api/jobs/${job.id}/parts/${p.id}`, "PATCH", { pencilled: !p.pencilled })) reloadParts(); }
  async function removePart(p: PartRow) { if (await confirmDialog(`Delete the part "${p.label}"?`) && await call(`/api/jobs/${job.id}/parts/${p.id}`, "DELETE")) reloadParts(); }

  const plannedHours = parts.reduce((s, p) => s + (p.hours ?? 0), 0);
  const loggedDays = job.time.reduce((s, t) => s + t.days, 0);

  return (
    <section style={card} className="flex flex-col gap-3.5 min-w-0">
      <div className="flex justify-between items-baseline gap-3 flex-wrap"><h2 style={h2}>Parts of this build</h2><Link href={`${base}/planner`} className="text-[13px]" style={link}>Open in planner →</Link></div>
      {parts.length === 0 ? <p className="text-sm" style={muted}>Break the build into parts (e.g. truck frames, flats and doors, paint) so the team can plan them.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr className="text-xs" style={{ ...muted, borderBottom: "1px solid var(--tws-line-soft)" }}><th className={th}>Done</th><th className={th}>Part</th><th className={th}>Who</th><th className={th}>When</th><th className={th}>Planned hours</th><th /></tr></thead>
            <tbody>
              {parts.map(p => (
                <Fragment key={p.id}>
                <tr style={{ borderBottom: "1px solid var(--tws-line-soft)", opacity: p.done ? 0.6 : 1 }}>
                  <td className={td}><input type="checkbox" checked={p.done} onChange={() => togglePart(p)} aria-label={`${p.label} done`} className="w-4 h-4 mt-0.5" /></td>
                  <td className={td}>
                    <span style={{ textDecoration: p.done ? "line-through" : undefined }}>{p.label}</span>
                    <button type="button" onClick={() => toggleMats(p.id)} aria-expanded={openMats.has(p.id)} className="block text-xs font-semibold mt-0.5 whitespace-nowrap" style={link}>
                      {p.materials?.length ? `Materials: ${p.materials.length}${seeMoney ? ` · ${gbp(materialsCost(p.materials))}` : ""}` : "+ Materials"} {openMats.has(p.id) ? "▴" : "▾"}
                    </button>
                  </td>
                  <td className={td}>{p.user?.name ?? <span style={muted}>Nobody yet</span>}
                    {labour.length > 0 && (
                      <select aria-label={`Labour type for ${p.label}`} value={p.labourTypeId ?? ""} onChange={e => setPartLabour(p, e.target.value)} className="block mt-0.5 text-xs max-w-[11rem]" style={{ background: "transparent", border: 0, padding: 0, color: "var(--tws-accent-ink)", fontWeight: 600 }}>
                        <option value="">+ Labour type</option>{labourOptions(p.labourTypeId).map(l => <option key={l.id} value={l.id}>{l.name}{l.dayRate != null ? ` · £${l.dayRate}/day` : ""}</option>)}
                      </select>
                    )}</td>
                  <td className={td}>{when(p)}{p.days > 1 ? ` (${p.days}d)` : ""}
                    {p.pencilled && <button type="button" onClick={() => pencilPart(p)} title="Pencilled while the build is being quoted. Click to confirm these dates now."
                      className="ml-2 text-[11px] font-bold px-1.5 py-0.5" style={{ border: "2px dashed var(--tws-night)", fontStyle: "italic" }}>✎ Pencilled</button>}</td>
                  <td className={`${td} tabular-nums`}>{p.hours ?? "–"}</td>

                  <td className={`${td} text-right`}><button type="button" onClick={() => removePart(p)} aria-label={`Delete part ${p.label}`} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }}>Delete</button></td>
                </tr>
                </Fragment>
              ))}
              <tr className="font-extrabold"><td /><td className={td}>Total</td><td /><td className={td}>{loggedDays} day{loggedDays === 1 ? "" : "s"} logged</td><td className={`${td} tabular-nums`}>{plannedHours || "–"}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
      {materialsTotal > 0 && <p className="text-[13px] m-0">Estimated materials for this build: <strong className="tabular-nums">{gbp(materialsTotal)}</strong> <span style={muted}>(at cost; &ldquo;Quote this build&rdquo; adds your markup)</span></p>}
      {/* Materials for the parts opened above (full width, so the add-a-line form has room) */}
      {parts.filter(p => openMats.has(p.id)).map(p => (
        <div key={p.id} className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline gap-2">
            <strong className="text-sm">Materials: {p.label}</strong>
            <button type="button" onClick={() => toggleMats(p.id)} className="text-xs underline" style={muted}>Close</button>
          </div>
          <PartMaterials jobId={job.id} partId={p.id} entityId={space.id} materials={p.materials ?? []} onChange={ms => setPartMaterials(p.id, ms)} seeMoney={seeMoney} />
        </div>
      ))}
      <BuildTemplates<PartRow> jobId={job.id} slug={space.slug} hasParts={parts.length > 0} me={me} onParts={setParts} />
      {job.stage === "quote" && <p className="text-xs m-0 pt-2" style={muted}>✎ This build is still being quoted, so parts added now are pencilled in. They&apos;re confirmed when the quote&apos;s accepted.</p>}
      <form onSubmit={addPart} className="grid gap-2 items-end pt-3 grid-cols-2 xl:grid-cols-[1.4fr_1.1fr_1.1fr_1fr_70px_80px_auto]" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
        <div><label htmlFor="p-label" style={lbl}>Part</label><input id="p-label" required style={input} value={part.label} onChange={e => setPart({ ...part, label: e.target.value })} placeholder="e.g. Flats and doors" /></div>
        <div><label htmlFor="p-who" style={lbl}>Who</label>
          <select id="p-who" style={input} value={part.userId} onChange={e => setPart({ ...part, userId: e.target.value })}><option value="">Plan later</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        {labour.length > 0 && <div><label htmlFor="p-labour" style={lbl}>Labour type</label>
          <select id="p-labour" style={input} value={part.labourTypeId} onChange={e => setPart({ ...part, labourTypeId: e.target.value })}><option value="">—</option>{labourOptions().map(l => <option key={l.id} value={l.id}>{l.name}{l.dayRate != null ? ` (£${l.dayRate}/day)` : ""}</option>)}</select></div>}
        <div><label htmlFor="p-start" style={lbl}>Starts</label><input id="p-start" type="date" style={input} value={part.startDate} onChange={e => setPart({ ...part, startDate: e.target.value })} /></div>
        <div><label htmlFor="p-days" style={lbl}>Days</label><input id="p-days" type="number" min={1} max={60} required style={input} value={part.days} onChange={e => setPart({ ...part, days: e.target.value })} /></div>
        <div><label htmlFor="p-hours" style={lbl}>Hours</label><input id="p-hours" type="number" min={0} step="0.5" style={input} value={part.hours} onChange={e => setPart({ ...part, hours: e.target.value })} /></div>
        <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Add part</button>
      </form>
    </section>
  );
}
