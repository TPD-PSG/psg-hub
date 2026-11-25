"use client";

// Builds by stage, in the space's own look. Each card shows when it goes out and how; the
// arrows move it a stage back or on (staff), and the title opens the build's page.
import { useState } from "react";
import Link from "next/link";
import { alertDialog } from "@/components/Dialogs";
import { BUILD_STAGES, usesBuildStages } from "@/lib/buildStages";
import { caps, muted, pageHeader, dayChip } from "@/lib/twsUi";
import type { SpaceData } from "../SpaceHome";

export default function BuildBoard({ initial, slug }: { initial: SpaceData; slug: string }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const base = `/spaces/${slug}`;
  const builds = data.jobs.filter(usesBuildStages);
  const unstaged = builds.filter(j => !j.stage);
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const canEdit = data.canEdit !== false;

  async function move(jobId: number, stage: string) {
    setBusy(jobId);
    const res = await fetch(`/api/jobs/${jobId}/build`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    if (!res.ok) {
      setBusy(null);
      const d = await res.json().catch(() => ({}));
      return alertDialog(res.status === 409 ? `${d.error}. Open the build to ${d.canOverride ? "see them or override" : "see them"}.` : d.error ?? "Couldn't move the build");
    }
    const fresh = await fetch(`/api/spaces/${slug}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (fresh?.space) setData(fresh);
    setBusy(null);
  }

  const columns = [...(unstaged.length ? [{ key: "", label: "No stage yet" }] : []), ...BUILD_STAGES];
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-2">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{data.space.name}</Link> › Build board</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Build board</h1>
        <span className="text-sm" style={muted}>{builds.length} live build{builds.length === 1 ? "" : "s"}{canEdit ? " · use the arrows to move a build to the next stage" : ""}</span>
      </header>

      <div className="px-4 sm:px-10 py-6 overflow-x-auto">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(210px, 1fr))`, minWidth: columns.length * 220 }}>
          {columns.map((col, ci) => {
            const items = builds.filter(j => (j.stage ?? "") === col.key);
            const n = col.key ? BUILD_STAGES.findIndex(s => s.key === col.key) : -1;
            const rule = n >= 3 ? "var(--tws-accent)" : n >= 0 ? "var(--tws-char)" : "#a9aeb4";
            return (
              <section key={col.key || "none"} aria-label={col.label} className="flex flex-col" style={{ background: "var(--tws-card)", border: "1px solid var(--tws-line)", borderTop: `6px solid ${rule}` }}>
                <h2 className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ margin: 0 }}>
                  <span style={{ ...caps, color: "var(--tws-ink)", letterSpacing: "0.2em" }}>{col.key ? `${n + 1} · ` : ""}{col.label}</span>
                  <span className="text-xs font-bold px-1.5" style={{ background: "var(--tws-tint)" }}>{items.length}</span>
                </h2>
                <ul className="px-2 pb-2 flex flex-col gap-2 flex-1">
                  {items.map(j => {
                    const idx = BUILD_STAGES.findIndex(s => s.key === j.stage);
                    const prev = idx > 0 ? BUILD_STAGES[idx - 1] : null;
                    const next = idx < 0 ? BUILD_STAGES[0] : idx < BUILD_STAGES.length - 1 ? BUILD_STAGES[idx + 1] : null;
                    const late = j.endDate && new Date(j.endDate).getTime() < today;
                    return (
                      <li key={j.id} className="p-3 text-sm flex flex-col gap-1" style={{ background: "var(--tws-ground)", opacity: busy === j.id ? 0.5 : 1 }}>
                        <Link href={`${base}/jobs/${j.id}`} className="font-bold break-words hover:underline" style={{ color: "var(--tws-ink)" }}>{j.title}</Link>
                        <span className="text-xs" style={muted}>{[j.number, j.client?.name].filter(Boolean).join(" · ")}</span>
                        {j.forProduction && <Link href={`/productions/${j.forProduction.id}`} className="text-xs font-semibold hover:underline" style={{ color: "var(--tws-accent-ink)" }}>For {j.forProduction.name}</Link>}
                        <span className="text-xs" style={{ color: late ? "var(--tws-bad-ink)" : "var(--tws-muted)", fontWeight: late ? 700 : 400 }}>
                          {j.endDate ? `${late ? "Overdue · " : "Out "}${dayChip(j.endDate).toLowerCase()}` : "No due-out date"}
                          {j.deliveryMethod ? ` · ${j.deliveryMethod === "delivery" ? "delivery" : "collection"}` : ""}
                        </span>
                        {canEdit && (
                          <div className="flex justify-between gap-2 mt-1.5">
                            {prev ? <button type="button" disabled={busy !== null} onClick={() => move(j.id, prev.key)} aria-label={`Move ${j.title} back to ${prev.label}`}
                              className="text-xs px-2 py-1.5 font-semibold disabled:opacity-40" style={{ border: "1px solid var(--tws-line)", background: "var(--tws-card)", color: "var(--tws-muted)" }}>← {prev.label}</button> : <span />}
                            {next && <button type="button" disabled={busy !== null} onClick={() => move(j.id, next.key)} aria-label={`Move ${j.title} on to ${next.label}`}
                              className="text-xs px-2 py-1.5 font-bold disabled:opacity-40" style={{ background: "var(--tws-char)", color: "#fff", border: "1px solid var(--tws-char)" }}>{next.label} →</button>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="text-xs px-1 py-2" style={muted}>{ci === 0 && !col.key ? "" : "Nothing here"}</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
