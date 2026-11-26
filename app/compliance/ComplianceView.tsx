"use client";

// The group compliance register (26 Nov 2026): insurances, accreditations, policies, certificates
// and registrations, each tagged with the company that owns it (or group-wide), with renewal and
// review dates, the current document and its history. Staff see and download; admins and an item's
// owner keep it up to date. Tick items to export a tender pack.
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { exportCompliancePackPDF } from "@/lib/exports";
import { COMPLIANCE_CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, keyDate, type ComplianceStatus } from "@/lib/complianceCore";

type Doc = { id: number; name: string; mime: string; validFrom: string | null; expiresAt: string | null; version: string | null; createdAt: string; uploadedBy: { name: string } | null };
type Item = {
  id: number; entityId: number | null; entity: { id: number; name: string; shortName: string | null } | null; category: string; name: string; issuer: string | null; reference: string | null; cover: string | null;
  validFrom: string | null; expiresAt: string | null; reviewAt: string | null; version: string | null; owner: { id: number; name: string } | null; notes: string | null; archived: boolean;
  documents: Doc[]; status: ComplianceStatus; canManage: boolean;
};
export type RegisterData = { admin: boolean; me: number; entities: { id: number; name: string; shortName: string | null }[]; staff: { id: number; name: string }[]; items: Item[] };

const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const muted = { color: "var(--psg-muted)" };
const inp: React.CSSProperties = { width: "100%", padding: "7px 9px", border: "1px solid var(--psg-card-border)", borderRadius: 6, fontSize: 13, color: "#fff", backgroundColor: "rgba(255,255,255,0.04)", boxSizing: "border-box" };
const lbl = "block text-[11px] font-semibold uppercase tracking-wider mb-1";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const iso = (d: string | null) => (d ? d.slice(0, 10) : "");
const TONE: Record<ComplianceStatus, [string, string]> = { valid: ["rgba(52,211,153,0.15)", "#6ee7b7"], due: ["rgba(251,191,36,0.15)", "#fcd34d"], expired: ["rgba(248,113,113,0.2)", "#fca5a5"], undated: ["rgba(148,163,184,0.15)", "#cbd5e1"] };
const company = (i: Item) => i.entity ? (i.entity.shortName ?? i.entity.name) : "Group";
const blank = { name: "", category: "insurance", entityId: "", issuer: "", reference: "", cover: "", validFrom: "", expiresAt: "", reviewAt: "", version: "", ownerId: "", notes: "" };

