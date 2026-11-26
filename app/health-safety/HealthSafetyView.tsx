"use client";

// Health & Safety across every show (26 Nov 2026): accident & incident reports and their actions,
// RIDDOR deadlines, a year of figures, H&S documents missing or due for review, and this week's
// toolbox-talk sign-offs. H&S leads see every show; other staff the shows they're on the team for.
import { useCallback, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { alertDialog } from "@/components/Dialogs";
import IncidentDetail, { StatusPill, type Incident, type IncidentAction } from "@/components/IncidentDetail";
import { KIND_LABEL, INCIDENT_KINDS, incidentRef } from "@/lib/incidentsCore";

type Doc = { id: number; name: string; reviewDate: string | null };
export type HSData = {
  me: { lead: boolean; admin: boolean; managed: "all" | number[] };
  incidents: Incident[];
  stats: { months: { key: string; label: string; count: number }[]; byKind: Record<string, number>; byShow: { name: string; count: number }[]; open: number; last30: number; riddorDueSoon: number; riddorOverdue: number };
  openActions: (IncidentAction & { incident: { id: number; year: number; number: number; productionId: number; productionName: string } })[];
  docs: { id: number; name: string; status: string; count: number; noReviewDate: number; due: (Doc & { overdue: boolean })[]; documents: Doc[] }[];
  toolbox: { id: number; name: string; status: string; thisWeek: number; total: number; last: string | null }[];
  weekOf: string;
  leads: { ids: number[]; staff: { id: number; name: string; role: string }[] } | null;
};

const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const muted = { color: "var(--psg-muted)" };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function Tile({ label, value, sub, alert }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ ...card, ...(alert ? { borderColor: "rgba(248,113,113,0.6)" } : {}) }}>
      <div className="text-[11px] uppercase tracking-wider" style={muted}>{label}</div>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: alert ? "#fca5a5" : "#fff" }}>{value}</div>
      {sub && <div className="text-xs" style={muted}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border" style={card} aria-label={title}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        <h2 className="text-sm font-semibold text-white mr-auto m-0">{title}</h2>{aside}
      </div>
      {children}
    </section>
  );
}

