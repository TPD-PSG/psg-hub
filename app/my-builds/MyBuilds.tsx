"use client";

// Client view: each build's progress and its drawings. The latest revision of each drawing can be
// approved one at a time or several at once, or sent back with a comment saying what to change.
import { useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { BUILD_STAGES, stageIndex } from "@/lib/buildStages";
import { fmtDate } from "@/lib/format";

type Decision = { id: number; decision: string; comment: string | null; byName: string; onBehalf: boolean; createdAt: string };
type Revision = { id: number; rev: string; status: string; note: string | null; createdAt: string; url: string; file: { name: string; mime: string }; decisions: Decision[] };
type Drawing = { id: number; number: string | null; title: string; revisions: Revision[] };
type Build = {
  id: number; number: string; title: string; stage: string | null; status: string; startDate: string | null; endDate: string | null;
  builder: { name: string; shortName: string | null; color: string | null; logoUrl: string | null } | null;
  drawings: Drawing[];
};
export type MyBuildsData = { me: { name: string; company: string }; builds: Build[] };

const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: { label: "Awaiting your sign-off", style: { backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" } },
  approved: { label: "Approved", style: { backgroundColor: "rgba(52,211,153,0.15)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.4)" } },
  changes: { label: "Changes requested", style: { backgroundColor: "rgba(248,113,113,0.12)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.4)" } },
};
const card = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
const muted = { color: "var(--psg-muted)" };

export default function MyBuilds({ initial }: { initial: MyBuildsData }) {
  const [data, setData] = useState(initial);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [changesFor, setChangesFor] = useState<number[] | null>(null); // revision ids being sent back
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Set<number>>(new Set());

  const latest = (d: Drawing) => d.revisions[0];
  const waiting = data.builds.flatMap(b => b.drawings.filter(d => latest(d)?.status === "pending"));
  const label = (d: Drawing) => `${d.number ? `${d.number} ` : ""}${d.title}`;

  async function send(revisionIds: number[], decision: "approved" | "changes", text?: string) {
    setBusy(true);
    const res = await fetch("/api/my-builds/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionIds, decision, comment: text }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't go through. Try again."); return false; }
    setData(d);
    setPicked(new Set());
    setChangesFor(null);
    setComment("");
    alertDialog(decision === "approved"
      ? `${revisionIds.length === 1 ? "Drawing" : `${revisionIds.length} drawings`} approved. PSG has been told.`
      : "Sent back with your comments. PSG has been told and will upload a new revision.");
    return true;
  }
  const toggle = (id: number) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const btn = "text-sm px-3 py-1.5 rounded font-medium disabled:opacity-50";
  const pickedList = [...picked];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Your builds</h1>
          <p className="text-sm mt-0.5" style={muted}>{data.me.company} · {waiting.length === 0 ? "nothing waiting for your sign-off" : `${waiting.length} drawing${waiting.length === 1 ? "" : "s"} waiting for your sign-off`}</p>
        </div>
      </div>

      {/* Bulk bar */}
      {pickedList.length > 0 && !changesFor && (
        <div className="sticky top-16 z-20 rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3" style={{ ...card, borderColor: "var(--psg-blue)" }} role="region" aria-label="Selected drawings">
          <span className="text-sm text-white font-medium">{pickedList.length} selected</span>
          <button disabled={busy} onClick={() => send(pickedList, "approved")} className={btn} style={{ backgroundColor: "#059669", color: "#fff" }}>Approve {pickedList.length === 1 ? "it" : `all ${pickedList.length}`}</button>
          <button disabled={busy} onClick={() => { setChangesFor(pickedList); setComment(""); }} className={`${btn} border`} style={{ borderColor: "rgba(248,113,113,0.5)", color: "#fca5a5" }}>Request changes</button>
          <button onClick={() => setPicked(new Set())} className="text-sm underline ml-auto" style={muted}>Clear</button>
        </div>
      )}

      {/* Request changes */}
      {changesFor && (
        <form onSubmit={e => { e.preventDefault(); send(changesFor, "changes", comment); }} className="sticky top-16 z-20 rounded-xl border p-4 space-y-3" style={{ ...card, borderColor: "rgba(248,113,113,0.5)" }}>
          <h2 className="text-sm font-semibold text-white">Request changes on {changesFor.length === 1 ? "this drawing" : `${changesFor.length} drawings`}</h2>
          <label htmlFor="changes-comment" className="block text-xs" style={muted}>What needs changing? PSG sees exactly this.</label>
          <textarea id="changes-comment" required autoFocus rows={3} value={comment} onChange={e => setComment(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}
            placeholder="e.g. Door needs to open stage left; arch 200mm taller" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !comment.trim()} className={btn} style={{ backgroundColor: "#dc2626", color: "#fff" }}>Send back</button>
            <button type="button" onClick={() => setChangesFor(null)} className={`${btn} border`} style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      {data.builds.length === 0 && (
        <div className="rounded-xl border p-6 text-sm" style={{ ...card, ...muted }}>No builds for {data.me.company} yet. When PSG starts one, it shows here with its drawings.</div>
      )}

      {data.builds.map(b => {
        const at = stageIndex(b.stage);
        const open = b.drawings.filter(d => latest(d) && latest(d).status !== "approved");
        const accent = b.builder?.color ?? "var(--psg-blue)";
        return (
          <section key={b.id} className="rounded-xl border overflow-hidden" style={card} aria-label={b.title}>
            <div className="h-1.5" style={{ backgroundColor: accent }} />
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-white break-words">{b.title}</h2>
                  <p className="text-xs mt-0.5" style={muted}>{[b.number, b.startDate && b.endDate ? `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}` : null, b.status === "complete" ? "Complete" : null].filter(Boolean).join(" · ")}</p>
                </div>
                {b.builder && (
                  <div className="flex items-center gap-2 text-xs shrink-0" style={muted}>
                    <span>Built by</span>
                    {b.builder.logoUrl
                      // eslint-disable-next-line @next/next/no-img-element -- served by our own API
                      ? <span className="bg-white rounded px-1.5 py-1 inline-flex"><img src={b.builder.logoUrl} alt={b.builder.name} className="h-6 w-auto max-w-[80px] object-contain" /></span>
                      : <span className="text-white font-semibold">{b.builder.shortName ?? b.builder.name}</span>}
                  </div>
                )}
              </div>

              {/* Progress */}
              {at >= 0 && (
                <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1" aria-label="Progress">
                  {BUILD_STAGES.map((s, i) => (
                    <li key={s.key} className="text-[11px] px-2 py-1.5 text-center rounded-sm" aria-current={i === at ? "step" : undefined}
                      style={i < at ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" } : i === at ? { backgroundColor: accent, color: "#111", fontWeight: 700 } : { border: "1px dashed var(--psg-card-border)", color: "var(--psg-muted)" }}>
                      {i < at ? "✓ " : ""}{s.label}
                    </li>
                  ))}
                </ol>
              )}

              {/* Drawings */}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white">Drawings</h3>
                  {open.length > 1 && (
                    <button onClick={() => setPicked(p => new Set([...p, ...open.map(d => latest(d).id)]))} className="text-xs text-blue-300 hover:underline">Pick all {open.length} not yet approved</button>
                  )}
                </div>
                {b.drawings.length === 0 ? <p className="text-sm" style={muted}>No drawings to sign off yet.</p> : (
                  <ul className="divide-y rounded-lg border" style={{ borderColor: "var(--psg-card-border)" }}>
                    {b.drawings.map(d => {
                      const r = latest(d);
                      if (!r) return null;
                      const st = STATUS[r.status] ?? STATUS.pending;
                      const last = r.decisions[0];
                      const canDecide = r.status !== "approved";
                      return (
                        <li key={d.id} className="px-3 py-3 space-y-2" style={{ borderColor: "var(--psg-card-border)" }}>
                          <div className="flex flex-wrap items-center gap-3">
                            {canDecide && (
                              <input type="checkbox" aria-label={`Select ${label(d)}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4 accent-blue-500" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white font-medium break-words">{label(d)} <span className="font-normal" style={muted}>· rev {r.rev}</span></div>
                              <div className="text-xs" style={muted}>Uploaded {fmtDate(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</div>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded font-medium shrink-0" style={st.style}>{st.label}</span>
                            <a href={r.url} target="_blank" rel="noopener" className="text-sm text-blue-300 hover:underline shrink-0">Open drawing</a>
                          </div>
                          {last && r.status !== "pending" && (
                            <p className="text-xs" style={muted}>
                              {last.decision === "approved" ? "Approved" : "Changes asked for"} by {last.byName}{last.onBehalf ? " (recorded by PSG)" : ""} · {fmtDate(last.createdAt)}
                              {last.comment ? <span className="block mt-0.5 text-white/80">“{last.comment}”</span> : null}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 items-center">
                            {canDecide && <>
                              <button disabled={busy} onClick={() => send([r.id], "approved")} className={`${btn} text-xs`} style={{ backgroundColor: "#059669", color: "#fff" }}>Approve rev {r.rev}</button>
                              {r.status !== "changes" && <button disabled={busy} onClick={() => { setChangesFor([r.id]); setComment(""); }} className={`${btn} text-xs border`} style={{ borderColor: "rgba(248,113,113,0.5)", color: "#fca5a5" }}>Request changes</button>}
                            </>}
                            {(d.revisions.length > 1 || r.decisions.length > 1) && (
                              <button onClick={() => setHistory(h => { const n = new Set(h); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} aria-expanded={history.has(d.id)} className="text-xs underline ml-auto" style={muted}>
                                {history.has(d.id) ? "Hide history" : "History"}
                              </button>
                            )}
                          </div>
                          {history.has(d.id) && (
                            <ul className="text-xs space-y-1.5 pl-3 border-l" style={{ ...muted, borderColor: "var(--psg-card-border)" }}>
                              {d.revisions.map(rv => (
                                <li key={rv.id}>
                                  <a href={rv.url} target="_blank" rel="noopener" className="text-blue-300 hover:underline">Rev {rv.rev}</a> · {fmtDate(rv.createdAt)} · {rv.status === "superseded" ? "replaced by a newer revision" : (STATUS[rv.status]?.label ?? rv.status)}
                                  {rv.decisions.map(x => <div key={x.id}>{x.decision === "approved" ? "Approved" : "Changes asked for"} by {x.byName}{x.onBehalf ? " (recorded by PSG)" : ""}, {fmtDate(x.createdAt)}{x.comment ? `: “${x.comment}”` : ""}</div>)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
