"use client";

// My work: today's and coming parts first, each opening onto what's needed to make it (materials,
// machines, drawings, design files), with the build's snags and photos alongside. Freelancers see
// only this; staff can use it too for the parts planned for them.
import { useRef, useState } from "react";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import type { SpaceTheme } from "@/lib/spaces";
import { btnLine, btnSolid, caps, card, input, muted, pageHeader } from "@/lib/twsUi";

type StageReq = { id: number; kind: string; reason: string; newStart: string | null; newDays: number | null; newEnd: string | null; status: string };
type PStage = { id: number; startDate: string | null; days: number; status: string; lateUntil: string | null; userId: number | null; discipline: { name: string; color: string | null }; user: { name: string } | null; requests: StageReq[] };
type Part = {
  id: number; jobId: number; label: string; userId: number | null; startDate: string | null; days: number; hours: number | null; done: boolean; pencilled: boolean;
  stages: PStage[];
  labourType: { name: string } | null;
  materials: { id: number; description: string; quantity: number; unit: string | null }[];
  machines: { id: number; name: string }[];
};
type Snag = { id: number; text: string; done: boolean; createdAt: string; createdBy: { name: string } | null; doneBy: { name: string } | null };
type Photo = { id: number; caption: string | null; createdAt: string; url: string; uploadedBy: { name: string } | null };
type Job = {
  id: number; number: string; title: string; stage: string | null; endDate: string | null; deliveryMethod: string | null; notes: string | null;
  forProduction: { name: string } | null;
  drawings: { id: number; number: string | null; title: string; rev: string; status: string; url: string; fileName: string }[];
  files: { id: number; kind: string; name: string; caption: string | null; url: string }[];
  checks: Snag[];
  photos: Photo[];
};
export type MyWorkPageData = { space: SpaceTheme; me: number; parts: Part[]; jobs: Job[] };

const DAY = 86_400_000;
const STAGES: Record<string, string> = { quote: "Quote", confirmation: "Confirmation", technical_design: "Technical design", build: "Build", finish: "Finish", delivery: "Delivery" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };

/** When a part is, in words: "Today", "Mon 2 Dec", "Mon 2 – Wed 4 Dec", "Not dated yet". */
function when(p: Part) {
  if (!p.startDate) { const first = startOf(p); return first ? `Stages from ${day(first)}` : "Not dated yet"; }
  const start = new Date(p.startDate).getTime(), end = start + (p.days - 1) * DAY, t = todayUtc();
  if (start <= t && t <= end) return p.days > 1 ? `Today (until ${day(new Date(end).toISOString())})` : "Today";
  return p.days > 1 ? `${day(p.startDate)} – ${day(new Date(end).toISOString())}` : day(p.startDate);
}
/** When a piece starts for this person: the part's own date, else their earliest dated stage on it. */
const startOf = (p: Part) => p.startDate ?? p.stages.filter(s => s.startDate).map(s => s.startDate!).sort()[0] ?? null;
function bucket(p: Part): "now" | "next" | "later" | "done" {
  if (p.done) return "done";
  const first = startOf(p);
  if (!first) return "later";
  const start = new Date(first).getTime(), t = todayUtc();
  if (start <= t) return "now"; // today, or started and not ticked off yet
  return start - t <= 7 * DAY ? "next" : "later";
}
const GROUPS = [
  { key: "now", title: "Today and on the go" },
  { key: "next", title: "Next 7 days" },
  { key: "later", title: "Later" },
  { key: "done", title: "Done recently" },
] as const;

