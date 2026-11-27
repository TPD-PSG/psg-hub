// Page header for a space build: breadcrumbs, title, actions, the stage band and the drawings gate.
import { useState } from "react";
import Link from "next/link";
import { alertDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { BUILD_STAGES, stageIndex } from "@/lib/buildStages";
import { jobTypeLabel } from "@/lib/quotes";
import type { JobContactRow } from "@/components/BuildDesign";
import type { Blocker } from "@/components/DrawingRegister";
import { muted, link, btnSolid, btnLine, input, label as lbl, pageHeader, stageTone, dayChip } from "@/lib/twsUi";

export default function JobHeader({ space, base, job, setJob, busy, setBusy, blockers, initialContacts }: {
  space: SpaceTheme; base: string; job: JobDetail; setJob: (j: JobDetail) => void; busy: boolean; setBusy: (b: boolean) => void; blockers: Blocker[]; initialContacts: JobContactRow[];
}) {
  const [gate, setGate] = useState<null | { stage: string; message: string; canOverride: boolean; reason: string }>(null);
  const cur = stageIndex(job.stage);

  // Moving to Build or later is blocked until the drawings are signed off; admins can override with a reason
  async function setStage(stage: string, override?: string) {
    setBusy(true);
    const res = await fetch(`/api/jobs/${job.id}/build`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(override ? { stage, override: true, overrideReason: override } : { stage }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (res.status === 409) { setGate({ stage, message: d.error, canOverride: !!d.canOverride, reason: "" }); return; }
    if (!res.ok) return alertDialog(d.error ?? "That didn't work");
    setGate(null);
    if (override) { window.location.reload(); return; } // shows the override in the sign-off log
    if (d.job) setJob(d.job);
  }

  return (
    <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-4">
      <div className="text-[13px]" style={muted}>
        <Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › <Link href={`${base}/jobs`} style={{ color: "var(--tws-accent-ink)" }}>Build jobs</Link> › {job.number}
      </div>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="break-words" style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{job.title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={muted}>
            {job.forProduction && <span>Production: <Link href={`/productions/${job.forProduction.id}`} style={link}>{job.forProduction.name}</Link></span>}
            {job.client && <span>Client: {job.client.name}</span>}
            {initialContacts.filter(c => c.role === "designer").map(c => <span key={c.id}>Designer: {c.name}</span>)}
            <span>{jobTypeLabel(job.jobType)}</span>
            {job.status !== "active" && <strong style={{ color: "var(--tws-warn-ink)" }}>{job.status === "complete" ? "Complete" : "Cancelled"}</strong>}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a href="#log-days" style={btnLine}>Log days</a>
          <Link href={`${base}/materials?new=1&job=${job.id}`} style={btnLine}>Raise PO</Link>
          <Link href={`${base}/planner`} style={btnSolid}>Open in planner</Link>
        </div>
      </div>
      <ol aria-label="Build stages" className="grid gap-1 text-[13px] font-bold grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {BUILD_STAGES.map((s, i) => {
          const state = cur >= 0 && i < cur ? "done" : i === cur ? "now" : "todo";
          const text = `${state === "done" ? "✓ " : ""}${s.label}${state === "now" ? " · now" : ""}${s.key === "delivery" && job.endDate ? ` · ${dayChip(job.endDate).toLowerCase()}` : ""}`;
          return (
            <li key={s.key}>
              <button type="button" disabled={busy || state === "now"} onClick={() => setStage(s.key)} aria-current={state === "now" ? "step" : undefined}
                title={state === "now" ? undefined : `Move the build to ${s.label}`} className="w-full text-left px-3 py-2.5 disabled:cursor-default" style={{ ...stageTone(state), border: 0, font: "inherit", cursor: "pointer" }}>
                {text}
              </button>
            </li>
          );
        })}
      </ol>
      {blockers.length > 0 && !gate && stageIndex(job.stage) < stageIndex("build") && (
        <p className="text-[13px]" style={{ margin: 0, color: "var(--tws-warn-ink)" }}>⚠ {blockers.length} drawing{blockers.length === 1 ? "" : "s"} still to be signed off before this can move to Build.</p>
      )}
      {gate && (
        <div role="alert" className="flex flex-col gap-2 px-4 py-3 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
          <strong>Not yet: {gate.message}</strong>
          {gate.canOverride ? (
            <form onSubmit={e => { e.preventDefault(); if (gate.reason.trim()) setStage(gate.stage, gate.reason.trim()); }} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[240px]"><label htmlFor="gate-reason" style={lbl}>Override as an admin: why is it OK to go ahead? (logged on the build)</label>
                <input id="gate-reason" required style={input} value={gate.reason} onChange={e => setGate({ ...gate, reason: e.target.value })} placeholder="e.g. client approved on site visit, drawings to follow" /></div>
              <button type="submit" disabled={busy} style={{ ...btnSolid, padding: "8px 14px" }}>Override and move on</button>
              <button type="button" onClick={() => setGate(null)} style={{ ...btnLine, padding: "8px 14px" }}>Cancel</button>
            </form>
          ) : <span>Get the drawings signed off first (an admin can override if needed). <button type="button" onClick={() => setGate(null)} className="underline">OK</button></span>}
        </div>
      )}
    </header>
  );
}
