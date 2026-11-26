"use client";

// Workshop planner: parts of each build placed on a person and a run of days. Drag a part onto a
// person's day, or click a part and then a slot. Parts with no one or no date wait in "To plan".
// Clashes (two parts at once, or a part while booked on a show elsewhere in the Hub) show in red.
// Pencilled parts (tentative, while a build is being quoted) are hatched with a dashed edge; a
// clash that involves one is a possible clash, in amber. They're confirmed when the quote's accepted.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import { buildStageLabel } from "@/lib/buildStages";
import { caps, card, h2, muted, btnSolid, btnLine, input, label as lbl, pageHeader, JOB_FILLS } from "@/lib/twsUi";

type Part = { id: number; jobId: number; label: string; userId: number | null; startDate: string | null; days: number; hours: number | null; done: boolean; pencilled?: boolean; user: { id: number; name: string } | null; machines?: { machine: { id: number; name: string } }[] };
type Job = { id: number; number: string; title: string; stage: string | null; startDate: string | null; endDate: string | null; deliveryMethod: string | null; client: { name: string } | null };
export type PlannerData = {
  space: SpaceTheme; from: string; days: number; jobs: Job[]; parts: Part[];
  crew: { id: number; name: string; team: boolean }[];
  elsewhere: { userId: number; startDate: string; endDate: string; activityType: string | null; production: { id: number; name: string } }[];
  staff: { id: number; name: string }[]; canEdit: boolean;
  machines?: { id: number; name: string }[]; inducted?: Record<number, number[]>; // machine inductions (warnings, not blocks)
  unavailable?: Record<number, string>; // machine → why it shouldn't be used (out of use, check overdue)
};

