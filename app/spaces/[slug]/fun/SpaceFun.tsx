"use client";

// Fun Corner, workshop edition: build of the month, "add something funny" (goes into the group's
// Fun Corner with this company's badge), your stories waiting for the roundup, and the roundups.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import BuildOfMonth from "@/components/BuildOfMonth";
import type { Submission, Roundup } from "@/app/fun/FunView";
import type { BoardData } from "../noticeboard/Noticeboard";
import { fmtMonthYear, fmtDay } from "@/lib/format";
import { caps, card, h2, muted, btnSolid, input, label as lbl, pageHeader } from "@/lib/twsUi";

function Media({ m }: { m: { id: number; name: string; mime: string } }) {
  const src = `/api/fun/media/${m.id}`;
  if (m.mime.startsWith("video/")) return <video src={src} controls className="w-full object-cover" style={{ maxHeight: 280, background: "var(--tws-night)" }} />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API */}
      <img src={src} alt={m.name} loading="lazy" className="w-full object-cover" style={{ maxHeight: 280, background: "var(--tws-tint)" }} />
    </a>
  );
}

function Story({ s, onDelete }: { s: Submission; onDelete?: (id: number) => void }) {
  const ours = !!s.entity;
  return (
    <article className="flex flex-col gap-2.5 p-5" style={{ ...card, padding: 20, borderTop: ours ? "6px solid var(--tws-accent)" : "1px solid var(--tws-line)" }}>
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <span className="text-[13px]"><strong>{s.author.name}</strong> <span style={muted}>· {fmtDay(s.createdAt)}</span></span>
        <span className="flex items-center gap-3">
          {ours && <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ ...caps, fontSize: 10, letterSpacing: "0.2em", background: "var(--tws-night)", color: "#fff", borderBottom: "2px solid var(--tws-accent)" }}>From {s.entity!.shortName ?? s.entity!.name}</span>}
          {onDelete && <button type="button" onClick={() => onDelete(s.id)} className="text-xs font-semibold" style={{ color: "var(--tws-bad-ink)" }}>Delete</button>}
        </span>
      </div>
      <h3 style={{ ...h2, fontSize: 17 }}>{s.title}</h3>
      {s.story && <p className="text-sm whitespace-pre-wrap" style={{ margin: 0 }}>{s.story}</p>}
      {s.media.length > 0 && <div className={`grid gap-2 ${s.media.length > 1 ? "grid-cols-2" : ""}`}>{s.media.map(m => <Media key={m.id} m={m} />)}</div>}
    </article>
  );
}

export default function SpaceFun({ board, fun }: { board: BoardData; fun: { pending: Submission[]; roundups: Roundup[] } | null }) {
  const { space, botm, me } = board;
  const base = `/spaces/${space.slug}`;
  const [pending, setPending] = useState(fun?.pending ?? []);
  const [form, setForm] = useState({ title: "", story: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const mine = pending.filter(p => p.author.id === me.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return alertDialog("Give it a title");
    setBusy(true);
    const fd = new FormData();
    fd.append("title", form.title.trim()); fd.append("story", form.story.trim()); fd.append("spaceSlug", space.slug);
    files.forEach(f => fd.append("media", f));
    const res = await fetch("/api/fun/submissions", { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't send that");
    setPending(p => [d, ...p]); setForm({ title: "", story: "" }); setFiles([]);
    alertDialog("Sent. It's revealed in this month's roundup.");
  }
  async function remove(id: number) {
    if (!(await confirmDialog("Delete this story?"))) return;
    const res = await fetch(`/api/fun/submissions/${id}`, { method: "DELETE" });
    if (res.ok) setPending(p => p.filter(x => x.id !== id));
  }

  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Fun Corner</div>
        <span style={{ ...caps, fontSize: 12, letterSpacing: "0.3em" }}>Fun Corner</span>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Not a place of entertainment</h1>
        <span className="text-sm" style={muted}>The moments, mishaps and mayhem from the workshop floor and the rest of PSG. Everything&apos;s revealed in the monthly roundup.</span>
      </header>

      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {!fun ? <p style={card} className="text-sm">Fun Corner needs the Fun Corner module. Ask an admin to tick it in Admin → Users.</p> : (
            <>
              <form onSubmit={submit} style={{ ...card, borderTop: "6px solid var(--tws-accent)" }} className="flex flex-col gap-3" aria-label="Add something funny">
                <h2 style={h2}>Add something funny</h2>
                <div><label htmlFor="fun-title" style={lbl}>Title</label>
                  <input id="fun-title" required style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. The flat that wouldn't fit through the dock door" /></div>
                <div><label htmlFor="fun-story" style={lbl}>The story</label>
                  <textarea id="fun-story" rows={3} style={input} value={form.story} onChange={e => setForm({ ...form, story: e.target.value })} /></div>
                <div><label htmlFor="fun-media" style={lbl}>Photos or videos (optional)</label>
                  <input id="fun-media" type="file" accept="image/*,video/*" multiple onChange={e => setFiles([...(e.target.files ?? [])].slice(0, 6))} className="text-sm w-full" /></div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="submit" disabled={busy} style={btnSolid}>{busy ? "Sending…" : "Send it in"}</button>
                  <span className="text-xs" style={muted}>It goes into the PSG Fun Corner with a {space.shortName ?? space.name} badge.</span>
                </div>
              </form>

              {mine.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 style={{ ...caps, fontSize: 12, letterSpacing: "0.25em" }}>Waiting for the roundup</h2>
                  {mine.map(s => <Story key={s.id} s={s} onDelete={remove} />)}
                </section>
              )}

              {fun.roundups.length === 0 ? <p className="text-sm" style={muted}>No roundups yet. The first one goes out at the end of the month.</p> : fun.roundups.map(r => (
                <section key={r.id} className="flex flex-col gap-3" aria-label={`${fmtMonthYear(r.monthYear)} roundup`}>
                  <div className="flex items-baseline gap-3 pt-2" style={{ borderTop: "6px solid var(--tws-char)" }}>
                    <h2 style={h2}>{fmtMonthYear(r.monthYear)} roundup</h2>
                    <span className="text-xs" style={muted}>{r.submissions.length} stor{r.submissions.length === 1 ? "y" : "ies"} · {r.submissions.filter(s => s.entity?.id === space.id).length} from {space.shortName ?? space.name}</span>
                  </div>
                  {r.submissions.map(s => <Story key={s.id} s={s} />)}
                </section>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <BuildOfMonth slug={space.slug} initial={botm} canOpenBuilds={me.staff} />
          <p className="text-xs" style={muted}><Link href="/fun" style={{ color: "var(--tws-accent-ink)" }}>Open the PSG Fun Corner →</Link></p>
        </div>
      </div>
    </>
  );
}