export default function HealthSafetyView({ initial }: { initial: HSData | null }) {
  const [d, setD] = useState<HSData | null>(initial);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [open, setOpen] = useState<{ incident: Incident; manage: boolean; lead: boolean; people: { id: number; name: string }[] } | null>(null);
  const [docsShow, setDocsShow] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch("/api/health-safety").then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (r) setD(r);
  }, []);

  if (!d) return <p className="text-sm" style={muted}>The Health &amp; Safety page is for Hub staff.</p>;

  async function openIncident(id: number, productionId: number) {
    const r = await fetch(`/api/productions/${productionId}/incidents`).then(x => (x.ok ? x.json() : null)).catch(() => null);
    const inc = r?.incidents?.find((x: Incident) => x.id === id);
    if (!inc) return alertDialog("Couldn't open that report");
    setOpen({ incident: inc, manage: r.manage, lead: r.lead, people: r.people });
  }
  async function setReview(doc: Doc, value: string) {
    const res = await fetch(`/api/hs-documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewDate: value || null }) });
    if (!res.ok) return alertDialog("Couldn't save the review date");
    reload();
  }
  async function saveLeads(ids: number[]) {
    const res = await fetch("/api/health-safety", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: ids }) });
    if (!res.ok) return alertDialog("Couldn't save the H&S leads");
    reload();
  }

  const s = d.stats;
  const list = d.incidents.filter(i => filter === "all" || i.status !== "closed");
  const overdueActions = d.openActions.filter(a => a.dueDate && new Date(a.dueDate) < new Date()).length;
  const riddorWaiting = d.incidents.filter(i => i.riddor && i.riddor !== "no" && !i.riddorReportedAt);
  const docsDue = d.docs.reduce((n, x) => n + x.due.length, 0);
  const noDocs = d.docs.filter(x => x.count === 0);
  const max = Math.max(1, ...s.months.map(m => m.count));
  const scope = d.me.lead ? "every show" : "the shows you're on";
  const docsOpen = d.docs.find(x => x.id === docsShow) ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white m-0">Health &amp; Safety</h1>
        <p className="text-sm m-0 mt-1" style={muted}>Accidents, incidents and paperwork across {scope}. Report an incident from the show&apos;s H&amp;S tab, or put up its QR code for crew.</p>
      </header>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile label="Open reports" value={s.open} sub={`${s.last30} in the last 30 days`} />
        <Tile label="RIDDOR to report" value={riddorWaiting.length} sub={s.riddorOverdue ? `${s.riddorOverdue} overdue` : s.riddorDueSoon ? `${s.riddorDueSoon} due within 3 days` : "Nothing overdue"} alert={s.riddorOverdue > 0} />
        <Tile label="Open actions" value={d.openActions.length} sub={overdueActions ? `${overdueActions} overdue` : "None overdue"} alert={overdueActions > 0} />
        <Tile label="Documents to review" value={docsDue} sub={noDocs.length ? `${noDocs.length} live show${noDocs.length === 1 ? "" : "s"} with none` : "Every live show has some"} alert={d.docs.some(x => x.due.some(y => y.overdue))} />
      </div>

      {riddorWaiting.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(248,113,113,0.5)", backgroundColor: "rgba(248,113,113,0.06)" }} role="status">
          <strong className="text-white">RIDDOR reports to make: </strong>
          {riddorWaiting.map((i, n) => <span key={i.id}>{n > 0 && " · "}<button type="button" onClick={() => openIncident(i.id, i.productionId)} className="text-blue-300 hover:underline">{incidentRef(i)} {i.production.name}</button><span style={muted}> by {day(i.riddorDueDate)}</span></span>)}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Accidents & incidents" aside={
          <div className="flex gap-1" role="group" aria-label="Which reports">
            {(["open", "all"] as const).map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: filter === f ? "var(--psg-blue)" : "var(--psg-card-border)", color: filter === f ? "#fff" : "var(--psg-muted)" }}>{f === "open" ? "Open" : "Last 12 months"}</button>)}
          </div>
        }>
          {list.length === 0 ? <p className="text-xs text-center py-8 m-0" style={muted}>{filter === "open" ? "No open reports." : "Nothing reported in the last 12 months."}</p> : (
            <ul className="m-0 p-0 list-none">
              {list.map(i => (
                <li key={i.id} style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                  <button type="button" onClick={() => openIncident(i.id, i.productionId)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center">
                    <span className="min-w-0">
                      <span className="block text-sm text-white truncate"><strong className="font-semibold">{KIND_LABEL[i.kind] ?? i.kind}</strong>: {i.description}</span>
                      <span className="block text-xs" style={muted}>{i.production.name} · {day(i.occurredAt)} · <span className="font-mono">{incidentRef(i)}</span>{i.actions.some(a => !a.doneAt) ? ` · ${i.actions.filter(a => !a.doneAt).length} open action${i.actions.filter(a => !a.doneAt).length === 1 ? "" : "s"}` : ""}</span>
                    </span>
                    <StatusPill i={i} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Open actions">
          {d.openActions.length === 0 ? <p className="text-xs text-center py-8 m-0" style={muted}>No open actions.</p> : (
            <ul className="m-0 p-0 list-none">
              {d.openActions.map(a => {
                const late = a.dueDate && new Date(a.dueDate) < new Date();
                return (
                  <li key={a.id} className="px-4 py-2" style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                    <button type="button" onClick={() => openIncident(a.incident.id, a.incident.productionId)} className="text-left w-full">
                      <span className="block text-sm text-white">{a.text}</span>
                      <span className="block text-xs" style={{ color: late ? "#fca5a5" : "var(--psg-muted)" }}>{[a.owner?.name ?? "No one yet", a.dueDate && `${late ? "overdue, was due" : "by"} ${day(a.dueDate)}`, `${incidentRef(a.incident)} ${a.incident.productionName}`].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="The last 12 months">
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <figure className="m-0">
            <figcaption className="text-xs mb-2" style={muted}>Reports by month</figcaption>
            <div className="flex items-end gap-1.5 h-36" role="img" aria-label={`Reports by month: ${s.months.map(m => `${m.label} ${m.count}`).join(", ")}`}>
              {s.months.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0" title={`${m.label}: ${m.count} report${m.count === 1 ? "" : "s"}`}>
                  {m.count > 0 && <span className="text-[11px] tabular-nums text-white">{m.count}</span>}
                  <div className="w-full max-w-6" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 3 : 1, backgroundColor: m.count ? "#60a5fa" : "var(--psg-card-border)", borderRadius: "4px 4px 0 0" }} />
                  <span className="text-[10px]" style={muted}>{m.label}</span>
                </div>
              ))}
            </div>
          </figure>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-xs m-0 mb-1.5" style={muted}>By kind</p>
              <ul className="m-0 p-0 list-none text-sm space-y-0.5">
                {INCIDENT_KINDS.map(([k]) => <li key={k} className="flex justify-between gap-2"><span className="text-white">{KIND_LABEL[k]}</span><span className="tabular-nums" style={muted}>{s.byKind[k] ?? 0}</span></li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs m-0 mb-1.5" style={muted}>By show</p>
              {s.byShow.length === 0 ? <p className="text-sm m-0" style={muted}>None.</p> : (
                <ul className="m-0 p-0 list-none text-sm space-y-0.5">{s.byShow.slice(0, 8).map(x => <li key={x.name} className="flex justify-between gap-2"><span className="text-white truncate">{x.name}</span><span className="tabular-nums" style={muted}>{x.count}</span></li>)}</ul>
              )}
            </div>
          </div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="H&S documents on live shows">
          {d.docs.length === 0 ? <p className="text-xs text-center py-8 m-0" style={muted}>No live shows.</p> : (
            <ul className="m-0 p-0 list-none">
              {d.docs.map(x => (
                <li key={x.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                  <Link href={`/productions/${x.id}?section=hs`} className="text-sm text-white hover:underline mr-auto">{x.name}</Link>
                  {x.count === 0 ? <span className="text-xs font-semibold" style={{ color: "#fca5a5" }}>No risk assessments uploaded</span> : (
                    <>
                      <span className="text-xs" style={muted}>{x.count} doc{x.count === 1 ? "" : "s"}</span>
                      {x.due.length > 0 && <span className="text-xs font-semibold" style={{ color: x.due.some(y => y.overdue) ? "#fca5a5" : "#fcd34d" }}>{x.due.length} {x.due.some(y => y.overdue) ? "past review" : "due for review"}</span>}
                      {x.noReviewDate > 0 && <span className="text-xs" style={muted}>{x.noReviewDate} without a review date</span>}
                      <button type="button" onClick={() => setDocsShow(x.id)} className="text-xs text-blue-300 hover:underline">Review dates</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Toolbox talks this week" aside={<span className="text-xs" style={muted}>Week of {day(d.weekOf)}</span>}>
          {d.toolbox.length === 0 ? <p className="text-xs text-center py-8 m-0" style={muted}>No live shows.</p> : (
            <ul className="m-0 p-0 list-none">
              {d.toolbox.map(x => (
                <li key={x.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                  <Link href={`/productions/${x.id}?section=hs`} className="text-sm text-white hover:underline mr-auto">{x.name}</Link>
                  {x.thisWeek > 0 ? <span className="text-xs font-semibold" style={{ color: "#6ee7b7" }}>{x.thisWeek} sign-off{x.thisWeek === 1 ? "" : "s"}</span>
                    : <span className="text-xs font-semibold" style={{ color: x.status === "in-production" ? "#fcd34d" : "var(--psg-muted)" }}>None this week</span>}
                  <span className="text-xs" style={muted}>{x.last ? `last ${day(x.last)}` : "never"}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {d.leads && (
        <Section title="H&S leads">
          <div className="p-4 space-y-2">
            <p className="text-xs m-0" style={muted}>Leads see every show&apos;s reports, are told about each new one, and sign reports off. Admins always are. Each show&apos;s team staff see and follow up their own show&apos;s reports.</p>
            <div className="flex flex-wrap gap-2">
              {d.leads.staff.filter(u => u.role === "member").map(u => {
                const on = d.leads!.ids.includes(u.id);
                return <button key={u.id} type="button" aria-pressed={on} onClick={() => saveLeads(on ? d.leads!.ids.filter(x => x !== u.id) : [...d.leads!.ids, u.id])} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: on ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: on ? "rgba(59,130,246,0.15)" : "transparent", color: on ? "#fff" : "var(--psg-muted)" }}>{on ? "✓ " : ""}{u.name}</button>;
              })}
            </div>
          </div>
        </Section>
      )}

      {open && (
        <Modal title={`${KIND_LABEL[open.incident.kind] ?? "Incident"} · ${incidentRef(open.incident)}`} onClose={() => { setOpen(null); reload(); }}>
          <IncidentDetail key={open.incident.id} incident={open.incident} manage={open.manage} lead={open.lead} people={open.people} showProduction
            onChange={i => setOpen(o => o && { ...o, incident: i })} onDeleted={() => { setOpen(null); reload(); }} />
        </Modal>
      )}

      {docsOpen && (
        <Modal title={`Review dates · ${docsOpen.name}`} onClose={() => setDocsShow(null)}>
          <p className="text-xs mt-0" style={muted}>When each risk assessment or method statement must be looked at again. Upload new versions on the show&apos;s H&amp;S tab.</p>
          <ul className="m-0 p-0 list-none space-y-2">
            {docsOpen.documents.map(doc => (
              <li key={`${doc.id}-${doc.reviewDate}`} className="flex items-center gap-2">
                <a href={`/api/hs-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:underline flex-1 min-w-0 truncate">{doc.name}</a>
                <input type="date" aria-label={`Review date for ${doc.name}`} defaultValue={doc.reviewDate?.slice(0, 10) ?? ""} onBlur={e => e.target.value !== (doc.reviewDate?.slice(0, 10) ?? "") && setReview(doc, e.target.value)}
                  className="text-xs rounded px-2 py-1 border" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.04)", color: "#fff" }} />
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
