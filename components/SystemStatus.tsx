"use client";

// Hub Settings panel: when each background job (email import, backups, daily notifications)
// last ran and whether it worked, so a job that silently stops gets noticed.
import { useCallback, useEffect, useState } from "react";
import type { JobStatus, JobState } from "@/lib/job-status";
import type { Attention, AttentionReason } from "@/lib/importAttention";
import { fmtDateTime } from "@/lib/format";

const STATE: Record<JobState, { label: string; color: string; bg: string }> = {
  ok:      { label: "OK",      color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  late:    { label: "Overdue", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  failing: { label: "Failed",  color: "#f87171", bg: "rgba(239,68,68,0.12)" },
  never:   { label: "No runs yet", color: "var(--psg-muted)", bg: "rgba(255,255,255,0.06)" },
};

/** "4 min ago", "3 h ago", "2 days ago" */
function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

const REASON: Record<AttentionReason, { label: string; color: string; bg: string }> = {
  no_match:   { label: "No show match", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  no_pdf:     { label: "No PDF",        color: "var(--psg-muted)", bg: "rgba(255,255,255,0.06)" },
  unreadable: { label: "Couldn't read", color: "#f87171", bg: "rgba(239,68,68,0.12)" },
};

const every = (h: number) => (h >= 24 ? "daily" : h <= 1 ? "every few minutes" : "hourly");

export default function SystemStatus({ initialJobs = null, initialAttention = null }: { initialJobs?: JobStatus[] | null; initialAttention?: Attention | null }) {
  const [jobs, setJobs] = useState<JobStatus[] | null>(initialJobs);
  const [attention, setAttention] = useState<Attention | null>(initialAttention);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/status")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { setJobs(d.jobs); setAttention(d.attention ?? null); setError(null); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!initialJobs) load(); // otherwise it arrived with the page
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load, initialJobs]);

  const problems = jobs?.filter(j => j.state === "late" || j.state === "failing").length ?? 0;

  return (
    <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: problems ? "rgba(251,191,36,0.5)" : "var(--psg-card-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-white">System Status</h2>
        <button type="button" onClick={load} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--psg-muted)" }}>Refresh</button>
      </div>
      <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
        Background jobs and when they last ran. Anything overdue or failed is flagged here.
      </p>
      {error && <p className="text-sm" style={{ color: "#f87171" }}>Couldn&apos;t load status: {error}</p>}
      {!jobs && !error && <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Loading…</p>}
      {jobs && (
        <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
          {jobs.map(j => {
            const s = STATE[j.state];
            return (
              <li key={j.job} className="py-3 flex items-start gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{ color: s.color, backgroundColor: s.bg, minWidth: "4.5rem", textAlign: "center" }}>{s.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{j.label} <span className="text-xs" style={{ color: "var(--psg-muted)" }}>· runs {every(j.lateAfterH)}</span></p>
                  {j.lastRunAt ? (
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }} title={fmtDateTime(j.lastRunAt)}>
                      Last run {ago(j.lastRunAt)}{j.summary ? ` — ${j.summary}` : ""}
                      {j.state === "failing" && (j.lastOkAt ? ` · last worked ${ago(j.lastOkAt)}` : " · hasn't worked yet")}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Nothing recorded since this panel was added.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {attention && (
        <details className="rounded-lg border" style={{ borderColor: "var(--psg-card-border)" }} open={attention.items.some(i => i.reason !== "no_match")}>
          <summary className="px-3 py-2 cursor-pointer text-sm text-white select-none">
            Report emails not imported ({attention.items.length})
            <span className="text-xs ml-2" style={{ color: "var(--psg-muted)" }}>as of {ago(attention.at)}</span>
          </summary>
          <div className="px-3 pb-3 space-y-2">
            <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
              Unread emails in the reports inbox that the import left alone. &ldquo;No show match&rdquo; means the subject doesn&apos;t
              contain the name of a Hub production: fine for shows we don&apos;t run, but if it&apos;s one of ours, check the
              production&apos;s name matches how the company writes it. Reading an email in Outlook takes it off this list.
            </p>
            {attention.items.length === 0 && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Nothing waiting.</p>}
            <ul className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {attention.items.map((i, n) => {
                const r = REASON[i.reason];
                return (
                  <li key={n} className="py-2 flex items-start gap-3" style={{ borderColor: "var(--psg-card-border)" }}>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{ color: r.color, backgroundColor: r.bg, minWidth: "6.5rem", textAlign: "center" }}>{r.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white break-words">{i.subject}</p>
                      <p className="text-xs mt-0.5 break-words" style={{ color: "var(--psg-muted)" }}>
                        {[i.from, i.receivedAt ? fmtDateTime(i.receivedAt) : null].filter(Boolean).join(" · ")}
                        {i.detail ? ` — ${i.detail}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
