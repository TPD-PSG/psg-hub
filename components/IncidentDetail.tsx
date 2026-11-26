"use client";

// One accident & incident report and its follow-up (26 Nov 2026): what happened, then (for the show's
// staff and the H&S leads) severity, investigation, root cause, RIDDOR, corrective actions, and an
// H&S lead's sign-off to close. Used on a production's H&S tab and on the central H&S page.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import { photosFrom } from "@/components/IncidentForm";
import { KIND_LABEL, TREATMENT_LABEL, RIDDOR, STATUS_LABEL, incidentRef, incidentPath, riddorHint, closeBlockers } from "@/lib/incidentsCore";

export type IncidentAction = { id: number; text: string; dueDate: string | null; doneAt: string | null; owner: { id: number; name: string } | null };
export type Incident = {
  id: number; year: number; number: number; productionId: number | null; production: { id: number; name: string } | null; entity: { id: number; name: string; slug: string | null } | null;
  kind: string; occurredAt: string; location: string | null; venueName: string | null; description: string; immediateAction: string | null;
  injuredName: string | null; injuredRole: string | null; injuredEmployer: string | null; injuryDetails: string | null; bodyPart: string | null;
  treatment: string | null; offWork: boolean; witnesses: string | null; reporterName: string; reporterContact: string | null; viaQr: boolean;
  reportedBy: { id: number; name: string } | null; status: string; severity: string | null; investigation: string | null; rootCause: string | null;
  riddor: string | null; riddorDueDate: string | null; riddorReportedAt: string | null; riddorRef: string | null;
  closedAt: string | null; closedBy: { id: number; name: string } | null; closeNote: string | null; createdAt: string; actions: IncidentAction[];
  photos: { id: number; name: string }[];
};

const muted = { color: "var(--psg-muted)" };
const inp: React.CSSProperties = { width: "100%", padding: "7px 9px", border: "1px solid var(--psg-card-border)", borderRadius: 6, fontSize: 13, color: "var(--inc-ink, #fff)", backgroundColor: "var(--inc-field, rgba(255,255,255,0.04))", boxSizing: "border-box" };
const lbl = "block text-[11px] font-semibold uppercase tracking-wider mb-1";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

export function StatusPill({ i }: { i: Pick<Incident, "status" | "riddor" | "riddorReportedAt" | "riddorDueDate"> }) {
  const late = i.riddor && i.riddor !== "no" && !i.riddorReportedAt && i.riddorDueDate && new Date(i.riddorDueDate) < new Date();
  const colours: Record<string, [string, string]> = { open: ["var(--inc-bad-bg, rgba(248,113,113,0.15))", "var(--inc-bad-ink, #fca5a5)"], investigating: ["var(--inc-warn-bg, rgba(251,191,36,0.15))", "var(--inc-warn-ink, #fcd34d)"], closed: ["var(--inc-ok-bg, rgba(52,211,153,0.15))", "var(--inc-ok-ink, #6ee7b7)"] };
  const [bg, fg] = colours[i.status] ?? colours.open;
  return (
    <span className="inline-flex gap-1 flex-wrap">
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: bg, color: fg }}>{STATUS_LABEL[i.status] ?? i.status}</span>
      {i.riddor && i.riddor !== "no" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: late ? "var(--inc-bad-bg, rgba(248,113,113,0.25))" : "var(--inc-info-bg, rgba(147,197,253,0.15))", color: late ? "var(--inc-bad-ink, #fca5a5)" : "var(--inc-info-ink, #93c5fd)" }}>RIDDOR{i.riddorReportedAt ? " ✓" : late ? " overdue" : ` by ${day(i.riddorDueDate)}`}</span>}
    </span>
  );
}

