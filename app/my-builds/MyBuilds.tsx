"use client";

// Client view, in the builder's brand: each build's progress and its drawings. The latest revision
// of each drawing can be approved one at a time or several at once, or sent back with a comment.
import { useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import { BUILD_STAGES, stageIndex } from "@/lib/buildStages";
import { fmtDate } from "@/lib/format";
import type { SpaceTheme } from "@/lib/spaces";
import { caps, card, h2, muted, link, btnSolid, btnLine, input, label as lbl, pageHeader, stageTone } from "@/lib/twsUi";

type Decision = { id: number; decision: string; comment: string | null; byName: string; onBehalf: boolean; createdAt: string };
type Revision = { id: number; rev: string; status: string; note: string | null; createdAt: string; url: string; file: { name: string; mime: string }; decisions: Decision[] };
type Drawing = { id: number; number: string | null; title: string; revisions: Revision[] };
type Build = {
  id: number; number: string; title: string; stage: string | null; status: string; startDate: string | null; endDate: string | null;
  builder: { name: string; shortName: string | null; color: string | null; logoUrl: string | null } | null;
  drawings: Drawing[];
};
export type MyBuildsData = { me: { name: string; company: string }; builds: Build[]; brand: SpaceTheme | null };

const STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: { label: "Awaiting your sign-off", style: { background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", border: "1px solid var(--tws-warn-line)" } },
  approved: { label: "Approved", style: { background: "var(--tws-char)", color: "#fff", border: "1px solid var(--tws-char)" } },
  changes: { label: "Changes requested", style: { background: "var(--tws-bad-bg)", color: "var(--tws-bad-ink)", border: "1px solid var(--tws-bad-line)" } },
};
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 8px", whiteSpace: "nowrap" };
const small: React.CSSProperties = { ...btnSolid, padding: "7px 12px", fontSize: 13 };
const smallLine: React.CSSProperties = { ...btnLine, padding: "7px 12px", fontSize: 13 };
const badLine: React.CSSProperties = { ...smallLine, color: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-line)" };

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
  const builderName = data.brand ? data.brand.shortName ?? data.brand.name : "PSG";

  async function send(revisionIds: number[], decision: "approved" | "changes", text?: string) {
    setBusy(true);
    const res = await fetch("/api/my-builds/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionIds, decision, comment: text }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alertDialog(d.error ?? "That didn't go through. Try again."); return; }
    setData(d);
    setPicked(new Set());
    setChangesFor(null);
    setComment("");
    alertDialog(decision === "approved"
      ? `${revisionIds.length === 1 ? "Drawing" : `${revisionIds.length} drawings`} approved. ${builderName} has been told.`
      : `Sent back with your comments. ${builderName} has been told and will upload a new revision.`);
  }
  const toggle = (id: number) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedList = [...picked];
  const sticky: React.CSSProperties = { position: "sticky", top: 72, zIndex: 20 };

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-6 pb-6 flex flex-col gap-1.5">
        <span style={caps}>{data.me.company}</span>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Your builds</h1>
        <span className="text-sm" style={muted}>
          {waiting.length === 0 ? "Nothing waiting for your sign-off." : `${waiting.length} drawing${waiting.length === 1 ? "" : "s"} waiting for your sign-off. Open each one, then approve it or tell us what to change.`}
        </span>
      </header>

      <div className="px-4 sm:px-10 py-6 flex flex-col gap-6 max-w-5xl w-full">
        {/* Bulk bar */}
        {pickedList.length > 0 && !changesFor && (
          <div style={{ ...sticky, background: "var(--tws-night)", color: "#fff", borderLeft: "6px solid var(--tws-accent)" }} className="px-4 py-3 flex flex-wrap items-center gap-3" role="region" aria-label="Selected drawings">
            <span className="text-sm font-bold">{pickedList.length} selected</span>
            <button disabled={busy} onClick={() => send(pickedList, "approved")} style={{ ...small, background: "var(--tws-accent)", color: "var(--tws-ink)", borderColor: "var(--tws-accent)" }}>Approve {pickedList.length === 1 ? "it" : `all ${pickedList.length}`}</button>
            <button disabled={busy} onClick={() => { setChangesFor(pickedList); setComment(""); }} style={{ ...smallLine, color: "#fff", borderColor: "#fff" }}>Request changes</button>
            <button onClick={() => setPicked(new Set())} className="text-sm underline ml-auto" style={{ color: "var(--tws-nav-ink)" }}>Clear</button>
          </div>
        )}

        {/* Request changes */}
        {changesFor && (
          <form onSubmit={e => { e.preventDefault(); send(changesFor, "changes", comment); }} style={{ ...card, ...sticky, borderTop: "6px solid var(--tws-bad-ink)" }} className="flex flex-col gap-3">
            <h2 style={h2}>Request changes on {changesFor.length === 1 ? "this drawing" : `${changesFor.length} drawings`}</h2>
            <div>
              <label htmlFor="changes-comment" style={lbl}>What needs changing? {builderName} sees exactly this.</label>
              <textarea id="changes-comment" required autoFocus rows={3} value={comment} onChange={e => setComment(e.target.value)} style={input}
                placeholder="e.g. Door needs to open stage left; arch 200mm taller" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="submit" disabled={busy || !comment.trim()} style={{ ...small, background: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-ink)" }}>Send back</button>
              <button type="button" onClick={() => setChangesFor(null)} style={smallLine}>Cancel</button>
            </div>
          </form>
        )}

        {data.builds.length === 0 && (
          <div style={card} className="text-sm"><span style={muted}>No builds for {data.me.company} yet. When one starts, it shows here with its drawings.</span></div>
        )}

        {data.builds.map(b => {
          const at = stageIndex(b.stage);
          const open = b.drawings.filter(d => latest(d) && latest(d).status !== "approved");
          return (
            <section key={b.id} style={{ ...card, padding: 0, borderTop: "6px solid var(--tws-char)" }} aria-label={b.title}>
              <div className="p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <span style={caps}>{b.number}</span>
                    <h2 style={{ ...h2, fontSize: 22 }} className="break-words">{b.title}</h2>
                    <span className="text-[13px]" style={muted}>{[b.startDate && b.endDate ? `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}` : null, b.status === "complete" ? "Complete" : null].filter(Boolean).join(" · ") || "Dates to be confirmed"}</span>
                  </div>
                  {b.builder && data.brand && b.builder.name !== data.brand.name && (
                    <span className="text-xs" style={muted}>Built by <strong style={{ color: "var(--tws-ink)" }}>{b.builder.shortName ?? b.builder.name}</strong></span>
                  )}
                </div>

                {/* Progress */}
                {at >= 0 && (
                  <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1 m-0 p-0 list-none" aria-label="Progress">
                    {BUILD_STAGES.map((s, i) => (
                      <li key={s.key} aria-current={i === at ? "step" : undefined} className="text-[12px] px-2 py-2 text-center font-semibold"
                        style={stageTone(i < at ? "done" : i === at ? "now" : "todo")}>
                        {i < at ? "✓ " : ""}{s.label}
                      </li>
                    ))}
                  </ol>
                )}

                {/* Drawings */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 style={{ ...caps, margin: 0 }}>Drawings</h3>
                    {open.length > 1 && (
                      <button onClick={() => setPicked(p => new Set([...p, ...open.map(d => latest(d).id)]))} className="text-[13px]" style={link}>Pick all {open.length} not yet approved</button>
                    )}
                  </div>
                  {b.drawings.length === 0 ? <p className="text-sm m-0" style={muted}>No drawings to sign off yet.</p> : (
                    <ul className="flex flex-col m-0 p-0 list-none" style={{ borderTop: "2px solid var(--tws-char)" }}>
                      {b.drawings.map(d => {
                        const r = latest(d);
                        if (!r) return null;
                        const st = STATUS[r.status] ?? STATUS.pending;
                        const last = r.decisions[0];
                        const canDecide = r.status !== "approved";
                        return (
                          <li key={d.id} className="py-3.5 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--tws-line-soft)" }}>
                            <div className="flex flex-wrap items-center gap-3">
                              {canDecide && (
                                <input type="checkbox" aria-label={`Select ${label(d)}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4" style={{ accentColor: "var(--tws-char)" }} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-[15px] font-bold break-words">{label(d)} <span className="font-medium" style={muted}>· rev {r.rev}</span></div>
                                <div className="text-xs" style={muted}>Uploaded {fmtDate(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</div>
                              </div>
                              <span style={{ ...chip, ...st.style }}>{st.label}</span>
                              <a href={r.url} target="_blank" rel="noopener" className="text-[13px] shrink-0" style={link}>Open drawing ↗</a>
                            </div>
                            {last && r.status !== "pending" && (
                              <p className="text-xs m-0" style={muted}>
                                {last.decision === "approved" ? "Approved" : "Changes asked for"} by {last.byName}{last.onBehalf ? ` (recorded by ${builderName})` : ""} · {fmtDate(last.createdAt)}
                                {last.comment ? <span className="block mt-0.5" style={{ color: "var(--tws-ink)" }}>“{last.comment}”</span> : null}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 items-center">
                              {canDecide && <>
                                <button disabled={busy} onClick={() => send([r.id], "approved")} style={small}>Approve rev {r.rev}</button>
                                {r.status !== "changes" && <button disabled={busy} onClick={() => { setChangesFor([r.id]); setComment(""); }} style={badLine}>Request changes</button>}
                              </>}
                              {(d.revisions.length > 1 || r.decisions.length > 1) && (
                                <button onClick={() => setHistory(h => { const n = new Set(h); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} aria-expanded={history.has(d.id)} className="text-xs underline ml-auto" style={muted}>
                                  {history.has(d.id) ? "Hide history" : "History"}
                                </button>
                              )}
                            </div>
                            {history.has(d.id) && (
                              <ul className="text-xs flex flex-col gap-1.5 pl-3 m-0 list-none" style={{ ...muted, borderLeft: "3px solid var(--tws-tint)" }}>
                                {d.revisions.map(rv => (
                                  <li key={rv.id}>
                                    <a href={rv.url} target="_blank" rel="noopener" style={link}>Rev {rv.rev}</a> · {fmtDate(rv.createdAt)} · {rv.status === "superseded" ? "replaced by a newer revision" : (STATUS[rv.status]?.label ?? rv.status)}
                                    {rv.decisions.map(x => <div key={x.id}>{x.decision === "approved" ? "Approved" : "Changes asked for"} by {x.byName}{x.onBehalf ? ` (recorded by ${builderName})` : ""}, {fmtDate(x.createdAt)}{x.comment ? `: “${x.comment}”` : ""}</div>)}
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
    </>
  );
}
