"use client";

// Workshop calendar: a timeline of every live build, broken into its pieces and each piece's
// discipline stages. Drag a bar to move it, drag its right edge to make it longer or shorter, click
// it to change who, how long or its status. An undated stage: click a day on its row to start it
// there. Filter by discipline, build or person. The disciplines are the workshop's own list.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { buildStageLabel } from "@/lib/buildStages";
import { btnLine, btnSolid, caps, card, input, label as lbl, muted, pageHeader } from "@/lib/twsUi";

type Stage = { id: number; partId: number; disciplineId: number; startDate: string | null; days: number; hours: number | null; userId: number | null; status: string; fromQuote: boolean; sortOrder: number; user: { id: number; name: string } | null };
type Part = { id: number; label: string; pencilled: boolean; done: boolean; stages: Stage[] };
type Job = { id: number; number: string; title: string; stage: string | null; endDate: string | null; deliveryMethod: string | null; client: { name: string } | null; parts: Part[] };
type Discipline = { id: number; name: string; color: string | null; sortOrder: number; archived: boolean };
export type CalendarData = { space: SpaceTheme; from: string; days: number; disciplines: Discipline[]; jobs: Job[]; people: { id: number; name: string; team: boolean }[] };

const DAY = 86400e3, COL = 30, LABEL = 280;
const t = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`).getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const shortDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const STATUS: Record<string, string> = { todo: "Not started", on: "On it", done: "Done" };
/** Readable text on a bar colour */
const inkOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#1a1d21" : "#ffffff";
};

export default function WorkshopCalendar({ initial }: { initial: CalendarData }) {
  const router = useRouter();
  const { space, people } = initial;
  const base = `/spaces/${space.slug}`;
  const api = `/api/spaces/${space.slug}`;
  const [jobs, setJobs] = useState(initial.jobs);
  const [disciplines, setDisciplines] = useState(initial.disciplines);
  const [filter, setFilter] = useState({ discipline: "", job: "", person: "", hideDone: false });
  const [closed, setClosed] = useState<Set<number>>(new Set()); // builds folded away
  const [editing, setEditing] = useState<number | null>(null); // stage being changed
  const [adding, setAdding] = useState<number | null>(null); // part getting a new stage
  const [busy, setBusy] = useState(false);
  const [showDisciplines, setShowDisciplines] = useState(false);
  const from = t(initial.from), N = initial.days;
  const days = Array.from({ length: N }, (_, i) => from + i * DAY);
  const todayMs = t(new Date().toISOString());
  const disc = (id: number) => disciplines.find(d => d.id === id);
  const colour = (id: number) => disc(id)?.color ?? "#8a8f96";
  const live = disciplines.filter(d => !d.archived);
  const allStages = jobs.flatMap(j => j.parts.flatMap(p => p.stages));
  const stageById = (id: number) => allStages.find(s => s.id === id);

  const go = (q: { from?: number; weeks?: number }) => {
    const p = new URLSearchParams({ from: iso(q.from ?? from), weeks: String((q.weeks ?? N / 7)) });
    router.push(`${base}/calendar?${p}`);
  };

  // What shows, after the filters
  const visibleStage = (s: Stage) =>
    (!filter.discipline || s.disciplineId === Number(filter.discipline)) &&
    (!filter.person || s.userId === Number(filter.person)) &&
    (!filter.hideDone || s.status !== "done");
  const shown = useMemo(() => jobs
    .filter(j => !filter.job || j.id === Number(filter.job))
    .map(j => ({ ...j, parts: j.parts.map(p => ({ ...p, stages: p.stages.filter(visibleStage) })).filter(p => p.stages.length || (!filter.discipline && !filter.person)) }))
    .filter(j => j.parts.length || (!filter.discipline && !filter.person)),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleStage reads filter
  [jobs, filter]);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const putStage = (s: Stage) => setJobs(js => js.map(j => ({ ...j, parts: j.parts.map(p => (p.id === s.partId ? { ...p, stages: p.stages.some(x => x.id === s.id) ? p.stages.map(x => (x.id === s.id ? s : x)) : [...p.stages, s] } : p)) })));
  async function save(id: number, patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`${api}/stages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { await alertDialog(d?.error ?? "Couldn't save that"); return null; }
    putStage(d); return d as Stage;
  }
  async function addStage(partId: number, disciplineId: number) {
    setBusy(true);
    const res = await fetch(`${api}/stages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partId, disciplineId }) }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) return alertDialog(d?.error ?? "Couldn't add the stage");
    putStage(d); setAdding(null); setEditing(d.id);
  }
  async function removeStage(s: Stage) {
    if (!await confirmDialog(`Remove the ${disc(s.disciplineId)?.name ?? ""} stage?`)) return;
    const res = await fetch(`${api}/stages/${s.id}`, { method: "DELETE" });
    if (!res.ok) return alertDialog("Couldn't remove it");
    setJobs(js => js.map(j => ({ ...j, parts: j.parts.map(p => ({ ...p, stages: p.stages.filter(x => x.id !== s.id) })) })));
    setEditing(null);
  }

  // ── Dragging a bar (move) or its right edge (length) ──────────────────────
  const dragRef = useRef<{ id: number; mode: "move" | "size"; x0: number; start: number; days: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ id: number; start: number; days: number } | null>(null);
  function onBarDown(e: React.PointerEvent, s: Stage, mode: "move" | "size") {
    if (!s.startDate) return;
    e.preventDefault(); e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not a real pointer */ }
    dragRef.current = { id: s.id, mode, x0: e.clientX, start: t(s.startDate), days: s.days, moved: false };
  }
  function onBarMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const shift = Math.round((e.clientX - d.x0) / COL);
    if (shift) d.moved = true;
    setGhost(d.mode === "move" ? { id: d.id, start: d.start + shift * DAY, days: d.days } : { id: d.id, start: d.start, days: Math.max(1, d.days + shift) });
  }
  async function onBarUp(s: Stage) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved || !ghost) { setGhost(null); setEditing(editing === s.id ? null : s.id); return; }
    const g = ghost;
    setGhost(null);
    await save(s.id, d.mode === "move" ? { startDate: iso(g.start) } : { days: g.days });
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const barBox = (startMs: number, len: number) => {
    const a = Math.max(0, Math.round((startMs - from) / DAY)), b = Math.min(N, Math.round((startMs - from) / DAY) + len);
    return b <= a ? null : { left: a * COL, width: (b - a) * COL - 2, cutLeft: startMs < from, cutRight: (startMs - from) / DAY + len > N };
  };
  const span = (stages: Stage[]) => {
    const dated = stages.filter(s => s.startDate);
    if (!dated.length) return null;
    const a = Math.min(...dated.map(s => t(s.startDate!))), b = Math.max(...dated.map(s => t(s.startDate!) + s.days * DAY));
    return { start: a, days: Math.round((b - a) / DAY) };
  };
  const weekendShade = days.map((d, i) => { const w = new Date(d).getUTCDay(); return w === 0 || w === 6 ? i : -1; }).filter(i => i >= 0);
  const todayAt = todayMs >= from && todayMs < from + N * DAY ? Math.round((todayMs - from) / DAY) : null;

  const grid = { from, N, todayAt, weekendShade };

  const editingStage = editing != null ? stageById(editing) : null;

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Workshop calendar</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Workshop calendar</h1>
        <span className="text-sm" style={muted}>Each build, its pieces, and every piece&apos;s stages by discipline. Drag a bar to move it, drag its end to change its length, click it to change it.</span>
      </header>

      <div className="px-4 sm:px-10 py-6 flex flex-col gap-5">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1">
            <button type="button" style={{ ...btnLine, padding: "7px 12px" }} onClick={() => go({ from: from - 7 * DAY })} aria-label="A week earlier">←</button>
            <button type="button" style={{ ...btnLine, padding: "7px 12px" }} onClick={() => go({ from: todayMs })}>This week</button>
            <button type="button" style={{ ...btnLine, padding: "7px 12px" }} onClick={() => go({ from: from + 7 * DAY })} aria-label="A week later">→</button>
          </div>
          <div><label htmlFor="cal-weeks" style={lbl}>Weeks</label>
            <select id="cal-weeks" style={{ ...input, width: 90 }} value={N / 7} onChange={e => go({ weeks: Number(e.target.value) })}>{[4, 6, 8, 12, 16, 26].map(w => <option key={w} value={w}>{w}</option>)}</select></div>
          <div><label htmlFor="cal-disc" style={lbl}>Discipline</label>
            <select id="cal-disc" style={{ ...input, width: 170 }} value={filter.discipline} onChange={e => setFilter({ ...filter, discipline: e.target.value })}><option value="">All</option>{live.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label htmlFor="cal-job" style={lbl}>Build</label>
            <select id="cal-job" style={{ ...input, width: 220 }} value={filter.job} onChange={e => setFilter({ ...filter, job: e.target.value })}><option value="">All live builds</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.number} {j.title}</option>)}</select></div>
          <div><label htmlFor="cal-person" style={lbl}>Person</label>
            <select id="cal-person" style={{ ...input, width: 170 }} value={filter.person} onChange={e => setFilter({ ...filter, person: e.target.value })}><option value="">Anyone</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={filter.hideDone} onChange={e => setFilter({ ...filter, hideDone: e.target.checked })} />Hide done</label>
          <div className="ml-auto flex flex-wrap gap-2 pb-1 text-xs">
            {live.map(d => <span key={d.id} className="flex items-center gap-1.5"><span className="inline-block w-3 h-3" style={{ background: d.color ?? "#8a8f96" }} />{d.name}</span>)}
          </div>
        </div>

        {/* The timeline */}
        <div style={{ ...card, padding: 0 }} className="overflow-x-auto">
          <div style={{ width: LABEL + N * COL }}>
            {/* Day header */}
            <div className="flex sticky top-0 z-10" style={{ background: "var(--tws-card)", borderBottom: "2px solid var(--tws-char)" }}>
              <div className="shrink-0 px-3 py-2 text-xs font-bold" style={{ width: LABEL, ...caps }}>Build · piece · stage</div>
              <div className="flex">
                {days.map((d, i) => {
                  const dt = new Date(d), mon = dt.getUTCDay() === 1;
                  return (
                    <div key={i} className="text-center text-[10px] leading-tight py-1" style={{ width: COL, borderLeft: mon ? "1px solid var(--tws-char)" : undefined, fontWeight: todayAt === i ? 800 : 400, color: todayAt === i ? "var(--tws-accent-ink)" : undefined }}>
                      <div>{dt.toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</div>
                      <div>{dt.getUTCDate()}</div>
                      {(i === 0 || dt.getUTCDate() === 1) && <div className="font-bold">{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {shown.length === 0 && <p className="px-3 py-6 text-sm" style={muted}>No live builds{filter.discipline || filter.person || filter.job ? " match these filters" : ""}. Builds show here once they have pieces (from a quote&apos;s items or the build&apos;s parts).</p>}

            {shown.map(j => {
              const open = !closed.has(j.id);
              const due = j.endDate ? barBox(t(j.endDate), 1) : null;
              const jobSpan = span(j.parts.flatMap(p => p.stages));
              return (
                <div key={j.id} style={{ borderTop: "2px solid var(--tws-line)" }}>
                  {/* Build */}
                  <div className="flex items-center" style={{ background: "var(--tws-tint)" }}>
                    <div className="shrink-0 px-2 py-1.5 flex items-center gap-1.5 min-w-0" style={{ width: LABEL }}>
                      <button type="button" aria-expanded={open} aria-label={`${open ? "Fold" : "Open"} ${j.title}`} onClick={() => setClosed(c => { const n = new Set(c); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })} className="w-5 shrink-0">{open ? "▾" : "▸"}</button>
                      <Link href={`${base}/jobs/${j.id}`} className="truncate text-sm font-extrabold" style={{ color: "var(--tws-ink)" }} title={`${j.number} ${j.title}${j.client ? ` · ${j.client.name}` : ""}`}>{j.title}</Link>
                      <span className="text-[10px] shrink-0" style={muted}>{j.number}{j.stage ? ` · ${buildStageLabel(j.stage)}` : ""}</span>
                    </div>
                    <TrackRow grid={grid} h={28}>
                      {jobSpan && (() => { const b = barBox(jobSpan.start, jobSpan.days); return b && <div className="absolute" style={{ left: b.left, width: b.width, top: 11, height: 6, background: "var(--tws-char)", opacity: 0.35 }} />; })()}
                      {due && <div className="absolute flex items-center justify-center text-[10px] font-bold" title={`Due out ${shortDay(t(j.endDate!))}`} style={{ left: due.left, width: COL, top: 4, height: 20, color: "var(--tws-bad-ink)" }}>◆</div>}
                    </TrackRow>
                  </div>

                  {open && j.parts.map(p => {
                    const pSpan = span(p.stages);
                    return (
                      <div key={p.id}>
                        {/* Piece */}
                        <div className="flex items-center" style={{ borderTop: "1px solid var(--tws-line)" }}>
                          <div className="shrink-0 pl-7 pr-2 py-1 flex items-center gap-2 min-w-0" style={{ width: LABEL }}>
                            <span className="truncate text-sm font-bold" title={p.label}>{p.label}</span>
                            {p.pencilled && <span className="text-[10px] italic shrink-0" style={muted}>pencilled</span>}
                            {adding === p.id ? (
                              <select autoFocus aria-label={`Add a stage to ${p.label}`} style={{ ...input, padding: "2px 4px", fontSize: 12, width: 120 }} defaultValue=""
                                onChange={e => e.target.value && addStage(p.id, Number(e.target.value))} onBlur={() => setAdding(null)}>
                                <option value="">Discipline…</option>
                                {live.filter(d => !p.stages.some(s => s.disciplineId === d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            ) : (
                              <button type="button" disabled={busy} onClick={() => setAdding(p.id)} className="text-[11px] shrink-0 ml-auto" style={{ color: "var(--tws-accent-ink)", fontWeight: 700 }}>+ stage</button>
                            )}
                          </div>
                          <TrackRow grid={grid} h={26}>
                            {pSpan && (() => { const b = barBox(pSpan.start, pSpan.days); return b && <div className="absolute" style={{ left: b.left, width: b.width, top: 10, height: 6, background: "var(--tws-accent)", opacity: 0.5 }} />; })()}
                          </TrackRow>
                        </div>

                        {/* Stages */}
                        {p.stages.map(s => {
                          const g = ghost?.id === s.id ? ghost : null;
                          const startMs = g ? g.start : s.startDate ? t(s.startDate) : null;
                          const len = g ? g.days : s.days;
                          const b = startMs != null ? barBox(startMs, len) : null;
                          const c = colour(s.disciplineId), d = disc(s.disciplineId);
                          const done = s.status === "done";
                          return (
                            <div key={s.id} className="flex items-center" style={{ borderTop: "1px dashed var(--tws-line)" }}>
                              <div className="shrink-0 pl-12 pr-2 py-0.5 flex items-center gap-1.5 min-w-0 text-xs" style={{ width: LABEL }}>
                                <span className="inline-block w-2.5 h-2.5 shrink-0" style={{ background: c }} />
                                <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} className="truncate text-left" style={{ fontWeight: editing === s.id ? 800 : 600 }}>{d?.name ?? "Stage"}</button>
                                <span className="truncate" style={muted}>{s.user?.name ?? ""}</span>
                                {!s.startDate && <span className="ml-auto shrink-0 italic" style={muted}>click a day</span>}
                              </div>
                              <TrackRow grid={grid} h={26} onDayClick={!s.startDate ? ms => save(s.id, { startDate: iso(ms) }) : undefined}>
                                {b && startMs != null && (
                                  <div role="button" tabIndex={0} aria-label={`${d?.name}: ${shortDay(startMs)}, ${len} day${len === 1 ? "" : "s"}${s.user ? `, ${s.user.name}` : ""}, ${STATUS[s.status]}`}
                                    onPointerDown={e => onBarDown(e, s, "move")} onPointerMove={onBarMove} onPointerUp={() => onBarUp(s)}
                                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(s.id); } }}
                                    className="absolute flex items-center text-[11px] font-bold select-none touch-none overflow-hidden"
                                    title={`${d?.name} · ${shortDay(startMs)} → ${shortDay(startMs + (len - 1) * DAY)}${s.hours ? ` · ${s.hours} h` : ""}${s.user ? ` · ${s.user.name}` : ""} · ${STATUS[s.status]}`}
                                    style={{
                                      left: b.left, width: b.width, top: 3, height: 20, cursor: "grab",
                                      background: done ? `repeating-linear-gradient(135deg, ${c} 0 4px, ${c}99 4px 8px)` : c,
                                      color: inkOn(c), opacity: done ? 0.55 : s.status === "todo" ? 0.85 : 1,
                                      outline: s.status === "on" ? "2px solid var(--tws-char)" : editing === s.id ? "2px solid var(--tws-accent)" : undefined,
                                      borderRadius: 2, paddingLeft: 5,
                                    }}>
                                    <span className="truncate">{done ? "✓ " : ""}{b.width > 60 ? (s.user?.name ?? d?.name) : ""}</span>
                                    {/* Right edge: drag to change the length */}
                                    <span aria-hidden="true" onPointerDown={e => onBarDown(e, s, "size")} className="absolute right-0 top-0 bottom-0" style={{ width: 8, cursor: "ew-resize", background: "rgba(0,0,0,0.18)" }} />
                                  </div>
                                )}
                              </TrackRow>
                            </div>
                          );
                        })}
                        {p.stages.length === 0 && !filter.discipline && !filter.person && (
                          <div className="flex items-center text-xs" style={{ borderTop: "1px dashed var(--tws-line)" }}>
                            <div className="shrink-0 pl-12 pr-2 py-1 italic" style={{ width: LABEL, ...muted }}>No stages yet: + stage</div>
                            <TrackRow grid={grid} h={22} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {open && j.parts.length === 0 && (
                    <div className="flex items-center text-xs" style={{ borderTop: "1px solid var(--tws-line)" }}>
                      <div className="shrink-0 pl-7 pr-2 py-1.5 italic" style={{ width: LABEL, ...muted }}>No pieces yet: add items to its quote, or parts on the build</div>
                      <TrackRow grid={grid} h={24} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Change a stage */}
        {editingStage && (() => {
          const s = editingStage;
          const job = jobs.find(j => j.parts.some(p => p.id === s.partId))!;
          const part = job.parts.find(p => p.id === s.partId)!;
          return (
            <section style={{ ...card, position: "sticky", bottom: 12, zIndex: 20, boxShadow: "0 6px 24px rgba(0,0,0,0.18)" }} aria-label="Change this stage">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="m-0 text-base font-extrabold">{disc(s.disciplineId)?.name} · {part.label} <span className="font-normal text-sm" style={muted}>· {job.number} {job.title}</span></h2>
                <button type="button" onClick={() => setEditing(null)} className="text-sm" style={muted}>Close</button>
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-6 items-end">
                <div><label htmlFor="st-disc" style={lbl}>Discipline</label>
                  <select id="st-disc" style={input} value={s.disciplineId} onChange={e => save(s.id, { disciplineId: Number(e.target.value) })}>{disciplines.filter(d => !d.archived || d.id === s.disciplineId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label htmlFor="st-start" style={lbl}>Starts</label>
                  <input id="st-start" type="date" style={input} value={s.startDate?.slice(0, 10) ?? ""} onChange={e => save(s.id, { startDate: e.target.value || null })} /></div>
                <div><label htmlFor="st-days" style={lbl}>Days</label>
                  <input id="st-days" type="number" min={1} max={365} style={input} defaultValue={s.days} key={`d${s.id}-${s.days}`} onBlur={e => Number(e.target.value) !== s.days && save(s.id, { days: Number(e.target.value) })} /></div>
                <div><label htmlFor="st-hours" style={lbl}>Hours{s.fromQuote ? " (quoted)" : ""}</label>
                  <input id="st-hours" type="number" min={0} step="any" style={input} defaultValue={s.hours ?? ""} key={`h${s.id}-${s.hours}`} onBlur={e => String(s.hours ?? "") !== e.target.value && save(s.id, { hours: e.target.value })} /></div>
                <div><label htmlFor="st-who" style={lbl}>Who</label>
                  <select id="st-who" style={input} value={s.userId ?? ""} onChange={e => save(s.id, { userId: e.target.value || null })}><option value="">No one yet</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}{p.team ? "" : " (PSG)"}</option>)}</select></div>
                <div><label htmlFor="st-status" style={lbl}>Status</label>
                  <select id="st-status" style={input} value={s.status} onChange={e => save(s.id, { status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 items-center text-sm">
                {s.startDate && <span style={muted}>{shortDay(t(s.startDate))} → {shortDay(t(s.startDate) + (s.days - 1) * DAY)}</span>}
                {s.startDate && <button type="button" onClick={() => save(s.id, { startDate: null })} className="text-sm" style={{ color: "var(--tws-accent-ink)", fontWeight: 600 }}>Take off the calendar</button>}
                <button type="button" onClick={() => removeStage(s)} className="text-sm ml-auto" style={{ color: "var(--tws-bad-ink)", fontWeight: 600 }}>Remove stage</button>
              </div>
            </section>
          );
        })()}

        {/* The workshop's disciplines */}
        <section style={card}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-base font-extrabold">Disciplines</h2>
            <button type="button" style={{ ...btnLine, padding: "6px 12px" }} onClick={() => setShowDisciplines(v => !v)} aria-expanded={showDisciplines}>{showDisciplines ? "Done" : "Change the list"}</button>
          </div>
          <p className="m-0 mt-1 text-sm" style={muted}>The stages a piece can go through. A quote&apos;s labour line named after one (e.g. &ldquo;Carpentry&rdquo; or &ldquo;CNC cutting&rdquo;) becomes that stage on the item&apos;s piece.</p>
          {showDisciplines && <DisciplineEditor api={api} list={disciplines} onChange={setDisciplines} />}
        </section>
      </div>
    </>
  );
}

/** One row of the timeline: day lines, weekend shading, today's line, and whatever bars it holds.
 *  (Kept outside the page so its bars aren't rebuilt mid-drag.) */
function TrackRow({ children, onDayClick, h = 30, grid }: { children?: React.ReactNode; onDayClick?: (ms: number) => void; h?: number; grid: { from: number; N: number; todayAt: number | null; weekendShade: number[] } }) {
  const { from, N, todayAt, weekendShade } = grid;
  return (
    <div className="relative" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${COL - 1}px, var(--tws-line) ${COL - 1}px ${COL}px)`, width: N * COL, height: h }}
      onClick={onDayClick ? e => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); onDayClick(from + Math.floor((e.clientX - r.left) / COL) * DAY); } : undefined}>
      {weekendShade.map(i => <div key={i} className="absolute top-0 bottom-0" style={{ left: i * COL, width: COL, background: "rgba(0,0,0,0.035)" }} />)}
      {todayAt != null && <div className="absolute top-0 bottom-0" style={{ left: todayAt * COL + COL / 2, width: 2, background: "var(--tws-accent)" }} />}
      {children}
    </div>
  );
}

