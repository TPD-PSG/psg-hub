"use client";

// On a build: who's on it (set designer, PM, client, venue, haulier…), the designer's drawings
// and model box photos. PSG staff add and remove; files open from the Hub, never public links.
import { useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/jobDesignShared";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl, caps } from "@/lib/twsUi";

export type JobContactRow = { id: number; role: string; name: string; company: string | null; email: string | null; phone: string | null; notes: string | null };
export type JobFileRow = { id: number; kind: string; name: string; mime: string; size: number; caption: string | null; url: string; uploadedById: number | null; uploadedBy: { name: string } | null };

const sizeText = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const BLANK = { role: "designer", name: "", company: "", email: "", phone: "" };

export default function BuildDesign({ jobId, initialContacts, initialFiles, me }: { jobId: number; initialContacts: JobContactRow[]; initialFiles: JobFileRow[]; me: { id: number; isAdmin: boolean } }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [files, setFiles] = useState(initialFiles);
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const drawings = files.filter(f => f.kind === "design"), model = files.filter(f => f.kind === "modelbox");

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy("contact");
    const res = await fetch(`/api/jobs/${jobId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't add them");
    setContacts(d); setForm(null);
  }
  async function removeContact(c: JobContactRow) {
    if (!(await confirmDialog(`Remove ${c.name} from this build?`))) return;
    const res = await fetch(`/api/jobs/${jobId}/contacts/${c.id}`, { method: "DELETE" });
    if (res.ok) setContacts(cs => cs.filter(x => x.id !== c.id));
  }
  async function upload(kind: "design" | "modelbox", list: FileList | null) {
    if (!list?.length) return;
    setBusy(kind);
    const fd = new FormData();
    fd.append("kind", kind);
    for (const f of [...list].slice(0, 12)) fd.append("files", f.type.startsWith("image/") ? await shrinkPhoto(f, 2400) : f);
    const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't upload that");
    setFiles(d);
  }
  async function removeFile(f: JobFileRow) {
    if (!(await confirmDialog(`Delete ${f.name}?`))) return;
    const res = await fetch(`/api/job-files/${f.id}`, { method: "DELETE" });
    if (res.ok) setFiles(fs => fs.filter(x => x.id !== f.id));
    else alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
  }
  const canDelete = (f: JobFileRow) => f.uploadedById === me.id || me.isAdmin;
  const uploadButton = (kind: "design" | "modelbox", text: string, accept: string) => (
    <label className="cursor-pointer text-[13px] font-bold px-3 py-2 inline-block" style={{ border: "2px solid var(--tws-char)", opacity: busy === kind ? 0.5 : 1 }}>
      {busy === kind ? "Uploading…" : text}
      <input type="file" accept={accept} multiple className="sr-only" disabled={!!busy} onChange={e => { upload(kind, e.target.files); e.target.value = ""; }} />
    </label>
  );

  return (
    <section style={card} className="flex flex-col gap-5 min-w-0" aria-label="Design and contacts">
      <h2 style={h2}>Design &amp; contacts</h2>

      {/* Contacts */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline gap-3"><span style={caps}>Who&apos;s on it</span>
          {!form && <button type="button" onClick={() => setForm({ ...BLANK, role: contacts.some(c => c.role === "designer") ? "production_manager" : "designer" })} className="text-[13px]" style={link}>+ Add someone</button>}</div>
        {contacts.length === 0 && !form && <p className="text-sm" style={muted}>Add the set designer so the team knows who to ask, and who drawings come from.</p>}
        {contacts.map(c => (
          <div key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm group" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
            <div className="min-w-0">
              <span className="text-xs font-bold mr-2" style={{ color: "var(--tws-accent-ink)" }}>{contactRoleLabel(c.role)}</span>
              <strong>{c.name}</strong>{c.company && <span style={muted}> · {c.company}</span>}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 text-[13px]">
              {c.email && <a href={`mailto:${c.email}`} style={link}>{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, "")}`} style={link}>{c.phone}</a>}
              <button type="button" onClick={() => removeContact(c)} aria-label={`Remove ${c.name}`} className="text-xs opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: "var(--tws-bad-ink)" }}>Remove</button>
            </div>
          </div>
        ))}
        {form && (
          <form onSubmit={addContact} className="grid gap-2 sm:grid-cols-2 p-3" style={{ background: "var(--tws-ground)" }}>
            <div><label htmlFor="bc-role" style={lbl}>Role</label>
              <select id="bc-role" style={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{CONTACT_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
            <div><label htmlFor="bc-name" style={lbl}>Name</label><input id="bc-name" required style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label htmlFor="bc-company" style={lbl}>Company</label><input id="bc-company" style={input} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><label htmlFor="bc-email" style={lbl}>Email</label><input id="bc-email" type="email" style={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label htmlFor="bc-phone" style={lbl}>Phone</label><input id="bc-phone" type="tel" style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="flex items-end gap-2"><button type="submit" disabled={busy === "contact"} style={{ ...btnSolid, padding: "8px 14px" }}>Add</button><button type="button" onClick={() => setForm(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
          </form>
        )}
      </div>

      {/* Designer drawings */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center gap-3 flex-wrap"><span style={caps}>Designer drawings</span>{uploadButton("design", "+ Upload drawings", "application/pdf,image/png,image/jpeg,image/webp")}</div>
        {drawings.length === 0 ? <p className="text-sm" style={muted}>PDFs or images from the designer (ground plans, elevations, details). VectorWorks files go under Drawings &amp; files as links.</p> : (
          <ul className="flex flex-col">
            {drawings.map(f => (
              <li key={f.id} className="flex justify-between gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate min-w-0" style={link}>{f.mime === "application/pdf" ? "📄" : "🖼"} {f.name}</a>
                <span className="flex gap-3 shrink-0 text-xs" style={muted}>{sizeText(f.size)}{f.uploadedBy ? ` · ${f.uploadedBy.name}` : ""}
                  {canDelete(f) && <button type="button" onClick={() => removeFile(f)} aria-label={`Delete ${f.name}`} style={{ color: "var(--tws-bad-ink)" }}>✕</button>}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Model box photos */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center gap-3 flex-wrap"><span style={caps}>Model box</span>{uploadButton("modelbox", "+ Add model box photos", "image/png,image/jpeg,image/webp")}</div>
        {model.length === 0 ? <p className="text-sm" style={muted}>Photos of the designer&apos;s model box, so the team can see what it&apos;s meant to look like.</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {model.map(f => (
              <figure key={f.id} className="relative group" style={{ margin: 0 }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                  <img src={f.url} alt={f.caption ?? f.name} loading="lazy" className="w-full h-28 object-cover" style={{ background: "var(--tws-tint)" }} />
                </a>
                {canDelete(f) && <button type="button" onClick={() => removeFile(f)} aria-label={`Delete ${f.name}`} className="absolute top-1 right-1 text-xs px-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ background: "var(--tws-night)", color: "#fff" }}>✕</button>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