export default function IncidentDetail({ incident, manage, lead, people, onChange, onDeleted, showProduction = false }: {
  incident: Incident; manage: boolean; lead: boolean; people: { id: number; name: string }[];
  onChange: (i: Incident) => void; onDeleted: () => void; showProduction?: boolean;
}) {
  const i = incident;
  const closed = i.status === "closed";
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState({ text: "", ownerId: "", dueDate: "" });
  const [closeNote, setCloseNote] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't work"); return null; }
    if (d && d.id === i.id) onChange(d);
    return d;
  }
  const save = (patch: Record<string, unknown>) => call(`/api/incidents/${i.id}`, "PATCH", patch);
  const hint = riddorHint(i);
  const blockers = closeBlockers(i);

  const row = (label: string, value: React.ReactNode) => value ? <div><dt className={lbl} style={muted}>{label}</dt><dd className="text-sm text-white m-0 whitespace-pre-wrap">{value}</dd></div> : null;

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs" style={muted}>{incidentRef(i)}</span>
        <StatusPill i={i} />
        {showProduction && <Link href={incidentPath(i)} className="text-xs text-blue-300 hover:underline">{i.production?.name ?? i.entity?.name}</Link>}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {row("What", KIND_LABEL[i.kind] ?? i.kind)}
        {row("When", when(i.occurredAt))}
        {row("Where", [i.venueName, i.location].filter(Boolean).join(" · "))}
        {row("Reported by", `${i.reporterName}${i.reporterContact ? ` (${i.reporterContact})` : ""}${i.viaQr ? " · QR form" : ""} · ${day(i.createdAt)}`)}
      </dl>
      <dl className="grid gap-3">
        {row("What happened", i.description)}
        {row("Done straight away", i.immediateAction)}
      </dl>
      {(i.injuredName || i.injuryDetails || i.treatment) && (
        <dl className="grid gap-3 sm:grid-cols-2 p-3 rounded-lg" style={{ backgroundColor: "var(--inc-field, rgba(255,255,255,0.03))", border: "1px solid var(--psg-card-border)" }}>
          {row("Person affected", [i.injuredName, i.injuredRole, i.injuredEmployer].filter(Boolean).join(" · "))}
          {row("Injury", [i.injuryDetails, i.bodyPart].filter(Boolean).join(" · "))}
          {row("Treatment", i.treatment ? TREATMENT_LABEL[i.treatment] : null)}
          {row("Off work", i.offWork ? "Yes, stopped work or went home" : null)}
        </dl>
      )}
      {row("Witnesses", i.witnesses)}

      {(i.photos.length > 0 || !closed) && (
        <div>
          <p className={lbl} style={muted}>Photos</p>
          <div className="flex flex-wrap gap-2 items-center">
            {i.photos.map(p => (
              <span key={p.id} className="relative">
                <a href={`/api/incident-photos/${p.id}`} target="_blank" rel="noopener noreferrer" title={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/incident-photos/${p.id}`} alt={p.name} className="block rounded" style={{ width: 88, height: 88, objectFit: "cover" }} />
                </a>
                {manage && !closed && <button type="button" aria-label={`Remove ${p.name}`} disabled={busy}
                  onClick={async () => { if (await confirmDialog("Remove this photo from the report?")) call(`/api/incident-photos/${p.id}`, "DELETE"); }}
                  className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full text-white text-sm leading-6" style={{ background: "rgba(0,0,0,0.65)" }}>×</button>}
              </span>
            ))}
            {!closed && i.photos.length < 4 && (
              <label className="text-xs border rounded px-3 py-1.5 cursor-pointer hover:bg-white/5" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>
                {busy ? "Adding…" : "+ Add photos"}
                <input type="file" accept="image/*" multiple className="hidden" disabled={busy}
                  onChange={async e => { const files = e.target.files; e.target.value = ""; if (!files?.length) return; setBusy(true); const photos = await photosFrom(files, 4 - i.photos.length); setBusy(false); call(`/api/incidents/${i.id}/photos`, "POST", { photos }); }} />
              </label>
            )}
          </div>
        </div>
      )}

      {manage && (
        <section className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--psg-card-border)" }} aria-label="Follow-up">
          <h3 className="text-sm font-semibold text-white">Follow-up</h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div><label htmlFor={`sev-${i.id}`} className={lbl} style={muted}>Severity</label>
              <select id={`sev-${i.id}`} disabled={closed || busy} style={inp} value={i.severity ?? ""} onChange={e => save({ severity: e.target.value })}>
                <option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select></div>
            <div><label htmlFor={`rid-${i.id}`} className={lbl} style={muted}>RIDDOR</label>
              <select id={`rid-${i.id}`} disabled={closed || busy} style={inp} value={i.riddor ?? ""} onChange={e => save({ riddor: e.target.value })}>
                <option value="">Not decided yet</option>{RIDDOR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          </div>
          {!i.riddor && hint && <p className="text-xs" style={{ color: "var(--inc-warn-ink, #fcd34d)" }}>{hint}</p>}
          {i.riddor && i.riddor !== "no" && (
            <div className="grid gap-3 sm:grid-cols-3 items-end">
              <div><span className={lbl} style={muted}>Report to the HSE by</span><span className="text-sm text-white">{day(i.riddorDueDate)}</span></div>
              <div><label htmlFor={`rat-${i.id}`} className={lbl} style={muted}>Reported on</label>
                <input id={`rat-${i.id}`} type="date" disabled={closed || busy} style={inp} defaultValue={iso(i.riddorReportedAt)} onBlur={e => e.target.value !== iso(i.riddorReportedAt) && save({ riddorReportedAt: e.target.value })} /></div>
              <div><label htmlFor={`rref-${i.id}`} className={lbl} style={muted}>HSE reference</label>
                <input id={`rref-${i.id}`} disabled={closed || busy} style={inp} defaultValue={i.riddorRef ?? ""} onBlur={e => e.target.value !== (i.riddorRef ?? "") && save({ riddorRef: e.target.value })} /></div>
              <p className="text-xs sm:col-span-3" style={muted}>Report online at hse.gov.uk/riddor. Check HSE guidance if you&apos;re unsure: this sets the deadline, it doesn&apos;t decide for you.</p>
            </div>
          )}
          <div><label htmlFor={`inv-${i.id}`} className={lbl} style={muted}>Investigation: what we found</label>
            <textarea id={`inv-${i.id}`} rows={3} disabled={closed || busy} style={{ ...inp, resize: "vertical" }} defaultValue={i.investigation ?? ""} onBlur={e => e.target.value !== (i.investigation ?? "") && save({ investigation: e.target.value })} /></div>
          <div><label htmlFor={`rc-${i.id}`} className={lbl} style={muted}>Root cause</label>
            <textarea id={`rc-${i.id}`} rows={2} disabled={closed || busy} style={{ ...inp, resize: "vertical" }} defaultValue={i.rootCause ?? ""} onBlur={e => e.target.value !== (i.rootCause ?? "") && save({ rootCause: e.target.value })} /></div>

          <div>
            <p className={lbl} style={muted}>Actions to stop it happening again</p>
            {i.actions.length === 0 && <p className="text-xs m-0 mb-2" style={muted}>None yet.</p>}
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {i.actions.map(a => {
                const late = !a.doneAt && a.dueDate && new Date(a.dueDate) < new Date();
                return (
                  <li key={a.id} className="flex items-start gap-2">
                    <input type="checkbox" aria-label={`Done: ${a.text}`} disabled={closed || busy} checked={!!a.doneAt} onChange={e => call(`/api/incident-actions/${a.id}`, "PATCH", { done: e.target.checked })} className="mt-1" />
                    <span className="flex-1 min-w-0">
                      <span className={a.doneAt ? "line-through" : "text-white"} style={a.doneAt ? muted : undefined}>{a.text}</span>
                      <span className="block text-xs" style={{ color: late ? "var(--inc-bad-ink, #fca5a5)" : "var(--psg-muted)" }}>{[a.owner?.name, a.dueDate && `${late ? "overdue · was due" : "by"} ${day(a.dueDate)}`, a.doneAt && `done ${day(a.doneAt)}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    {!closed && <button type="button" aria-label={`Remove ${a.text}`} disabled={busy} onClick={async () => { if (await confirmDialog("Remove this action?")) call(`/api/incident-actions/${a.id}`, "DELETE"); }} className="text-xs" style={muted}>✕</button>}
                  </li>
                );
              })}
            </ul>
            {!closed && (
              <form className="grid gap-2 mt-2 sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem_auto]" aria-label="Add an action"
                onSubmit={async e => { e.preventDefault(); if (!act.text.trim()) return; if (await call(`/api/incidents/${i.id}/actions`, "POST", act)) setAct({ text: "", ownerId: "", dueDate: "" }); }}>
                <input aria-label="Action" placeholder="e.g. Add edge protection to the rostra" style={inp} value={act.text} onChange={e => setAct({ ...act, text: e.target.value })} />
                <select aria-label="Who" style={inp} value={act.ownerId} onChange={e => setAct({ ...act, ownerId: e.target.value })}><option value="">Who…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input aria-label="Due by" type="date" style={inp} value={act.dueDate} onChange={e => setAct({ ...act, dueDate: e.target.value })} />
                <button type="submit" disabled={busy || !act.text.trim()} className="text-xs px-3 py-1.5 rounded font-semibold" style={{ backgroundColor: "var(--psg-blue)", color: "#fff" }}>Add</button>
              </form>
            )}
          </div>
        </section>
      )}

      {manage && (
        <section className="pt-4 border-t space-y-2" style={{ borderColor: "var(--psg-card-border)" }} aria-label="Sign-off">
          <h3 className="text-sm font-semibold text-white">Sign-off</h3>
          {closed ? (
            <>
              <p className="text-sm text-white">Closed by {i.closedBy?.name ?? "an H&S lead"} on {day(i.closedAt)}.{i.closeNote ? ` ${i.closeNote}` : ""}</p>
              {lead && <button type="button" disabled={busy} onClick={() => call(`/api/incidents/${i.id}/close`, "POST", { reopen: true })} className="text-xs underline" style={muted}>Reopen</button>}
            </>
          ) : blockers.length ? (
            <ul className="pl-4 text-xs" style={muted}>{blockers.map(b => <li key={b}>{b}</li>)}</ul>
          ) : lead ? (
            <div className="flex flex-wrap gap-2 items-center">
              <input aria-label="Closing note" placeholder="Closing note (optional)" style={{ ...inp, flex: "1 1 14rem", width: "auto" }} value={closeNote} onChange={e => setCloseNote(e.target.value)} />
              <button type="button" disabled={busy} onClick={() => call(`/api/incidents/${i.id}/close`, "POST", { closeNote })} className="text-xs px-3 py-1.5 rounded font-semibold" style={{ backgroundColor: "#059669", color: "#fff" }}>Sign off and close</button>
            </div>
          ) : <p className="text-xs" style={muted}>Ready for an H&amp;S lead to sign off.</p>}
          {lead && (
            <button type="button" disabled={busy} className="block text-xs mt-2" style={{ color: "var(--inc-bad-ink, #fca5a5)" }}
              onClick={async () => { if (await confirmDialog(`Delete ${incidentRef(i)} for good? Only do this for a duplicate or a test. It can't be undone.`, { danger: true, confirmLabel: "Delete" })) { const res = await fetch(`/api/incidents/${i.id}`, { method: "DELETE" }); if (res.ok) onDeleted(); else alertDialog("Couldn't delete it"); } }}>
              Delete report
            </button>
          )}
        </section>
      )}
    </div>
  );
}
