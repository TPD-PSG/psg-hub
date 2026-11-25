"use client";

// Builds by stage. Each card shows when it's due out and how it leaves; the arrows move it a
// stage back or forward (the job page has the full details).
import { useState } from "react";
import Link from "next/link";
import { alertDialog } from "@/components/Dialogs";
import { BUILD_STAGES, STAGE_COLOR, usesBuildStages } from "@/lib/buildStages";
import { fmtDate } from "@/lib/format";
import type { SpaceData } from "../SpaceHome";

export default function BuildBoard({ initial, slug }: { initial: SpaceData; slug: string }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const builds = data.jobs.filter(usesBuildStages);
  const unstaged = builds.filter(j => !j.stage);
  const today = new Date(new Date().toDateString());

  async function move(jobId: number, stage: string) {
    setBusy(jobId);
    const res = await fetch(`/api/jobs/${jobId}/build`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    if (!res.ok) { setBusy(null); return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't move the build"); }
    const fresh = await fetch(`/api/spaces/${slug}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (fresh?.space) setData(fresh);
    setBusy(null);
  }

  const columns = [...(unstaged.length ? [{ key: "", label: "No stage yet" }] : []), ...BUILD_STAGES];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/spaces/${slug}`} className="text-xs" style={{ color: "var(--psg-muted)" }}>← {data.space.name}</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Build board</h1>
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{builds.length} live build{builds.length === 1 ? "" : "s"}. Use the arrows to move a build between stages.</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, minWidth: columns.length * 210 }}>
          {columns.map(col => {
            const items = builds.filter(j => (j.stage ?? "") === col.key);
            const c = col.key ? STAGE_COLOR[col.key] : "#94a3b8";
            return (
              <section key={col.key || "none"} aria-label={col.label} className="rounded-lg border flex flex-col" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", borderTop: `3px solid ${c}` }}>
                <h2 className="px-3 py-2 text-sm font-semibold flex items-center justify-between" style={{ color: c }}>
                  {col.label}<span className="text-xs font-normal" style={{ color: "var(--psg-muted)" }}>{items.length}</span>
                </h2>
                <ul className="px-2 pb-2 space-y-2 flex-1">
                  {items.map(j => {
                    const idx = BUILD_STAGES.findIndex(s => s.key === j.stage);
                    const prev = idx > 0 ? BUILD_STAGES[idx - 1] : null;
                    const next = idx < 0 ? BUILD_STAGES[0] : idx < BUILD_STAGES.length - 1 ? BUILD_STAGES[idx + 1] : null;
                    const late = j.endDate && new Date(j.endDate) < today;
                    return (
                      <li key={j.id} className="rounded border p-2.5 text-sm" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)", opacity: busy === j.id ? 0.5 : 1 }}>
                        <Link href={`/jobs/${j.id}`} className="text-white hover:underline font-medium break-words">{j.title}</Link>
                        <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{[j.number, j.client?.name].filter(Boolean).join(" · ")}</div>
                        {j.forProduction && <div className="text-xs mt-0.5"><Link href={`/productions/${j.forProduction.id}`} className="text-blue-300 hover:underline">🎭 {j.forProduction.name}</Link></div>}
                        <div className="text-xs mt-1" style={{ color: late ? "#f87171" : "var(--psg-muted)" }}>
                          {j.endDate ? `${late ? "Overdue · " : "Out "}${fmtDate(j.endDate)}` : "No due-out date"}
                          {j.deliveryMethod ? ` · ${j.deliveryMethod === "delivery" ? "🚚 Delivery" : "Collection"}` : ""}
                        </div>
                        <div className="flex justify-between mt-2">
                          {prev ? <button type="button" disabled={busy !== null} onClick={() => move(j.id, prev.key)} aria-label={`Move ${j.title} back to ${prev.label}`} className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-40" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>← {prev.label}</button> : <span />}
                          {next && <button type="button" disabled={busy !== null} onClick={() => move(j.id, next.key)} aria-label={`Move ${j.title} on to ${next.label}`} className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-40" style={{ borderColor: STAGE_COLOR[next.key], color: STAGE_COLOR[next.key] }}>{next.label} →</button>}
                        </div>
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="text-xs px-1 py-2" style={{ color: "var(--psg-muted)" }}>Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