const DAY = 86400e3;
const t = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`).getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dname = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const range = (ms: number, n: number) => `${dname(ms)} – ${new Date(ms + (n - 1) * DAY).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;

export default function Planner({ initial }: { initial: PlannerData }) {
  const router = useRouter();
  const [parts, setParts] = useState(initial.parts);
  const [extraRows, setExtraRows] = useState<{ id: number; name: string; team: boolean }[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [pickMachines, setPickMachines] = useState(false);
  const [weeks, setWeeks] = useState(26);
  const [drag, setDrag] = useState<number | null>(null);
  const [adding, setAdding] = useState({ jobId: initial.jobs[0]?.id ? String(initial.jobs[0].id) : "", label: "", days: "1", hours: "", pencilled: initial.jobs[0]?.stage === "quote" });
  const { space, jobs, elsewhere, canEdit } = initial;
  const base = `/spaces/${space.slug}`;
  const from = t(initial.from), N = initial.days;
  const days = Array.from({ length: N }, (_, i) => from + i * DAY);
  const today = t(new Date().toISOString());
  // Machine inductions: machines a planned part needs that its person isn't inducted on
  const gaps = (p: Part) => (p.userId ? (p.machines ?? []).filter(m => !(initial.inducted?.[p.userId!] ?? []).includes(m.machine.id)).map(m => m.machine.name) : []);
  // Equipment: machines a part needs that are out of use or overdue a check
  const broken = (p: Part) => (p.machines ?? []).filter(m => initial.unavailable?.[m.machine.id]).map(m => `${m.machine.name} (${initial.unavailable![m.machine.id]})`);
  async function setMachines(p: Part, ids: number[]) {
    const res = await fetch(`/api/jobs/${p.jobId}/parts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineIds: ids }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't save the machines");
    setParts(ps => ps.map(x => (x.id === p.id ? { ...x, machines: d.machines } : x)));
  }
  const fill = (jobId: number) => JOB_FILLS[Math.max(0, jobs.findIndex(j => j.id === jobId)) % JOB_FILLS.length];
  // Pencilled: the build's colour washed out with pencil hatching and a dashed edge
  const PENCIL: React.CSSProperties = { backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.65) 0 5px, rgba(255,255,255,0.15) 5px 10px)", borderStyle: "dashed", borderWidth: 2, borderColor: "var(--tws-night)", fontStyle: "italic" };
  const look = (p: { jobId: number; pencilled?: boolean }) => ({ ...fill(p.jobId), ...(p.pencilled ? PENCIL : {}) });
  const quoting = (jobId: number) => jobs.find(j => j.id === jobId)?.stage === "quote";
  const jobName = (jobId: number) => jobs.find(j => j.id === jobId)?.title ?? "";
  const crew = useMemo(() => [...initial.crew, ...extraRows.filter(r => !initial.crew.some(c => c.id === r.id))], [initial.crew, extraRows]);

  // Clashes per person: overlapping parts, or a part during a show booking elsewhere
  const { clashIds, clashText, maybeIds, maybeText } = useMemo(() => {
    const ids = new Set<number>(), text: string[] = [], mIds = new Set<number>(), mText: string[] = [];
    for (const c of crew) {
      const mine = parts.filter(p => p.userId === c.id && p.startDate && !p.done);
      mine.forEach((a, i) => mine.slice(i + 1).forEach(b => {
        const a0 = t(a.startDate!), b0 = t(b.startDate!);
        if (a0 < b0 + b.days * DAY && b0 < a0 + a.days * DAY) {
          const msg = `${c.name} has ${a.label} and ${b.label} on ${dname(Math.max(a0, b0))}`;
          if (a.pencilled || b.pencilled) { mIds.add(a.id); mIds.add(b.id); mText.push(msg); } else { ids.add(a.id); ids.add(b.id); text.push(msg); }
        }
      }));
      for (const p of mine) for (const e of elsewhere.filter(e => e.userId === c.id)) {
        const p0 = t(p.startDate!), e0 = t(e.startDate), e1 = t(e.endDate) + DAY;
        if (p0 < e1 && e0 < p0 + p.days * DAY) {
          const msg = `${c.name} is on ${e.production.name} during ${p.label}`;
          if (p.pencilled) { mIds.add(p.id); mText.push(msg); } else { ids.add(p.id); text.push(msg); }
        }
      }
    }
    return { clashIds: ids, clashText: text, maybeIds: mIds, maybeText: mText };
  }, [parts, crew, elsewhere]);

  async function save(p: Part, patch: Partial<Pick<Part, "userId" | "startDate" | "days" | "done" | "pencilled">>) {
    const before = parts;
    setParts(ps => ps.map(x => (x.id === p.id ? { ...x, ...patch, user: patch.userId === undefined ? x.user : crew.find(c => c.id === patch.userId) ?? null } : x)));
    const res = await fetch(`/api/jobs/${p.jobId}/parts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) { setParts(before); alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't save that"); }
  }
  const place = (id: number | null, userId: number | null, day: number | null) => {
    const p = parts.find(x => x.id === id);
    setSel(null); setDrag(null);
    if (!p || !canEdit) return;
    save(p, userId === null ? { userId: null, startDate: null } : { userId, startDate: iso(day!) });
  };
  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    if (!adding.jobId) return alertDialog("Pick the build this part belongs to.");
    const res = await fetch(`/api/jobs/${adding.jobId}/parts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: adding.label, days: Number(adding.days), hours: adding.hours, pencilled: adding.pencilled }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(body.error ?? "Couldn't add the part");
    setParts(ps => [...ps, body]); setAdding(a => ({ ...a, label: "", hours: "" })); setSel(body.id);
  }
  async function remove(p: Part) {
    if (!(await confirmDialog(`Delete the part "${p.label}"?`))) return;
    const res = await fetch(`/api/jobs/${p.jobId}/parts/${p.id}`, { method: "DELETE" });
    if (res.ok) { setParts(ps => ps.filter(x => x.id !== p.id)); setSel(null); }
  }

  const tray = parts.filter(p => !p.done && (!p.userId || !p.startDate));
  const selPart = parts.find(p => p.id === sel) ?? null;
  const go = (ms: number) => router.push(`${base}/planner?from=${iso(ms)}`);
  const dragProps = (p: Part) => canEdit ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { try { e.dataTransfer.setData("text/plain", String(p.id)); e.dataTransfer.effectAllowed = "move"; } catch { /* some browsers refuse */ } setDrag(p.id); },
    onDragEnd: () => setDrag(null),
  } : {};
  const dropId = (e: React.DragEvent) => { e.preventDefault(); const v = Number(e.dataTransfer.getData("text/plain")); return v || drag || sel; };

  // Builds timeline from this fortnight's Monday, as far ahead as chosen (scrolls sideways), with a
  // capacity row: crew-days booked each week (Mon–Fri) against what the team has (team × 5)
  const W = weeks, tlDays = W * 7;
  const tl = jobs.filter(j => j.startDate || j.endDate);
  const unscheduled = jobs.filter(j => !j.startDate && !j.endDate);
  const teamSize = initial.crew.filter(c => c.team).length;
  const capacity = Array.from({ length: W }, (_, w) => {
    const w0 = from + w * 7 * DAY;
    let confirmed = 0, pencilled = 0;
    for (const p of parts) {
      if (p.done || !p.startDate) continue;
      const p0 = t(p.startDate);
      for (let d = 0; d < 5; d++) { // Mon–Fri of this week
        const day = w0 + d * DAY;
        if (day >= p0 && day < p0 + p.days * DAY) { if (p.pencilled) pencilled++; else confirmed++; }
      }
    }
    return { confirmed, pencilled, available: teamSize * 5 };
  });

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-3">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Planner</div>
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Workshop planner</h1>
            <span className="text-sm" style={muted}>{range(from, N)} · weekends shaded{canEdit ? " · drag a part onto a person and day, or click a part then click a slot" : ""}</span>
            <span className="text-[13px] flex items-center gap-2" style={muted}><span aria-hidden="true" className="inline-block w-8 h-4 box-border" style={{ ...look({ jobId: jobs[0]?.id ?? 0, pencilled: true }) }} />✎ Pencilled: held while the build is being quoted, confirmed when the quote&apos;s accepted</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => go(from - 14 * DAY)} style={btnLine} aria-label="Previous fortnight">←</button>
            <button type="button" onClick={() => go(today)} style={btnLine}>This week</button>
            <button type="button" onClick={() => go(from + 14 * DAY)} style={btnLine} aria-label="Next fortnight">→</button>
          </div>
        </div>
        {jobs.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]" aria-label="Builds">
            {jobs.map(j => <li key={j.id} className="flex gap-1.5 items-center"><span aria-hidden="true" className="w-3.5 h-3.5 inline-block box-border" style={fill(j.id)} /><Link href={`${base}/jobs/${j.id}`} className="hover:underline" style={{ color: "var(--tws-ink)" }}>{j.title}</Link></li>)}
          </ul>
        )}
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 flex flex-col gap-5">
        {clashText.length > 0 && (
          <div role="alert" className="px-4 py-3 text-sm" style={{ background: "var(--tws-bad-bg)", border: "1px solid var(--tws-bad-line)", color: "#7a2414" }}>
            <strong>Clash:</strong> {clashText.join(" · ")}
          </div>
        )}
        {parts.some(p => !p.done && broken(p).length) && (
          <div role="alert" className="px-4 py-3 text-sm" style={{ background: "var(--tws-bad-bg)", border: "1px solid var(--tws-bad-line)", color: "#7a2414" }}>
            <strong>⚠ Kit not usable:</strong> {parts.filter(p => !p.done && broken(p).length).map(p => `${p.label} needs ${broken(p).join(", ")}`).join(" · ")}. <Link href={`${base}/safety#equipment`} className="underline">Equipment</Link>
          </div>
        )}
        {parts.some(p => gaps(p).length) && (
          <div role="status" className="px-4 py-3 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
            <strong>⚠ Not inducted:</strong> {parts.filter(p => gaps(p).length).map(p => `${p.user?.name} on ${gaps(p).join(", ")} (${p.label})`).join(" · ")}. <Link href={`${base}/safety#inductions`} className="underline">Inductions</Link>
          </div>
        )}
        {maybeText.length > 0 && (
          <div role="status" className="px-4 py-3 text-sm" style={{ background: "var(--tws-warn-bg)", border: "1px solid var(--tws-warn-line)", color: "var(--tws-warn-ink)" }}>
            <strong>Possible clash (pencilled):</strong> {maybeText.join(" · ")}
          </div>
        )}

        {/* To plan */}
        <section aria-label="Parts not yet planned" className="p-4 flex flex-col gap-3" style={{ background: "var(--tws-card)", border: "2px dashed #b5ac9c" }}
          onDragOver={e => e.preventDefault()} onDrop={e => place(dropId(e), null, null)}>
          <div className="flex justify-between items-baseline gap-3 flex-wrap">
            <h2 style={{ ...h2, fontSize: 16 }}>To plan</h2>
            {selPart && canEdit && (
              <div className="flex gap-2 flex-wrap items-center text-[13px]">
                <span className="font-semibold">{selPart.label}{selPart.pencilled ? " (pencilled)" : ""}:</span>
                <button type="button" onClick={() => save(selPart, { days: Math.max(1, selPart.days - 1) })} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }} aria-label="One day shorter">− day</button>
                <span>{selPart.days}d</span>
                <button type="button" onClick={() => save(selPart, { days: selPart.days + 1 })} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }} aria-label="One day longer">+ day</button>
                <button type="button" onClick={() => save(selPart, { pencilled: !selPart.pencilled })} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }}>{selPart.pencilled ? "Confirm dates" : "Pencil in"}</button>
                {selPart.userId && <button type="button" onClick={() => place(selPart.id, null, null)} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }}>Back to To plan</button>}
                <button type="button" onClick={() => { save(selPart, { done: true }); setSel(null); }} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }}>Mark done</button>
                <button type="button" onClick={() => remove(selPart)} style={{ ...btnLine, padding: "4px 10px", fontSize: 13, color: "var(--tws-bad-ink)", borderColor: "var(--tws-bad-line)" }}>Delete</button>
                {(initial.machines?.length ?? 0) > 0 && <button type="button" aria-expanded={pickMachines} onClick={() => setPickMachines(!pickMachines)} style={{ ...btnLine, padding: "4px 10px", fontSize: 13 }}>Machines{selPart.machines?.length ? ` (${selPart.machines.length})` : ""}</button>}
                <button type="button" onClick={() => { setSel(null); setPickMachines(false); }} className="underline" style={muted}>Cancel</button>
              </div>
            )}
            {selPart && canEdit && pickMachines && (
              <fieldset className="w-full flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] p-3 m-0" style={{ border: "1px solid var(--tws-line)", background: "var(--tws-ground)" }}>
                <legend className="text-xs font-semibold px-1" style={muted}>Machines {selPart.label} needs (for induction warnings)</legend>
                {initial.machines!.map(m => {
                  const on = (selPart.machines ?? []).some(x => x.machine.id === m.id);
                  return <label key={m.id} className="flex items-center gap-1.5"><input type="checkbox" checked={on} style={{ accentColor: "var(--tws-char)" }}
                    onChange={() => setMachines(selPart, on ? (selPart.machines ?? []).filter(x => x.machine.id !== m.id).map(x => x.machine.id) : [...(selPart.machines ?? []).map(x => x.machine.id), m.id])} />{m.name}</label>;
                })}
              </fieldset>
            )}
          </div>
          <div className="flex flex-wrap gap-2 min-h-11">
            {tray.map(p => (
              <button key={p.id} type="button" {...dragProps(p)} onClick={() => canEdit && setSel(sel === p.id ? null : p.id)} aria-pressed={sel === p.id}
                className="text-[13px] font-semibold text-left min-h-11 px-3 py-1.5" style={{ ...look(p), cursor: canEdit ? "grab" : "default", outline: sel === p.id ? "3px solid var(--tws-night)" : "none" }}>
                {p.pencilled ? "✎ " : ""}{p.label} ({jobName(p.jobId)}) · {p.days}d{p.user ? ` · ${p.user.name}` : ""}
              </button>
            ))}
            {tray.length === 0 && <span className="text-[13px] self-center" style={muted}>{parts.length ? "Everything is planned." : "No parts yet. Add the parts of each build below."}</span>}
          </div>
          {canEdit && jobs.length > 0 && (
            <form onSubmit={addPart} className="grid gap-2 items-end pt-3 sm:grid-cols-[1.4fr_1.6fr_80px_90px_auto]" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
              <div><label htmlFor="np-job" style={lbl}>Build</label>
                <select id="np-job" style={input} value={adding.jobId} onChange={e => setAdding({ ...adding, jobId: e.target.value, pencilled: quoting(Number(e.target.value)) })}>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.stage === "quote" ? " (quoting)" : ""}</option>)}</select></div>
              <div><label htmlFor="np-label" style={lbl}>Part</label>
                <input id="np-label" required style={input} value={adding.label} onChange={e => setAdding({ ...adding, label: e.target.value })} placeholder="e.g. Truck frames" /></div>
              <div><label htmlFor="np-days" style={lbl}>Days</label>
                <input id="np-days" type="number" min={1} max={60} required style={input} value={adding.days} onChange={e => setAdding({ ...adding, days: e.target.value })} /></div>
              <div><label htmlFor="np-hours" style={lbl}>Hours</label>
                <input id="np-hours" type="number" min={0} step="0.5" style={input} value={adding.hours} onChange={e => setAdding({ ...adding, hours: e.target.value })} placeholder="opt." /></div>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer" title="Tentative: hold the dates while the build is being quoted">
                  <input type="checkbox" checked={adding.pencilled} onChange={e => setAdding({ ...adding, pencilled: e.target.checked })} style={{ accentColor: "var(--tws-char)" }} />Pencil in
                </label>
                <button type="submit" style={{ ...btnSolid, padding: "8px 14px" }}>Add part</button>
              </div>
            </form>
          )}
        </section>

        {/* Crew by day */}
        <section aria-label="Planner grid" className="p-4 overflow-x-auto" style={{ background: "var(--tws-card)", border: "1px solid var(--tws-line)" }}>
          <div className="flex flex-col gap-1.5" style={{ minWidth: 1100 }}>
            <div className="grid gap-1 text-xs font-bold" style={{ gridTemplateColumns: `170px repeat(${N}, minmax(0, 1fr))` }}>
              <span style={{ ...caps, letterSpacing: "0.2em", alignSelf: "center" }}>Crew</span>
              {days.map(d => {
                const wk = new Date(d).getUTCDay() % 6 === 0;
                return <span key={d} className="text-center py-1.5" style={d === today ? { background: "var(--tws-char)", color: "#fff" } : { background: wk ? "#e2d9ca" : "var(--tws-ground)" }}>{dname(d)}</span>;
              })}
            </div>
            {crew.length === 0 && <p className="text-sm py-3" style={muted}>No crew yet. Set people&apos;s company to {space.name} in Admin → Users, or add someone below.</p>}
            {crew.map(c => {
              const mine = parts.filter(p => p.userId === c.id && p.startDate && !p.done);
              const load = mine.reduce((n, p) => n + Math.max(0, Math.min(t(p.startDate!) + p.days * DAY, from + N * DAY) - Math.max(t(p.startDate!), from)) / DAY, 0);
              const away = elsewhere.filter(e => e.userId === c.id);
              // Overlapping parts go in lanes so none hides another; show bookings get a lane of their own
              const lanes: number[][] = [];
              const laneOf = new Map<number, number>();
              for (const p of [...mine].sort((a, b) => t(a.startDate!) - t(b.startDate!))) {
                const s0 = t(p.startDate!), e0 = s0 + p.days * DAY;
                let li = lanes.findIndex(l => l.every(id => { const q = mine.find(x => x.id === id)!; const q0 = t(q.startDate!); return e0 <= q0 || q0 + q.days * DAY <= s0; }));
                if (li < 0) { lanes.push([]); li = lanes.length - 1; }
                lanes[li].push(p.id); laneOf.set(p.id, li);
              }
              const L = Math.max(1, lanes.length) + (away.length ? 1 : 0);
              const laneH = L === 1 ? 52 : 30;
              return (
                <div key={c.id} className="grid gap-1 items-stretch" style={{ gridTemplateColumns: "170px minmax(0, 1fr)" }}>
                  <div className="flex flex-col justify-center px-2 py-1" style={{ background: "var(--tws-ground)" }}>
                    <strong className="text-[13px] truncate">{c.name}</strong>
                    <span className="text-[11px]" style={muted}>{load} day{load === 1 ? "" : "s"} booked{c.team ? "" : " · from PSG"}</span>
                  </div>
                  <div className="grid gap-x-1 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${L}, ${laneH}px)` }}>
                    {days.map((d, i) => {
                      const wk = new Date(d).getUTCDay() % 6 === 0;
                      return <button key={d} type="button" disabled={!canEdit} aria-label={`Plan the selected part for ${c.name}, ${dname(d)}`}
                        onClick={() => sel && place(sel, c.id, d)} onDragOver={e => e.preventDefault()} onDrop={e => place(dropId(e), c.id, d)}
                        style={{ gridRow: `1 / span ${L}`, gridColumn: i + 1, border: "1px solid var(--tws-line-soft)", background: d === today ? "#fbf8f2" : wk ? "#f1ece3" : "#fff", cursor: sel ? "copy" : "default" }} />;
                    })}
                    {away.map((e, i) => {
                      const s = Math.max(0, (t(e.startDate) - from) / DAY), en = Math.min(N, (t(e.endDate) - from) / DAY + 1);
                      if (en <= 0 || s >= N) return null;
                      return <span key={`a${i}`} title={`On ${e.production.name}`} className="text-[11px] font-semibold px-2 py-1 truncate"
                        style={{ gridRow: L, gridColumn: `${s + 1} / span ${en - s}`, zIndex: 1, pointerEvents: drag || sel ? "none" : "auto", lineHeight: "18px",
                          background: "repeating-linear-gradient(135deg, #d9d4cb 0 6px, #ece6db 6px 12px)", color: "var(--tws-ink)" }}>On {e.production.name}</span>;
                    })}
                    {mine.map(p => {
                      const s = Math.max(0, (t(p.startDate!) - from) / DAY), en = Math.min(N, (t(p.startDate!) - from) / DAY + p.days);
                      if (en <= 0 || s >= N) return null;
                      return (
                        <button key={p.id} type="button" {...dragProps(p)} onClick={() => canEdit && setSel(sel === p.id ? null : p.id)} aria-pressed={sel === p.id}
                          className="text-xs font-bold text-left px-2 py-1 overflow-hidden whitespace-nowrap text-ellipsis"
                          title={`${p.pencilled ? "Pencilled (not confirmed): " : ""}${p.label} · ${jobName(p.jobId)}${gaps(p).length ? ` · ⚠ ${p.user?.name ?? "They"} isn't inducted on ${gaps(p).join(", ")}` : ""}${broken(p).length ? ` · ⚠ ${broken(p).join(", ")}` : ""}`}
                          style={{ ...look(p), gridRow: (laneOf.get(p.id) ?? 0) + 1, gridColumn: `${s + 1} / span ${en - s}`, zIndex: 2,
                            pointerEvents: drag ? "none" : "auto", cursor: canEdit ? "grab" : "default",
                            outline: clashIds.has(p.id) ? "3px solid #b3261e" : maybeIds.has(p.id) ? "3px solid #d08a1e" : sel === p.id ? "3px solid var(--tws-night)" : "none", outlineOffset: -3 }}>
                          {gaps(p).length || broken(p).length ? <span aria-label="A machine this needs has a problem">⚠ </span> : null}{p.pencilled ? "✎ " : ""}{p.label}{L === 1 && <span className="block font-medium text-[11px] truncate">{jobName(p.jobId)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {canEdit && initial.staff.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <label htmlFor="add-crew" style={{ ...lbl, marginBottom: 0 }}>Add someone to the grid</label>
              <select id="add-crew" style={{ ...input, width: "auto" }} value="" onChange={e => { const s = initial.staff.find(x => x.id === Number(e.target.value)); if (s) setExtraRows(r => [...r, { ...s, team: false }]); }}>
                <option value="">Choose…</option>
                {initial.staff.filter(s => !crew.some(c => c.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </section>

        {/* Builds timeline */}
        <section style={card} className="flex flex-col gap-3 min-w-0" aria-label="Builds timeline">
          <div className="flex flex-wrap justify-between items-baseline gap-3">
            <h2 style={h2}>Builds &amp; capacity · next {W === 52 ? "year" : W >= 13 ? `${Math.round(W / 4.33)} months` : `${W} weeks`}</h2>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="How far ahead">
              {([[8, "8 weeks"], [13, "3 months"], [26, "6 months"], [52, "1 year"]] as const).map(([n, l]) => (
                <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)} className="text-xs font-bold px-2.5 py-1.5"
                  style={weeks === n ? { background: "var(--tws-char)", color: "#fff" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto pb-5" tabIndex={0} aria-label="Timeline (scrolls sideways)">
            <div className="grid gap-y-1 text-xs" style={{ gridTemplateColumns: `clamp(110px, 28vw, 200px) repeat(${tlDays}, 10px)`, width: "max-content" }}>
              <span className="sticky left-0 z-10" style={{ background: "var(--tws-card)" }} />
              {Array.from({ length: W }, (_, w) => {
                const d = new Date(from + w * 7 * DAY);
                const newMonth = w === 0 || d.getUTCDate() <= 7;
                return <strong key={w} className="py-1 px-1 truncate" style={{ gridColumn: `span 7`, background: w % 2 ? "var(--tws-ground)" : "var(--tws-tint-2)", borderLeft: newMonth ? "2px solid var(--tws-char)" : undefined }}>
                  {newMonth ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) + " " : ""}{d.getUTCDate()}</strong>;
              })}
              {tl.map(j => {
                const s0 = j.startDate ? t(j.startDate) : t(j.endDate!), e0 = j.endDate ? t(j.endDate) : s0;
                const s = Math.max(0, Math.round((s0 - from) / DAY)), e = Math.min(tlDays - 1, Math.round((e0 - from) / DAY));
                const visible = e >= 0 && s <= tlDays - 1;
                return (
                  <div key={j.id} className="contents">
                    <Link href={`${base}/jobs/${j.id}`} className="py-1 pr-2 truncate hover:underline font-semibold sticky left-0 z-10" style={{ color: "var(--tws-ink)", background: "var(--tws-card)" }} title={j.title}>{j.title}</Link>
                    {visible ? (
                      <>
                        {s > 0 && <span style={{ gridColumn: `span ${s}` }} />}
                        <span className="px-2 py-1 font-semibold truncate" style={{ ...look({ jobId: j.id, pencilled: j.stage === "quote" }), gridColumn: `span ${e - s + 1}` }} title={`${j.stage === "quote" ? "Pencilled while quoting · " : ""}${buildStageLabel(j.stage)}${j.endDate ? ` · out ${dname(t(j.endDate))}` : ""}`}>
                          {j.stage === "quote" ? "✎ Pencilled · " : ""}{buildStageLabel(j.stage)}{j.endDate && e0 - from < tlDays * DAY ? ` · out ${dname(e0)}` : ""}
                        </span>
                        {e < tlDays - 1 && <span style={{ gridColumn: `span ${tlDays - 1 - e}` }} />}
                      </>
                    ) : <span className="py-1" style={{ ...muted, gridColumn: `span ${tlDays}` }}>{e0 < from ? `Was due out ${dname(e0)}` : `Starts ${dname(s0)}`}</span>}
                  </div>
                );
              })}
              {tl.length === 0 && <span className="py-1 sticky left-0" style={{ ...muted, gridColumn: `span ${tlDays + 1}` }}>No builds have dates yet. Set a build&apos;s start and due-out dates on its page.</span>}

              {/* Capacity: crew-days booked per week (confirmed, then pencilled) against the team's days */}
              <span className="pt-2 pr-2 font-semibold sticky left-0 z-10 flex flex-col" style={{ background: "var(--tws-card)", borderTop: "2px solid var(--tws-char)" }}>
                Crew-days booked
                <span className="font-normal text-[11px]" style={muted}>{teamSize ? `of ${teamSize * 5} a week (${teamSize} in the team)` : "add the team in Admin → Users"}</span>
              </span>
              {capacity.map((c, w) => {
                const used = c.confirmed + c.pencilled, cap = c.available || Math.max(1, ...capacity.map(x => x.confirmed + x.pencilled));
                const over = c.available > 0 && used > c.available;
                const pct = (n: number) => `${Math.min(100, (n / cap) * 100)}%`;
                return (
                  <div key={w} className="pt-2 flex flex-col gap-1" style={{ gridColumn: "span 7", borderTop: "2px solid var(--tws-char)" }}
                    title={`w/c ${dname(from + w * 7 * DAY)}: ${c.confirmed} confirmed + ${c.pencilled} pencilled crew-days${c.available ? ` of ${c.available}` : ""}`}>
                    <div className="h-14 mx-1 flex flex-col justify-end" style={{ background: "var(--tws-ground)", outline: over ? "2px solid #b3261e" : "none" }}>
                      <div style={{ height: pct(c.pencilled), ...PENCIL, borderWidth: c.pencilled ? 1 : 0, background: "var(--tws-accent-light)" }} />
                      <div style={{ height: pct(c.confirmed), background: "var(--tws-char)" }} />
                    </div>
                    <span className="text-center tabular-nums text-[11px] font-semibold" style={{ color: over ? "#b3261e" : "var(--tws-ink)" }}>
                      {used}{c.available ? `/${c.available}` : ""}{over ? " !" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] m-0 flex flex-wrap gap-x-4 gap-y-1" style={muted}>
            <span><span aria-hidden="true" className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "var(--tws-char)" }} />Confirmed</span>
            <span><span aria-hidden="true" className="inline-block w-3 h-3 align-middle mr-1 box-border" style={{ ...PENCIL, borderWidth: 1, background: "var(--tws-accent-light)" }} />Pencilled</span>
            <span>Crew-days count Monday to Friday. Scroll sideways to look further ahead.</span>
          </p>
          {unscheduled.length > 0 && <p className="text-[13px]" style={muted}>No dates yet: {unscheduled.map((j, i) => <span key={j.id}>{i ? ", " : ""}<Link href={`${base}/jobs/${j.id}`} style={{ color: "var(--tws-accent-ink)" }}>{j.title}</Link></span>)}</p>}
        </section>

        {parts.some(p => p.done) && <p className="text-[13px]" style={muted}>{parts.filter(p => p.done).length} finished part{parts.filter(p => p.done).length === 1 ? " is" : "s are"} hidden. Untick them on the build&apos;s page.</p>}
      </div>
    </>
  );
}
