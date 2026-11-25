"use client";

// Build of the month (TWS mockup's Fun Corner card): last month's winner, and this month's
// builds with photos to vote for. One vote each, changeable until the month ends.
import { useState } from "react";
import Link from "next/link";
import { alertDialog } from "@/components/Dialogs";

type Photo = { id: number; url: string; caption: string | null };
export type Botm = {
  month: string; monthLabel: string; voters: number; myVote: number | null;
  nominees: { job: { id: number; title: string }; photo: Photo; votes: number }[];
  winner: { monthLabel: string; job: { id: number; title: string }; votes: number; photo: Photo | null } | null;
};

const capsFont = "var(--tws-caps-font), var(--tws-font), sans-serif";

export default function BuildOfMonth({ slug, initial, compact = false, canOpenBuilds = true }: { slug: string; initial: Botm; compact?: boolean; canOpenBuilds?: boolean }) {
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const base = `/spaces/${slug}`;
  async function vote(jobId: number) {
    setBusy(true);
    const res = await fetch(`/api/spaces/${slug}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't vote");
    setB(d);
  }
  const shown = compact ? b.nominees.slice(0, 3) : b.nominees;
  const daysLeft = (() => { const [y, m] = b.month.split("-").map(Number); return Math.max(0, Math.ceil((Date.UTC(y, m, 1) - Date.now()) / 86400e3)); })();
  const title = (j: { id: number; title: string }) => canOpenBuilds ? <Link href={`${base}/jobs/${j.id}`} className="hover:underline" style={{ color: "var(--tws-ink)" }}>{j.title}</Link> : <>{j.title}</>;

  return (
    <section aria-label="Build of the month" className="flex flex-col gap-3 p-6" style={{ background: "var(--tws-accent)", color: "var(--tws-ink)" }}>
      <span style={{ fontFamily: capsFont, fontSize: 11, letterSpacing: "0.3em" }}>FUN CORNER</span>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Build of the month</h2>
      {b.winner && (
        <div className="flex flex-col gap-1.5">
          {b.winner.photo && (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks
            <img src={b.winner.photo.url} alt={`${b.winner.job.title}, build of the month`} className="w-full object-cover" style={{ height: compact ? 110 : 160, background: "var(--tws-accent-light)" }} />
          )}
          <span className="text-sm"><strong>{b.winner.monthLabel}:</strong> {title(b.winner.job)} <span className="opacity-80">({b.winner.votes} vote{b.winner.votes === 1 ? "" : "s"})</span></span>
        </div>
      )}
      <div className="flex flex-col gap-2" style={{ borderTop: b.winner ? "1px solid rgba(36,39,43,0.25)" : undefined, paddingTop: b.winner ? 10 : 0 }}>
        <span className="text-[13px] font-semibold">{b.monthLabel} · {b.nominees.length ? `vote closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "no nominees yet"}</span>
        {b.nominees.length === 0 && <span className="text-[13px]">Any build with a photo added this month is up for it. Add photos on a build&apos;s page or the noticeboard.</span>}
        {shown.map(n => {
          const mine = b.myVote === n.job.id;
          return (
            <div key={n.job.id} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
              <img src={n.photo.url} alt="" className="w-12 h-12 object-cover shrink-0" style={{ background: "var(--tws-accent-light)" }} />
              <span className="flex-1 min-w-0 text-sm font-semibold truncate">{title(n.job)}<span className="block text-xs font-normal">{n.votes} vote{n.votes === 1 ? "" : "s"}</span></span>
              <button type="button" disabled={busy || mine} onClick={() => vote(n.job.id)} aria-pressed={mine} aria-label={mine ? `Your vote: ${n.job.title}` : `Vote for ${n.job.title}`}
                className="text-xs font-bold px-2.5 py-1.5 shrink-0" style={mine ? { background: "var(--tws-char)", color: "#fff", border: "2px solid var(--tws-char)" } : { background: "transparent", color: "var(--tws-ink)", border: "2px solid var(--tws-ink)" }}>
                {mine ? "✓ Your vote" : "Vote"}
              </button>
            </div>
          );
        })}
        {compact && b.nominees.length > shown.length && <Link href={`${base}/noticeboard`} className="text-[13px] font-bold" style={{ color: "var(--tws-ink)" }}>All {b.nominees.length} nominees →</Link>}
      </div>
    </section>
  );
}
