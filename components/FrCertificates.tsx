"use client";

// Flame-retardant certificates on a build (27 Nov 2026), in the space's look: upload the
// certificate with what it covers, the standard, supplier and dates. Expired ones are flagged.
import { useRef, useState } from "react";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { fmtDate } from "@/lib/format";
import { FR_STANDARDS } from "@/lib/frCertsShared";
import { card, h2, muted, link, btnSolid, btnLine, input, label as lbl } from "@/lib/twsUi";

export type CertRow = { id: number; title: string; standard: string | null; supplier: string | null; issuedAt: string | null; expiresAt: string | null; url: string; expired: boolean; file: { name: string } };

export default function FrCertificates({ jobId, initial }: { jobId: number; initial: CertRow[] }) {
  const [certs, setCerts] = useState(initial);
  const [form, setForm] = useState<null | { title: string; standard: string; supplier: string; issuedAt: string; expiresAt: string }>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return alertDialog("Choose the certificate (PDF or photo).");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", file);
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/certificates`, { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't add it");
    setCerts(d); setForm(null);
  }
  async function remove(c: CertRow) {
    if (!(await confirmDialog(`Remove the certificate for ${c.title}?`))) return;
    const res = await fetch(`/api/jobs/${jobId}/certificates/${c.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't remove it");
    setCerts(d);
  }

  return (
    <section style={card} className="flex flex-col gap-3" aria-label="Flame-retardant certificates">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <h2 style={h2}>FR certificates</h2>
        <span className="text-[13px]" style={muted}>{certs.length ? `${certs.length} on file${certs.some(c => c.expired) ? " · some expired" : ""}` : "None yet"}</span>
      </div>
      {certs.length > 0 && (
        <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
          {certs.map(c => (
            <li key={c.id} className="py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
              <strong className="min-w-0 break-words">{c.title}</strong>
              {c.standard && <span className="text-xs" style={muted}>{c.standard}</span>}
              {c.expired && <span className="text-[11px] font-bold px-2 py-0.5" style={{ background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" }}>Expired {fmtDate(c.expiresAt!)}</span>}
              <span className="basis-full text-xs" style={muted}>{[c.supplier, c.issuedAt && `issued ${fmtDate(c.issuedAt)}`, c.expiresAt && !c.expired && `valid to ${fmtDate(c.expiresAt)}`].filter(Boolean).join(" · ") || c.file.name}</span>
              <span className="basis-full flex gap-3">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[13px]" style={link}>Open</a>
                <button type="button" onClick={() => remove(c)} className="text-xs" style={{ color: "var(--tws-bad-ink)" }}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {form ? (
        <form onSubmit={add} className="flex flex-col gap-2.5 p-3" style={{ background: "var(--tws-ground)" }}>
          <div><label htmlFor="fr-title" style={lbl}>What it covers</label><input id="fr-title" required autoFocus style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. 18mm FR MDF, black wool serge" /></div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><label htmlFor="fr-std" style={lbl}>Standard</label><input id="fr-std" list="fr-standards" style={input} value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} placeholder="Pick or type" />
              <datalist id="fr-standards">{FR_STANDARDS.map(s => <option key={s} value={s} />)}</datalist></div>
            <div><label htmlFor="fr-sup" style={lbl}>Supplier or treated by</label><input id="fr-sup" style={input} value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
            <div><label htmlFor="fr-iss" style={lbl}>Issued</label><input id="fr-iss" type="date" style={input} value={form.issuedAt} onChange={e => setForm({ ...form, issuedAt: e.target.value })} /></div>
            <div><label htmlFor="fr-exp" style={lbl}>Valid until (if it says)</label><input id="fr-exp" type="date" style={input} value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></div>
          </div>
          <div><label htmlFor="fr-file" style={lbl}>Certificate (PDF or photo)</label><input id="fr-file" ref={fileRef} type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" /></div>
          <div className="flex gap-2"><button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>{busy ? "Uploading…" : "Add certificate"}</button><button type="button" onClick={() => setForm(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button></div>
        </form>
      ) : (
        <button type="button" onClick={() => setForm({ title: "", standard: "", supplier: "", issuedAt: "", expiresAt: "" })} className="self-start text-[13px] font-semibold" style={link}>+ Add a certificate</button>
      )}
    </section>
  );
}