function DisciplineEditor({ api, list, onChange }: { api: string; list: Discipline[]; onChange: (l: Discipline[]) => void }) {
  const [name, setName] = useState("");
  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { await alertDialog(d?.error ?? "Couldn't save that"); return null; }
    return d;
  }
  const patch = async (d: Discipline, body: Partial<Discipline>) => { const r = await call(`${api}/disciplines/${d.id}`, "PATCH", body); if (r) onChange(list.map(x => (x.id === d.id ? { ...x, ...r } : x))); };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((x, k) => ({ ...x, sortOrder: k })));
    await Promise.all(next.map((x, k) => call(`${api}/disciplines/${x.id}`, "PATCH", { sortOrder: k })));
  };
  return (
    <div className="mt-3 flex flex-col gap-2">
      {list.map((d, i) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2" style={{ opacity: d.archived ? 0.5 : 1 }}>
          <input type="color" aria-label={`Colour for ${d.name}`} value={d.color ?? "#8a8f96"} onChange={e => patch(d, { color: e.target.value })} className="w-9 h-8" />
          <input aria-label="Discipline name" style={{ ...input, width: 220 }} defaultValue={d.name} onBlur={e => e.target.value.trim() && e.target.value.trim() !== d.name && patch(d, { name: e.target.value.trim() })} />
          <button type="button" aria-label={`Move ${d.name} up`} onClick={() => move(i, -1)} style={muted}>↑</button>
          <button type="button" aria-label={`Move ${d.name} down`} onClick={() => move(i, 1)} style={muted}>↓</button>
          <button type="button" onClick={() => patch(d, { archived: !d.archived })} className="text-sm" style={{ color: "var(--tws-accent-ink)", fontWeight: 600 }}>{d.archived ? "Bring back" : "Stop using"}</button>
        </div>
      ))}
      <form className="flex gap-2 mt-1" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; const r = await call(`${api}/disciplines`, "POST", { name }); if (r) { onChange([...list, r]); setName(""); } }}>
        <input aria-label="New discipline" style={{ ...input, width: 220 }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Upholstery" />
        <button type="submit" style={{ ...btnSolid, padding: "7px 14px" }}>Add</button>
      </form>
    </div>
  );
}
