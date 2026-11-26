"use client";

// Tablet mode (27 Nov 2026): one shared tablet in the workshop. Tap your name, then clock on to a
// build (today's planned work first), clock off, take a build photo or add a snag. Big targets,
// few words, and it goes back to the names after each action.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import type { SpaceTheme } from "@/lib/spaces";

type Job = { id: number; number: string; title: string; stage: string | null };
type Person = { id: number; name: string; on: { jobId: number; startAt: string } | null; today: { jobId: number; label: string; notInducted?: string[] }[] };
export type TabletData = { space: SpaceTheme; team: Person[]; jobs: Job[] };

const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const tile: React.CSSProperties = { minHeight: 96, padding: "16px 18px", textAlign: "left", fontWeight: 800, fontSize: 20, border: "2px solid var(--tws-char)", background: "var(--tws-card)", color: "var(--tws-ink)", cursor: "pointer" };
const big: React.CSSProperties = { minHeight: 84, padding: "18px 22px", fontWeight: 800, fontSize: 22, border: 0, cursor: "pointer" };

export default function Tablet({ initial }: { initial: TabletData }) {
  const { space } = initial;
  const [data, setData] = useState(initial);
  const [who, setWho] = useState<number | null>(null);
  const [mode, setMode] = useState<"menu" | "clock" | "photo" | "snag">("menu");
  const [jobFor, setJobFor] = useState<number | null>(null);
  const [snag, setSnag] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null); // machine inductions: a warning, not a block
  const photoRef = useRef<HTMLInputElement>(null);
  const person = data.team.find(p => p.id === who) ?? null;
  const jobName = (id: number) => data.jobs.find(j => j.id === id)?.title ?? "a build";

  // Refresh who's on every minute; back to the names after 90s idle
  useEffect(() => {
    const t = setInterval(async () => { const d = await fetch(`/api/spaces/${space.slug}/tablet`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (d?.team) setData(d); }, 60e3);
    return () => clearInterval(t);
  }, [space.slug]);
  useEffect(() => { if (who == null) return; const t = setTimeout(() => done(null), 90e3); return () => clearTimeout(t); }, [who, mode]);

  function done(msg: string | null) {
    setWho(null); setMode("menu"); setJobFor(null); setSnag("");
    if (msg) { setToast(msg); setTimeout(() => setToast(null), 4000); }
  }
  async function clock(action: "on" | "off", jobId?: number) {
    if (!person) return;
    setBusy(true);
    const res = await fetch(`/api/spaces/${space.slug}/tablet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: person.id, action, jobId }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setToast(d.error ?? "That didn't work");
    setData(d);
    const logged = d.logged?.days ? ` · ${d.logged.days} day${d.logged.days === 1 ? "" : "s"} logged on ${jobName(d.logged.jobId)}` : "";
    done(action === "on" ? `${person.name} is on ${jobName(jobId!)}${logged}` : `${person.name} clocked off${logged}`);
    if (d.notInducted?.length) {
      setWarn(`${person.name} isn't inducted on ${d.notInducted.join(", ")}, which this build needs. Don't use ${d.notInducted.length === 1 ? "it" : "them"} until a trainer has inducted you.`);
      setTimeout(() => setWarn(null), 15000);
    }
  }
  async function sendPhoto(file: File | undefined) {
    if (!file || !jobFor || !person) return;
    setBusy(true);
    const fd = new FormData(); fd.append("photos", await shrinkPhoto(file)); fd.append("caption", `${person.name}, from the tablet`);
    const res = await fetch(`/api/jobs/${jobFor}/photos`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) return setToast((await res.json().catch(() => ({}))).error ?? "Couldn't add the photo");
    done(`Photo added to ${jobName(jobFor)}`);
  }
  async function sendSnag(e: React.FormEvent) {
    e.preventDefault();
    if (!jobFor || !snag.trim() || !person) return;
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobFor}/checks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "snag", text: `${snag.trim()} (${person.name})` }) });
    setBusy(false);
    if (!res.ok) return setToast((await res.json().catch(() => ({}))).error ?? "Couldn't add the snag");
    done(`Snag added to ${jobName(jobFor)}`);
  }

  // Builds to offer: this person's planned work today first, then the rest
  const ordered = person ? [...person.today.map(t => data.jobs.find(j => j.id === t.jobId)).filter((j): j is Job => !!j), ...data.jobs].filter((j, i, a) => a.findIndex(x => x.id === j.id) === i) : data.jobs;
  const gapsOn = (jobId: number) => [...new Set(person?.today.filter(t => t.jobId === jobId).flatMap(t => t.notInducted ?? []) ?? [])];
  const planned = (jobId: number) => person?.today.filter(t => t.jobId === jobId).map(t => t.label).join(", ");

  const buildPicker = (onPick: (id: number) => void, title: string) => (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl font-extrabold m-0">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {ordered.map(j => (
          <button key={j.id} type="button" disabled={busy} onClick={() => onPick(j.id)} style={{ ...tile, ...(person?.on?.jobId === j.id ? { borderColor: "var(--tws-accent)", borderWidth: 4 } : {}) }}>
            {j.title}
            <span className="block text-sm font-semibold mt-1" style={{ color: "var(--tws-muted)" }}>{planned(j.id) ? `Planned today: ${planned(j.id)}` : j.number}</span>
            {gapsOn(j.id).length > 0 && <span className="block text-sm font-bold mt-1" style={{ color: "var(--tws-warn-ink)" }}>⚠ Not inducted on {gapsOn(j.id).join(", ")}</span>}
          </button>
        ))}
      </div>
      {ordered.length === 0 && <p className="text-lg">No live builds.</p>}
    </div>
  );

  return (
    <div className="px-4 sm:px-8 py-6 flex flex-col gap-6 select-none" style={{ minHeight: "calc(100vh - 64px)" }}>
      {warn && <div role="alert" className="text-xl font-bold px-5 py-4 flex items-start gap-3" style={{ background: "var(--tws-warn-bg)", color: "var(--tws-warn-ink)", borderLeft: "8px solid var(--tws-warn-line)" }}><span aria-hidden="true">⚠</span><span className="flex-1">{warn}</span><button type="button" onClick={() => setWarn(null)} className="text-base underline">OK</button></div>}
      {toast && <div role="status" className="text-xl font-bold px-5 py-4" style={{ background: "var(--tws-char)", color: "#fff", borderLeft: "8px solid var(--tws-accent)" }}>{toast}</div>}

      {!person ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl font-extrabold m-0">Who are you?</h1>
            <Link href={`/spaces/${space.slug}`} className="text-base font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Leave tablet mode</Link>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.team.map(p => (
              <button key={p.id} type="button" onClick={() => { setWho(p.id); setMode("menu"); }} style={{ ...tile, ...(p.on ? { background: "var(--tws-char)", color: "#fff" } : {}) }}>
                {p.name}
                <span className="block text-sm font-semibold mt-1" style={{ color: p.on ? "var(--tws-accent-light)" : "var(--tws-muted)" }}>{p.on ? `On ${jobName(p.on.jobId)} since ${hm(p.on.startAt)}` : "Not clocked on"}</span>
              </button>
            ))}
          </div>
          {data.team.length === 0 && <p className="text-lg">No one is in {space.name}&apos;s team yet. Set people&apos;s company in Admin → Users.</p>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold m-0">{person.name}</h1>
            <button type="button" onClick={() => done(null)} style={{ ...big, minHeight: 56, fontSize: 18, background: "var(--tws-tint)", color: "var(--tws-ink)" }}>← Not me / back</button>
          </div>
          {person.on && <p className="text-xl m-0">On <strong>{jobName(person.on.jobId)}</strong> since {hm(person.on.startAt)}</p>}

          {mode === "menu" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {person.on ? <>
                <button type="button" disabled={busy} onClick={() => clock("off")} style={{ ...big, background: "var(--tws-bad-ink)", color: "#fff" }}>Clock off</button>
                <button type="button" disabled={busy} onClick={() => setMode("clock")} style={{ ...big, background: "var(--tws-char)", color: "#fff" }}>Switch build</button>
              </> : (
                <button type="button" disabled={busy} onClick={() => setMode("clock")} style={{ ...big, background: "var(--tws-accent)", color: "var(--tws-ink)" }} className="sm:col-span-2">Clock on</button>
              )}
              <button type="button" onClick={() => { setMode("photo"); setJobFor(person.on?.jobId ?? null); }} style={{ ...big, background: "var(--tws-card)", color: "var(--tws-ink)", border: "2px solid var(--tws-char)" }}>Take a build photo</button>
              <button type="button" onClick={() => { setMode("snag"); setJobFor(person.on?.jobId ?? null); }} style={{ ...big, background: "var(--tws-card)", color: "var(--tws-ink)", border: "2px solid var(--tws-char)" }}>Add a snag</button>
            </div>
          )}

          {mode === "clock" && buildPicker(id => clock("on", id), person.on ? "Switch to which build?" : "Clock on to which build?")}

          {(mode === "photo" || mode === "snag") && !jobFor && buildPicker(id => setJobFor(id), "Which build?")}

          {mode === "photo" && jobFor && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-extrabold m-0">Photo for {jobName(jobFor)}</h2>
              <label style={{ ...big, background: "var(--tws-accent)", color: "var(--tws-ink)", textAlign: "center", opacity: busy ? 0.5 : 1 }}>
                {busy ? "Uploading…" : "Open the camera"}
                <input ref={photoRef} type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={e => sendPhoto(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setJobFor(null)} className="text-lg underline self-start" style={{ color: "var(--tws-muted)" }}>Different build</button>
            </div>
          )}

          {mode === "snag" && jobFor && (
            <form onSubmit={sendSnag} className="flex flex-col gap-4">
              <h2 className="text-2xl font-extrabold m-0">Snag on {jobName(jobFor)}</h2>
              <label htmlFor="tab-snag" className="sr-only">What&apos;s the snag?</label>
              <textarea id="tab-snag" autoFocus rows={3} value={snag} onChange={e => setSnag(e.target.value)} placeholder="What needs sorting?" className="text-xl p-4" style={{ border: "2px solid var(--tws-char)", background: "#fff", color: "var(--tws-ink)" }} />
              <div className="flex gap-3 flex-wrap">
                <button type="submit" disabled={busy || !snag.trim()} style={{ ...big, background: "var(--tws-accent)", color: "var(--tws-ink)", opacity: snag.trim() ? 1 : 0.5 }}>Add snag</button>
                <button type="button" onClick={() => setJobFor(null)} className="text-lg underline" style={{ color: "var(--tws-muted)" }}>Different build</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