export default function MyWork({ initial }: { initial: MyWorkPageData }) {
  const { space } = initial;
  const api = `/api/spaces/${space.slug}/my-work`;
  const [parts, setParts] = useState(initial.parts);
  const [jobs, setJobs] = useState(initial.jobs);
  const [open, setOpen] = useState<number | null>(() => initial.parts.find(p => bucket(p) === "now")?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [snagText, setSnagText] = useState<Record<number, string>>({});
  const [ask, setAsk] = useState<null | { stageId: number; kind: "late" | "reschedule"; newEnd: string; newStart: string; newDays: string; reason: string }>(null);
  const photoRef = useRef<Record<number, HTMLInputElement | null>>({});

  const jobOf = (id: number) => jobs.find(j => j.id === id);
  const setJob = (id: number, f: (j: Job) => Job) => setJobs(js => js.map(j => (j.id === id ? f(j) : j)));
  const say = (text: string, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 5000); };
  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { say(d?.error ?? "That didn't work. Try again.", true); return null; }
    return d;
  }

  // Running late / ask to reschedule one of their stages (the workshop managers hear about it)
  async function sendAsk(e: React.FormEvent, partId: number) {
    e.preventDefault();
    if (!ask) return;
    const d = await send(`/api/spaces/${space.slug}/stages/${ask.stageId}/requests`, "POST",
      ask.kind === "late" ? { kind: "late", newEnd: ask.newEnd, reason: ask.reason } : { kind: "reschedule", newStart: ask.newStart, newDays: Number(ask.newDays), reason: ask.reason });
    if (!d) return;
    setParts(ps => ps.map(p => (p.id === partId ? { ...p, stages: p.stages.map(st => (st.id === ask.stageId ? { ...st, requests: [d, ...st.requests], lateUntil: ask.kind === "late" ? `${ask.newEnd}T00:00:00.000Z` : st.lateUntil } : st)) } : p)));
    say(ask.kind === "late" ? "Reported: the workshop managers have been told" : "Sent: a workshop manager will approve or decline it");
    setAsk(null);
  }

  async function tickPart(p: Part) {
    const d = await send(`${api}/parts/${p.id}`, "PATCH", { done: !p.done });
    if (d) { setParts(ps => ps.map(x => (x.id === p.id ? { ...x, done: d.done } : x))); say(d.done ? `${p.label} ticked off` : `${p.label} back on your list`); }
  }
  async function addSnag(e: React.FormEvent, jobId: number) {
    e.preventDefault();
    const text = (snagText[jobId] ?? "").trim();
    if (!text) return;
    const d = await send(`${api}/jobs/${jobId}/snags`, "POST", { text });
    if (d) { setJob(jobId, j => ({ ...j, checks: [...j.checks.filter(c => !c.done), d, ...j.checks.filter(c => c.done)] })); setSnagText(s => ({ ...s, [jobId]: "" })); say("Snag added"); }
  }
  async function tickSnag(jobId: number, s: Snag) {
    const d = await send(`${api}/snags/${s.id}`, "PATCH", { done: !s.done });
    if (d) setJob(jobId, j => ({ ...j, checks: j.checks.map(c => (c.id === s.id ? d : c)) }));
  }
  async function addPhotos(jobId: number, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files).slice(0, 12)) fd.append("photos", await shrinkPhoto(f));
    const res = await fetch(`${api}/jobs/${jobId}/photos`, { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return say(d?.error ?? "Couldn't add the photo", true);
    setJob(jobId, j => ({ ...j, photos: d }));
    say(files.length === 1 ? "Photo added" : `${files.length} photos added`);
    const el = photoRef.current[jobId]; if (el) el.value = "";
  }

  const grouped = GROUPS.map(g => ({ ...g, parts: parts.filter(p => bucket(p) === g.key) })).filter(g => g.parts.length);

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <span style={caps}>{space.name}</span>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>My work</h1>
        <span className="text-sm" style={muted}>The parts you&apos;re planned on, what you need for each, and the build&apos;s snags and photos.</span>
      </header>

      <div className="px-4 sm:px-10 py-6 flex flex-col gap-8 max-w-4xl">
        {msg && <div role="status" className="text-sm font-semibold px-4 py-3" style={{ background: msg.bad ? "var(--tws-bad-bg)" : "var(--tws-char)", color: msg.bad ? "var(--tws-bad-ink)" : "#fff", borderLeft: `6px solid ${msg.bad ? "var(--tws-bad-ink)" : "var(--tws-accent)"}` }}>{msg.text}</div>}

        {parts.length === 0 && (
          <div style={card}>
            <p className="m-0 font-semibold">Nothing planned for you yet.</p>
            <p className="m-0 mt-1 text-sm" style={muted}>When the workshop plans you onto a build, your parts show here.</p>
          </div>
        )}

        {grouped.map(g => (
          <section key={g.key} className="flex flex-col gap-3" aria-labelledby={`mw-${g.key}`}>
            <h2 id={`mw-${g.key}`} style={caps} className="m-0">{g.title}</h2>
            {g.parts.map(p => {
              const j = jobOf(p.jobId);
              const isOpen = open === p.id;
              return (
                <article key={p.id} style={{ ...card, padding: 0, opacity: p.done ? 0.75 : 1 }}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen} className="w-full text-left px-5 py-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--tws-ink)" }}>
                    <span className="min-w-0">
                      <span className="block text-lg font-extrabold" style={p.done ? { textDecoration: "line-through" } : undefined}>{p.label}</span>
                      <span className="block text-sm" style={muted}>{j ? `${j.title} · ${j.number}` : ""}{j?.forProduction ? ` · for ${j.forProduction.name}` : ""}</span>
                    </span>
                    <span className="text-sm font-semibold shrink-0">
                      {when(p)}{p.hours ? ` · ${p.hours} h` : ""}{p.pencilled ? " · pencilled" : ""} <span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
                    </span>
                  </button>

                  {isOpen && j && (
                    <div className="px-5 pb-5 flex flex-col gap-5" style={{ borderTop: "1px solid var(--tws-line)" }}>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 pt-4 text-sm">
                        {p.labourType && <span><strong>Work:</strong> {p.labourType.name}</span>}
                        {j.stage && <span><strong>Build stage:</strong> {STAGES[j.stage] ?? j.stage}</span>}
                        {j.endDate && <span><strong>Due out:</strong> {day(j.endDate)}{j.deliveryMethod ? ` (${j.deliveryMethod})` : ""}</span>}
                      </div>
                      {j.notes && <p className="m-0 text-sm whitespace-pre-wrap" style={muted}>{j.notes}</p>}

                      {p.stages.length > 0 && (
                        <div>
                          <h3 className="m-0 mb-2 text-sm font-bold">Stages</h3>
                          <ul className="m-0 p-0 list-none flex flex-col gap-2">
                            {p.stages.map(st => {
                              const mine = st.userId === initial.me || (st.userId == null && p.userId === initial.me);
                              const end = st.startDate ? new Date(new Date(st.startDate).getTime() + (st.days - 1) * DAY).toISOString() : null;
                              const waiting = st.requests.find(r => r.status === "open");
                              return (
                                <li key={st.id} className="text-sm">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="inline-block w-2.5 h-2.5" style={{ background: st.discipline.color ?? "#8a8f96" }} />
                                    <strong>{st.discipline.name}</strong>
                                    <span style={muted}>{st.startDate ? (st.days > 1 ? `${day(st.startDate)} – ${day(end!)}` : day(st.startDate)) : "not dated yet"}{st.user ? ` · ${st.user.name}` : ""}{st.status === "done" ? " · done" : st.status === "on" ? " · on it" : ""}</span>
                                    {st.lateUntil && st.status !== "done" && <span className="font-bold" style={{ color: "var(--tws-bad-ink)" }}>running late, now {day(st.lateUntil)}</span>}
                                    {waiting && <span className="font-bold" style={{ color: "var(--tws-warn-ink)" }}>reschedule asked ({day(waiting.newStart!)}, {waiting.newDays} day{waiting.newDays === 1 ? "" : "s"})</span>}
                                    {mine && st.status !== "done" && ask?.stageId !== st.id && <>
                                      <button type="button" onClick={() => setAsk({ stageId: st.id, kind: "late", newEnd: (end ?? new Date().toISOString()).slice(0, 10), newStart: "", newDays: "", reason: "" })} className="text-xs underline" style={{ color: "var(--tws-accent-ink)" }}>Running late</button>
                                      {!waiting && <button type="button" onClick={() => setAsk({ stageId: st.id, kind: "reschedule", newEnd: "", newStart: (st.startDate ?? new Date().toISOString()).slice(0, 10), newDays: String(st.days), reason: "" })} className="text-xs underline" style={{ color: "var(--tws-accent-ink)" }}>Ask to reschedule</button>}
                                    </>}
                                  </div>
                                  {ask?.stageId === st.id && (
                                    <form onSubmit={e => sendAsk(e, p.id)} className="mt-2 grid gap-2 grid-cols-2 sm:grid-cols-[auto_auto_1fr_auto] items-end">
                                      {ask.kind === "late" ? (
                                        <div><label className="block text-xs mb-1" htmlFor={`a-end-${st.id}`} style={muted}>Now finishing</label><input id={`a-end-${st.id}`} type="date" required style={input} value={ask.newEnd} onChange={e => setAsk({ ...ask, newEnd: e.target.value })} /></div>
                                      ) : <>
                                        <div><label className="block text-xs mb-1" htmlFor={`a-start-${st.id}`} style={muted}>New start</label><input id={`a-start-${st.id}`} type="date" required style={input} value={ask.newStart} onChange={e => setAsk({ ...ask, newStart: e.target.value })} /></div>
                                        <div><label className="block text-xs mb-1" htmlFor={`a-days-${st.id}`} style={muted}>Days</label><input id={`a-days-${st.id}`} type="number" min={1} required style={{ ...input, width: 80 }} value={ask.newDays} onChange={e => setAsk({ ...ask, newDays: e.target.value })} /></div>
                                      </>}
                                      <div className={ask.kind === "late" ? "sm:col-span-2" : ""}><label className="block text-xs mb-1" htmlFor={`a-why-${st.id}`} style={muted}>Why</label><input id={`a-why-${st.id}`} required style={input} maxLength={500} value={ask.reason} onChange={e => setAsk({ ...ask, reason: e.target.value })} /></div>
                                      <div className="flex gap-2"><button type="submit" disabled={busy || !ask.reason.trim()} style={{ ...btnSolid, padding: "8px 14px" }}>{ask.kind === "late" ? "Report it" : "Send"}</button><button type="button" onClick={() => setAsk(null)} className="text-sm" style={muted}>Cancel</button></div>
                                    </form>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="min-w-0">
                          <h3 className="m-0 mb-2 text-sm font-bold">Materials for this part</h3>
                          {p.materials.length ? (
                            <ul className="m-0 pl-4 text-sm flex flex-col gap-0.5">{p.materials.map(m => <li key={m.id}>{m.quantity} {m.unit ?? ""} {m.description}</li>)}</ul>
                          ) : <p className="m-0 text-sm" style={muted}>None listed.</p>}
                          {p.machines.length > 0 && <p className="m-0 mt-2 text-sm"><strong>Machines:</strong> {p.machines.map(m => m.name).join(", ")}</p>}
                        </div>
                        <div className="min-w-0">
                          <h3 className="m-0 mb-2 text-sm font-bold">Drawings and design</h3>
                          {j.drawings.length + j.files.length === 0 && <p className="m-0 text-sm" style={muted}>No drawings on this build yet.</p>}
                          <ul className="m-0 p-0 list-none text-sm flex flex-col gap-1">
                            {j.drawings.map(d => (
                              <li key={`d${d.id}`}>
                                <a href={d.url} target="_blank" rel="noopener" style={{ color: "var(--tws-accent-ink)", fontWeight: 600 }}>{d.number ? `${d.number} ` : ""}{d.title} · rev {d.rev}</a>
                                {d.status !== "approved" && <span className="ml-2 text-xs font-bold" style={{ color: "var(--tws-warn-ink)" }}>{d.status === "changes" ? "Changes asked for" : "Not signed off yet"}</span>}
                              </li>
                            ))}
                            {j.files.map(f => (
                              <li key={`f${f.id}`}><a href={f.url} target="_blank" rel="noopener" style={{ color: "var(--tws-accent-ink)", fontWeight: 600 }}>{f.caption || f.name}</a> <span className="text-xs" style={muted}>{f.kind === "modelbox" ? "model box" : "design"}</span></li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <h3 className="m-0 mb-2 text-sm font-bold">Snags on this build</h3>
                        {j.checks.length > 0 && (
                          <ul className="m-0 p-0 list-none flex flex-col gap-1.5 mb-3">
                            {j.checks.map(s => (
                              <li key={s.id} className="flex items-start gap-2.5 text-sm">
                                <input type="checkbox" checked={s.done} disabled={busy} onChange={() => tickSnag(j.id, s)} aria-label={`${s.done ? "Fixed" : "Not fixed"}: ${s.text}`} className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: "var(--tws-char)" }} />
                                <span className="min-w-0">
                                  <span style={s.done ? { textDecoration: "line-through", color: "var(--tws-muted)" } : undefined}>{s.text}</span>
                                  <span className="block text-xs" style={muted}>{s.createdBy ? `Raised by ${s.createdBy.name}` : ""}{s.done && s.doneBy ? `${s.createdBy ? " · " : ""}fixed by ${s.doneBy.name}` : ""}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <form onSubmit={e => addSnag(e, j.id)} className="flex gap-2">
                          <label className="sr-only" htmlFor={`snag-${p.id}`}>New snag</label>
                          <input id={`snag-${p.id}`} style={input} value={snagText[j.id] ?? ""} onChange={e => setSnagText(s => ({ ...s, [j.id]: e.target.value }))} placeholder="e.g. Hinge on door flat B is loose" maxLength={300} />
                          <button type="submit" disabled={busy || !(snagText[j.id] ?? "").trim()} style={{ ...btnLine, padding: "8px 14px", whiteSpace: "nowrap" }}>Add snag</button>
                        </form>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <h3 className="m-0 text-sm font-bold">Build photos</h3>
                          <label style={{ ...btnLine, padding: "8px 14px", opacity: busy ? 0.6 : 1 }}>
                            + Add photos
                            <input ref={el => { photoRef.current[j.id] = el; }} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" disabled={busy} onChange={e => addPhotos(j.id, e.target.files)} />
                          </label>
                        </div>
                        {j.photos.length ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {j.photos.map(ph => (
                              <a key={ph.id} href={ph.url} target="_blank" rel="noopener" title={[ph.caption, ph.uploadedBy?.name].filter(Boolean).join(" · ")}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ph.url} alt={ph.caption ?? `Build photo on ${j.title}`} loading="lazy" className="w-full aspect-square object-cover" style={{ border: "1px solid var(--tws-line)" }} />
                              </a>
                            ))}
                          </div>
                        ) : <p className="m-0 text-sm" style={muted}>No photos yet.</p>}
                      </div>

                      {p.userId === initial.me && <div>
                        <button type="button" disabled={busy} onClick={() => tickPart(p)} style={p.done ? btnLine : btnSolid}>{p.done ? "Not done after all" : `Mark ${p.label} done`}</button>
                      </div>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
