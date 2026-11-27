"use client";

// Workshop noticeboard: post a notice, photos or a showcase; pinned posts first; build of the month.
import { useRef, useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import BuildOfMonth, { type Botm } from "@/components/BuildOfMonth";
import type { SpaceTheme } from "@/lib/spaces";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { fmtDate } from "@/lib/format";
import { caps, card, h2, muted, btnSolid, input, label as lbl, pageHeader } from "@/lib/twsUi";

type Photo = { id: number; url: string; caption: string | null };
export type Post = { id: number; kind: string; title: string | null; body: string | null; pinned: boolean; createdAt: string; author: { id: number; name: string } | null; job: { id: number; title: string } | null; photos: Photo[] };
export type BoardData = { space: SpaceTheme; posts: Post[]; botm: Botm; jobs: { id: number; title: string }[]; me: { id: number; staff: boolean; admin: boolean } };

const KINDS = [["notice", "Notice"], ["photo", "Photos"], ["showcase", "Showcase"]] as const;
const KIND_LABEL: Record<string, string> = { notice: "Notice", photo: "Build photos", showcase: "Showcase" };

export default function Noticeboard({ initial }: { initial: BoardData }) {
  const [posts, setPosts] = useState(initial.posts);
  const { space, botm, jobs, me } = initial;
  const [form, setForm] = useState({ kind: "notice" as string, title: "", body: "", jobId: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const base = `/spaces/${space.slug}`;

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    for (const f of files) fd.append("photos", await shrinkPhoto(f));
    const res = await fetch(`/api/spaces/${space.slug}/noticeboard`, { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't post that");
    setPosts(ps => [...ps.filter(p => p.pinned), d, ...ps.filter(p => !p.pinned)]);
    setForm({ kind: "notice", title: "", body: "", jobId: "" }); setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function pin(p: Post) {
    const res = await fetch(`/api/space-posts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !p.pinned }) });
    if (res.ok) setPosts(ps => { const next = ps.map(x => (x.id === p.id ? { ...x, pinned: !p.pinned } : x)); return [...next.filter(x => x.pinned), ...next.filter(x => !x.pinned)]; });
  }
  async function remove(p: Post) {
    if (!(await confirmDialog("Delete this post? Photos posted with it are deleted too; build photos stay on the build."))) return;
    const res = await fetch(`/api/space-posts/${p.id}`, { method: "DELETE" });
    if (res.ok) setPosts(ps => ps.filter(x => x.id !== p.id));
    else alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
  }

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Noticeboard</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Workshop noticeboard</h1>
        <span className="text-sm" style={muted}>Notices, build photos and finished work from the team</span>
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          <form onSubmit={post} style={card} className="flex flex-col gap-3" aria-label="New post">
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="What are you posting?">
              {KINDS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })} className="text-[13px] font-bold px-3 py-2"
                  style={form.kind === k ? { background: "var(--tws-char)", color: "var(--tws-on-char, #fff)" } : { background: "var(--tws-ground)", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>{l}</button>
              ))}
            </div>
            <div><label htmlFor="nb-title" style={lbl}>{form.kind === "showcase" ? "Where is it? (e.g. On stage at the Lyceum)" : "Title"}</label>
              <input id="nb-title" style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={form.kind === "notice" ? "e.g. Spray booth booked Thursday" : "e.g. Revolve frame welded"} /></div>
            {form.kind === "notice" && <div><label htmlFor="nb-body" style={lbl}>Notice</label>
              <textarea id="nb-body" rows={3} style={input} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Booth bookings, a safety reminder, who's in on Saturday…" /></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="nb-photos" style={lbl}>Photos{form.kind === "notice" ? " (optional)" : ""}</label>
                <input ref={fileRef} id="nb-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => setFiles([...(e.target.files ?? [])].slice(0, 8))} className="text-sm w-full" /></div>
              <div><label htmlFor="nb-job" style={lbl}>Build (optional)</label>
                <select id="nb-job" style={input} value={form.jobId} onChange={e => setForm({ ...form, jobId: e.target.value })}><option value="">—</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
            </div>
            {form.kind !== "notice" && form.jobId && <p className="text-xs" style={muted}>Photos of a build added this month put it up for build of the month.</p>}
            <div><button type="submit" disabled={busy} style={btnSolid}>{busy ? "Posting…" : "Post"}</button></div>
          </form>

          {posts.length === 0 ? <p className="text-sm" style={muted}>Nothing on the noticeboard yet.</p> : posts.map(p => (
            <article key={p.id} style={{ ...card, borderTop: p.pinned ? "6px solid var(--tws-accent)" : card.border }} className="flex flex-col gap-3">
              <div className="flex justify-between items-baseline gap-3 flex-wrap">
                <span style={{ ...caps, letterSpacing: "0.2em" }}>{p.pinned ? "Pinned · " : ""}{KIND_LABEL[p.kind] ?? "Post"}</span>
                <span className="flex gap-3 text-xs">
                  {me.staff && <button type="button" onClick={() => pin(p)} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>{p.pinned ? "Unpin" : "Pin"}</button>}
                  {(p.author?.id === me.id || me.admin) && <button type="button" onClick={() => remove(p)} className="font-semibold" style={{ color: "var(--tws-bad-ink)" }}>Delete</button>}
                </span>
              </div>
              {p.title && <h2 style={{ ...h2, fontSize: 17 }}>{p.title}</h2>}
              {p.body && <p className="text-sm whitespace-pre-wrap" style={{ margin: 0 }}>{p.body}</p>}
              {p.photos.length > 0 && (
                <div className={`grid gap-2 ${p.photos.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
                  {p.photos.map(ph => (
                    <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                      <img src={ph.url} alt={ph.caption ?? p.title ?? "Build photo"} loading="lazy" className="w-full object-cover" style={{ height: p.photos.length === 1 ? 340 : 160, background: "var(--tws-tint)" }} />
                    </a>
                  ))}
                </div>
              )}
              <span className="text-xs" style={muted}>
                {[p.author?.name, fmtDate(p.createdAt)].filter(Boolean).join(" · ")}
                {p.job && <> · <Link href={`${base}/jobs/${p.job.id}`} style={{ color: "var(--tws-accent-ink)" }}>{p.job.title}</Link></>}
              </span>
            </article>
          ))}
        </div>
        <BuildOfMonth slug={space.slug} initial={botm} canOpenBuilds={me.staff} />
      </div>
    </>
  );
}
