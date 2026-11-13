"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";

type MediaRef = { id: number; name: string; mime: string };
type Author = { id: number; name: string; avatarUrl?: string | null };
type Submission = { id: number; title: string; story: string; monthYear: string; author: Author; media: MediaRef[]; createdAt: string };
type Roundup = { id: number; monthYear: string; sentAt: string; submissions: Submission[] };

function fmtMonth(my: string) {
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MediaTile({ m }: { m: MediaRef }) {
  const isVideo = m.mime.startsWith("video/");
  const src = `/api/fun/media/${m.id}`;
  if (isVideo) {
    return (
      <video src={src} controls className="rounded-lg object-cover" style={{ maxHeight: 320, maxWidth: "100%" }} />
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={m.name} className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" style={{ maxHeight: 320, maxWidth: "100%" }} />
    </a>
  );
}

function SubmissionCard({ sub, canDelete, onDelete }: { sub: Submission; canDelete?: boolean; onDelete?: (id: number) => void }) {
  return (
    <div className="rounded-xl border p-5 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-start gap-3">
        <UserAvatar name={sub.author.name} avatarUrl={sub.author.avatarUrl} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{sub.author.name}</span>
            <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(sub.createdAt)}</span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">{sub.title}</h3>
        </div>
        {canDelete && onDelete && (
          <button onClick={() => onDelete(sub.id)} className="text-xs px-2 py-1 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--psg-muted)" }}>✕</button>
        )}
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--psg-muted)", whiteSpace: "pre-wrap" }}>{sub.story}</p>
      {sub.media.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {sub.media.map(m => <MediaTile key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}

export default function FunPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;

  const [pending, setPending] = useState<Submission[]>([]);
  const [roundups, setRoundups] = useState<Roundup[]>([]);
  const [openRoundups, setOpenRoundups] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await fetch("/api/fun/submissions").then(r => r.json());
    if (data.pending) setPending(data.pending);
    if (data.roundups) {
      setRoundups(data.roundups);
      // Auto-open the most recent roundup
      if (data.roundups.length > 0) setOpenRoundups(new Set([data.roundups[0].id]));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !story.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("story", story.trim());
    files.forEach(f => fd.append("media", f));
    await fetch("/api/fun/submissions", { method: "POST", body: fd });
    setTitle(""); setStory(""); setFiles([]); setShowForm(false);
    setSubmitting(false);
    await load();
  }

  async function deleteSub(id: number) {
    if (!confirm("Remove your submission?")) return;
    await fetch(`/api/fun/submissions/${id}`, { method: "DELETE" });
    await load();
  }

  async function sendRoundup() {
    if (!confirm(`Send the ${fmtMonth(currentMonthYear)} roundup to everyone? This can't be undone.`)) return;
    setSending(true);
    const res = await fetch("/api/fun/roundup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthYear: currentMonthYear }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { alert(data.error ?? "Something went wrong"); return; }
    await load();
  }

  function toggleRoundup(id: number) {
    setOpenRoundups(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const inp = "w-full rounded-lg px-3 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="text-center space-y-2 pb-2">
        <div className="text-4xl mb-2">🎭</div>
        <h1 className="text-2xl font-bold text-white">This is not a place of entertainment.</h1>
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
          Collected here each month — the moments, mishaps, and mayhem that make working at PSG exactly what it is.
          <br />Submissions are revealed in the monthly roundup.
        </p>
      </div>

      {/* ── Submit button / form ── */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)" }}
        >
          + Add something funny
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-white">Your story</h2>
            <button type="button" onClick={() => { setShowForm(false); setTitle(""); setStory(""); setFiles([]); }} style={{ color: "var(--psg-muted)" }} className="text-xl leading-none">×</button>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Headline *</label>
            <input required className={inp} style={inpStyle} placeholder="Give it a title…" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>The story *</label>
            <textarea required rows={5} className={inp} style={inpStyle} placeholder="Tell us what happened…" value={story} onChange={e => setStory(e.target.value)} />
          </div>

          {/* Media upload */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Photos / Videos (optional)</label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
              style={{ borderColor: "var(--psg-card-border)" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "var(--psg-blue)"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(59,130,246,0.06)"; }}
              onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--psg-card-border)"; (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
              onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "var(--psg-card-border)"; (e.currentTarget as HTMLElement).style.backgroundColor = ""; const dropped = Array.from(e.dataTransfer.files); setFiles(f => [...f, ...dropped]); }}
            >
              <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Drop files here or click to upload</p>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => { const sel = Array.from(e.target.files ?? []); setFiles(f => [...f, ...sel]); e.target.value = ""; }} />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                    {f.name}
                    <button type="button" onClick={() => setFiles(ff => ff.filter((_, j) => j !== i))} className="ml-1 hover:text-white">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => { setShowForm(false); setTitle(""); setStory(""); setFiles([]); }} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      )}

      {/* ── My pending submissions ── */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Your pending submissions — {fmtMonth(currentMonthYear)}</p>
          <p className="text-xs" style={{ color: "var(--psg-muted)" }}>These will appear in the {fmtMonth(currentMonthYear)} roundup.</p>
          {pending.map(sub => (
            <SubmissionCard key={sub.id} sub={sub} canDelete={sub.author.id === userId} onDelete={deleteSub} />
          ))}
        </div>
      )}

      {/* ── Admin: send roundup ── */}
      {role === "admin" && (
        <div className="rounded-xl border p-4 flex items-center justify-between gap-4" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
          <div>
            <p className="text-sm font-semibold text-white">Send {fmtMonth(currentMonthYear)} Roundup</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
              {pending.length === 0
                ? "No pending submissions to send."
                : `${pending.length} submission${pending.length === 1 ? "" : "s"} ready to send to everyone.`}
            </p>
          </div>
          <button
            onClick={sendRoundup}
            disabled={sending || pending.length === 0}
            className="px-4 py-2 rounded text-sm font-medium text-white shrink-0 transition-opacity"
            style={{ backgroundColor: pending.length === 0 ? "rgba(255,255,255,0.1)" : "#16a34a", color: pending.length === 0 ? "var(--psg-muted)" : "white", opacity: sending ? 0.7 : 1 }}
          >
            {sending ? "Sending…" : "🎉 Send Roundup"}
          </button>
        </div>
      )}

      {/* ── Past roundups ── */}
      {roundups.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Past Roundups</p>
          {roundups.map(r => (
            <div key={r.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
              <button
                onClick={() => toggleRoundup(r.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                style={{ backgroundColor: "var(--psg-card-bg)" }}
              >
                <div>
                  <span className="text-base font-bold text-white">{fmtMonth(r.monthYear)} Roundup 🎉</span>
                  <span className="ml-3 text-xs" style={{ color: "var(--psg-muted)" }}>{r.submissions.length} {r.submissions.length === 1 ? "story" : "stories"}</span>
                </div>
                <span className="text-lg" style={{ color: "var(--psg-muted)" }}>{openRoundups.has(r.id) ? "▾" : "▸"}</span>
              </button>

              {openRoundups.has(r.id) && (
                <div className="px-5 pb-5 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)" }}>
                  <div className="border-t pt-4" style={{ borderColor: "var(--psg-card-border)" }} />
                  {r.submissions.map(sub => (
                    <SubmissionCard key={sub.id} sub={sub} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {roundups.length === 0 && pending.length === 0 && (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          <p className="text-3xl mb-3">🌵</p>
          <p className="text-sm">Nothing yet — be the first to add something.</p>
        </div>
      )}
    </div>
  );
}