export default function ComplianceView({ initial }: { initial: RegisterData }) {
  const params = useSearchParams();
  const [d, setD] = useState(initial);
  const [who, setWho] = useState<string>("all"); // all | group | entity id
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(Number(params.get("item")) || null);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [upload, setUpload] = useState<{ file: File | null; validFrom: string; expiresAt: string; version: string; renew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }) });
    setBusy(false);
    const x = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(x.error ?? "That didn't work"); return null; }
    if (x.items) setD(x);
    return x;
  }

  const shown = useMemo(() => d.items.filter(i => (showRetired || !i.archived)
    && (who === "all" || (who === "group" ? i.entityId === null : String(i.entityId) === who))
    && (cat === "all" || i.category === cat)
    && (!q.trim() || `${i.name} ${i.issuer ?? ""} ${i.reference ?? ""} ${company(i)}`.toLowerCase().includes(q.trim().toLowerCase()))), [d.items, who, cat, q, showRetired]);
  const live = d.items.filter(i => !i.archived);
  const n = (s: ComplianceStatus) => live.filter(i => i.status === s).length;
  const open = d.items.find(i => i.id === openId) ?? null;

  async function pack() {
    const items = d.items.filter(i => picked.has(i.id));
    await exportCompliancePackPDF("Compliance pack", items.map(i => ({ category: CATEGORY_LABEL[i.category], name: i.name, company: i.entity?.name ?? "Group-wide", issuer: i.issuer, reference: i.reference, cover: i.cover, validTo: keyDate(i), version: i.version, documents: i.documents.length })));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold text-white m-0">Compliance register</h1>
          <p className="text-sm m-0 mt-1" style={muted}>Insurances, accreditations, policies and certificates for the group, and which company each belongs to. {d.admin ? "" : "Admins and each item's owner keep it up to date."}</p>
        </div>
        {d.admin && <button type="button" onClick={() => setForm({ ...blank })} className="text-sm font-semibold px-3 py-2 rounded" style={{ backgroundColor: "var(--psg-blue)", color: "#fff" }}>+ Add to the register</button>}
      </header>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([["Items", String(live.length), undefined], ["Expired", String(n("expired")), n("expired") > 0], ["Due in 60 days", String(n("due")), false], ["No date set", String(n("undated")), false]] as const).map(([l, v, bad]) => (
          <div key={l} className="rounded-xl border px-4 py-3" style={{ ...card, ...(bad ? { borderColor: "rgba(248,113,113,0.6)" } : {}) }}>
            <div className="text-[11px] uppercase tracking-wider" style={muted}>{l}</div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: bad ? "#fca5a5" : "#fff" }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Company" style={{ ...inp, width: "auto" }} value={who} onChange={e => setWho(e.target.value)}>
          <option value="all">All companies</option><option value="group">Group-wide</option>
          {d.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select aria-label="Kind" style={{ ...inp, width: "auto" }} value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">All kinds</option>{COMPLIANCE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input aria-label="Search" placeholder="Search" style={{ ...inp, width: "12rem" }} value={q} onChange={e => setQ(e.target.value)} />
        <label className="text-xs flex items-center gap-1.5" style={muted}><input type="checkbox" checked={showRetired} onChange={e => setShowRetired(e.target.checked)} />Show retired</label>
        <span className="ml-auto flex gap-2 items-center">
          {picked.size > 0 && <span className="text-xs" style={muted}>{picked.size} ticked</span>}
          <button type="button" disabled={!picked.size} onClick={pack} className="text-xs border rounded px-3 py-1.5 disabled:opacity-40" style={{ ...muted, borderColor: "var(--psg-card-border)" }} title="A PDF listing the ticked items, to send with their documents">Tender pack PDF</button>
          {picked.size > 0 && <button type="button" onClick={() => setPicked(new Set())} className="text-xs underline" style={muted}>Clear</button>}
        </span>
      </div>

      <section className="rounded-xl border overflow-hidden" style={card} aria-label="Register">
        {shown.length === 0 ? <p className="text-sm text-center py-10 m-0" style={muted}>{d.items.length ? "Nothing matches." : d.admin ? "Nothing in the register yet. Add your insurances first: employer's liability, public liability, professional indemnity." : "Nothing in the register yet."}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr className="text-left text-[11px] uppercase tracking-wider" style={muted}>
                <th className="px-3 py-2 w-8"><span className="sr-only">Pick</span></th><th className="px-2 py-2">Item</th><th className="px-2 py-2">Company</th><th className="px-2 py-2">Kind</th><th className="px-2 py-2">Renewal / review</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Owner</th>
              </tr></thead>
              <tbody>
                {shown.map(i => {
                  const [bg, fg] = TONE[i.status];
                  return (
                    <tr key={i.id} className="hover:bg-white/5" style={{ borderTop: "1px solid var(--psg-card-border)", opacity: i.archived ? 0.55 : 1 }}>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Add ${i.name} to the tender pack`} checked={picked.has(i.id)} onChange={() => setPicked(p => { const x = new Set(p); if (x.has(i.id)) x.delete(i.id); else x.add(i.id); return x; })} /></td>
                      <td className="px-2 py-2"><button type="button" onClick={() => { setOpenId(i.id); setUpload(null); }} className="text-left text-white font-semibold hover:underline">{i.name}</button>
                        <span className="block text-xs" style={muted}>{[i.issuer, i.reference, i.cover ?? i.version].filter(Boolean).join(" · ") || "—"}{i.documents.length ? "" : " · no document"}</span></td>
                      <td className="px-2 py-2 text-white">{company(i)}</td>
                      <td className="px-2 py-2" style={muted}>{CATEGORY_LABEL[i.category]}</td>
                      <td className="px-2 py-2 text-white tabular-nums">{day(keyDate(i)) || "—"}</td>
                      <td className="px-2 py-2"><span className="text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: bg, color: fg }}>{i.archived ? "Retired" : STATUS_LABEL[i.status]}</span></td>
                      <td className="px-2 py-2" style={muted}>{i.owner?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs m-0" style={muted}>Owners and admins are reminded 60, 30 and 7 days before a renewal or review, and on the day. The tender pack is a PDF list of the ticked items; download their documents from each item.</p>

      {form && (
        <Modal title="Add to the register" onClose={() => setForm(null)}>
          <form className="grid gap-3" onSubmit={async e => { e.preventDefault(); const r = await call("/api/compliance", "POST", form); if (r) { setForm(null); setOpenId(r.id); } }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="c-name" className={lbl} style={muted}>Name</label><input id="c-name" required autoFocus style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Public liability insurance" /></div>
              <div><label htmlFor="c-cat" className={lbl} style={muted}>Kind</label><select id="c-cat" style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{COMPLIANCE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l.replace(/s$/, "")}</option>)}</select></div>
              <div><label htmlFor="c-ent" className={lbl} style={muted}>Belongs to</label><select id="c-ent" style={inp} value={form.entityId} onChange={e => setForm({ ...form, entityId: e.target.value })}><option value="">The whole group</option>{d.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><label htmlFor="c-iss" className={lbl} style={muted}>{form.category === "policy" ? "Written by" : "Issued by"}</label><input id="c-iss" style={inp} value={form.issuer} onChange={e => setForm({ ...form, issuer: e.target.value })} placeholder={form.category === "insurance" ? "e.g. Hiscox" : ""} /></div>
              <div><label htmlFor="c-ref" className={lbl} style={muted}>Policy / certificate number</label><input id="c-ref" style={inp} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
              {form.category === "policy"
                ? <div><label htmlFor="c-ver" className={lbl} style={muted}>Version</label><input id="c-ver" style={inp} value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="e.g. v2, Nov 2026" /></div>
                : <div><label htmlFor="c-cov" className={lbl} style={muted}>Cover / level</label><input id="c-cov" style={inp} value={form.cover} onChange={e => setForm({ ...form, cover: e.target.value })} placeholder={form.category === "insurance" ? "e.g. £10m" : "e.g. Contractor"} /></div>}
              <div><label htmlFor="c-own" className={lbl} style={muted}>Owner (keeps it up to date)</label><select id="c-own" style={inp} value={form.ownerId} onChange={e => setForm({ ...form, ownerId: e.target.value })}><option value="">Admins</option>{d.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label htmlFor="c-from" className={lbl} style={muted}>Valid from</label><input id="c-from" type="date" style={inp} value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></div>
              {form.category === "policy"
                ? <div><label htmlFor="c-rev" className={lbl} style={muted}>Next review</label><input id="c-rev" type="date" style={inp} value={form.reviewAt} onChange={e => setForm({ ...form, reviewAt: e.target.value })} /></div>
                : <div><label htmlFor="c-exp" className={lbl} style={muted}>Renewal / expiry date</label><input id="c-exp" type="date" style={inp} value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></div>}
            </div>
            <div className="flex gap-2"><button type="submit" disabled={busy} className="text-sm font-semibold px-3 py-1.5 rounded" style={{ backgroundColor: "var(--psg-blue)", color: "#fff" }}>Add</button><span className="text-xs self-center" style={muted}>Upload the document next.</span></div>
          </form>
        </Modal>
      )}

      {open && (
        <Modal title={open.name} onClose={() => { setOpenId(null); setUpload(null); }}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: TONE[open.status][0], color: TONE[open.status][1] }}>{open.archived ? "Retired" : STATUS_LABEL[open.status]}</span>
              <span style={muted}>{CATEGORY_LABEL[open.category]} · {open.entity?.name ?? "Group-wide"}</span>
            </div>
            {open.canManage && !open.archived ? (
              <div className="grid gap-3 sm:grid-cols-2" key={`${open.id}-${open.expiresAt}-${open.reviewAt}-${open.version}`}>
                {([["issuer", open.category === "policy" ? "Written by" : "Issued by"], ["reference", "Policy / certificate number"], [open.category === "policy" ? "version" : "cover", open.category === "policy" ? "Version" : "Cover / level"]] as const).map(([k, l]) => (
                  <div key={k}><label htmlFor={`e-${k}`} className={lbl} style={muted}>{l}</label><input id={`e-${k}`} style={inp} defaultValue={open[k] ?? ""} onBlur={e => e.target.value !== (open[k] ?? "") && call(`/api/compliance/${open.id}`, "PATCH", { [k]: e.target.value })} /></div>
                ))}
                {([["validFrom", "Valid from"], [open.category === "policy" ? "reviewAt" : "expiresAt", open.category === "policy" ? "Next review" : "Renewal / expiry"]] as const).map(([k, l]) => (
                  <div key={k}><label htmlFor={`e-${k}`} className={lbl} style={muted}>{l}</label><input id={`e-${k}`} type="date" style={inp} defaultValue={iso(open[k])} onBlur={e => e.target.value !== iso(open[k]) && call(`/api/compliance/${open.id}`, "PATCH", { [k]: e.target.value })} /></div>
                ))}
                {d.admin && <>
                  <div><label htmlFor="e-own" className={lbl} style={muted}>Owner</label><select id="e-own" style={inp} defaultValue={open.owner?.id ?? ""} onChange={e => call(`/api/compliance/${open.id}`, "PATCH", { ownerId: e.target.value })}><option value="">Admins</option>{d.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><label htmlFor="e-ent" className={lbl} style={muted}>Belongs to</label><select id="e-ent" style={inp} defaultValue={open.entityId ?? ""} onChange={e => call(`/api/compliance/${open.id}`, "PATCH", { entityId: e.target.value })}><option value="">The whole group</option>{d.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                </>}
                <div className="sm:col-span-2"><label htmlFor="e-notes" className={lbl} style={muted}>Notes</label><textarea id="e-notes" rows={2} style={{ ...inp, resize: "vertical" }} defaultValue={open.notes ?? ""} onBlur={e => e.target.value !== (open.notes ?? "") && call(`/api/compliance/${open.id}`, "PATCH", { notes: e.target.value })} /></div>
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2 m-0">
                {[["Issued by", open.issuer], ["Number", open.reference], ["Cover / version", open.cover ?? open.version], ["Valid from", day(open.validFrom)], [open.category === "policy" ? "Next review" : "Renewal", day(keyDate(open))], ["Owner", open.owner?.name], ["Notes", open.notes]].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l}><dt className={lbl} style={muted}>{l}</dt><dd className="m-0 text-white">{v}</dd></div>
                ))}
              </dl>
            )}

            <div>
              <p className={lbl} style={muted}>Documents</p>
              {open.documents.length === 0 ? <p className="m-0 text-xs" style={muted}>No document yet.</p> : (
                <ul className="m-0 p-0 list-none space-y-1.5">
                  {open.documents.map((doc, k) => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-2">
                      <a href={`/api/compliance-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">{doc.name}</a>
                      <span className="text-xs" style={muted}>{k === 0 ? "current · " : ""}{[doc.version, doc.expiresAt && `to ${day(doc.expiresAt)}`, `added ${day(doc.createdAt)}${doc.uploadedBy ? ` by ${doc.uploadedBy.name}` : ""}`].filter(Boolean).join(" · ")}</span>
                      {d.admin && <button type="button" aria-label={`Delete ${doc.name}`} disabled={busy} onClick={async () => { if (await confirmDialog(`Delete ${doc.name} for good? It can't be undone.`, { danger: true, confirmLabel: "Delete" })) call(`/api/compliance-documents/${doc.id}`, "DELETE"); }} className="text-xs" style={muted}>✕</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.canManage && !open.archived && (upload ? (
              <form className="grid gap-3 p-3 rounded-lg" style={{ border: "1px solid var(--psg-card-border)" }} onSubmit={async e => {
                e.preventDefault(); if (!upload.file) return;
                const fd = new FormData(); fd.append("file", upload.file); fd.append("validFrom", upload.validFrom); fd.append("expiresAt", upload.expiresAt); fd.append("version", upload.version); if (upload.renew) fd.append("renew", "1");
                if (await call(`/api/compliance/${open.id}/documents`, "POST", fd)) setUpload(null);
              }}>
                <div><label htmlFor="u-file" className={lbl} style={muted}>File (PDF, Word or picture)</label><input id="u-file" type="file" required accept="application/pdf,image/*,.doc,.docx" className="text-xs text-white" onChange={e => setUpload({ ...upload, file: e.target.files?.[0] ?? null })} /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label htmlFor="u-from" className={lbl} style={muted}>Valid from</label><input id="u-from" type="date" style={inp} value={upload.validFrom} onChange={e => setUpload({ ...upload, validFrom: e.target.value })} /></div>
                  <div><label htmlFor="u-to" className={lbl} style={muted}>{open.category === "policy" ? "Next review" : "Valid to"}</label><input id="u-to" type="date" style={inp} value={upload.expiresAt} onChange={e => setUpload({ ...upload, expiresAt: e.target.value })} /></div>
                  <div><label htmlFor="u-ver" className={lbl} style={muted}>Version (optional)</label><input id="u-ver" style={inp} value={upload.version} onChange={e => setUpload({ ...upload, version: e.target.value })} /></div>
                </div>
                <label className="text-xs flex items-center gap-1.5" style={muted}><input type="checkbox" checked={upload.renew} onChange={e => setUpload({ ...upload, renew: e.target.checked })} />This is the renewal: move the item&apos;s dates to these</label>
                <div className="flex gap-2"><button type="submit" disabled={busy || !upload.file} className="text-xs font-semibold px-3 py-1.5 rounded" style={{ backgroundColor: "var(--psg-blue)", color: "#fff" }}>Upload</button><button type="button" onClick={() => setUpload(null)} className="text-xs underline" style={muted}>Cancel</button></div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-3 items-center">
                <button type="button" onClick={() => setUpload({ file: null, validFrom: "", expiresAt: "", version: "", renew: open.documents.length > 0 })} className="text-xs font-semibold px-3 py-1.5 rounded" style={{ backgroundColor: "var(--psg-blue)", color: "#fff" }}>{open.documents.length ? "Upload the renewal" : "Upload the document"}</button>
                {d.admin && <button type="button" disabled={busy} onClick={async () => { if (await confirmDialog(`Retire ${open.name}? It leaves the register and its reminders stop; its documents are kept.`)) call(`/api/compliance/${open.id}`, "PATCH", { archived: true }); }} className="text-xs" style={muted}>Retire</button>}
              </div>
            ))}
            {open.archived && d.admin && <button type="button" onClick={() => call(`/api/compliance/${open.id}`, "PATCH", { archived: false })} className="text-xs underline" style={muted}>Bring back</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}
