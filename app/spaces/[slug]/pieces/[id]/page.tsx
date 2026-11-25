// What a piece's QR label opens (27 Nov 2026): the piece, its build, where it is and has been,
// and the build's signed-off drawings, photos and FR certificates.
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import { fmtDate } from "@/lib/format";
import type { Piece } from "@/components/SetStorage";
import { sizeText } from "@/lib/pieceSize";
import type { SpaceTheme } from "@/lib/spaces";
import { caps, card, h2, muted, link, pageHeader } from "@/lib/twsUi";

type Data = {
  space: SpaceTheme; piece: Piece; staff: boolean;
  drawings: { id: number; number: string | null; title: string; rev: string | null; status: string | null; url: string | null }[];
  photos: { id: number; caption: string | null; url: string }[];
  certs: { id: number; title: string; standard: string | null; expiresAt: string | null; expired: boolean; url: string }[];
};
const WORD: Record<string, string> = { in: "Put in", move: "Moved to", out: "Went out", back: "Back in" };

export default async function PiecePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || !/^\d+$/.test(id)) notFound();
  const d = await serverApi<Data>(`/api/stored-pieces/${id}`);
  if (!d?.piece || d.space.slug !== slug) notFound();
  const { piece: p } = d;
  const base = `/spaces/${slug}`;
  const where = p.outAt ? `Gone out ${fmtDate(p.outAt)}${p.outNote ? `: ${p.outNote}` : ""}` : p.location ? p.location.name : "In the workshop, not placed yet";
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{d.space.name}</Link> › <Link href={`${base}/storage`} style={{ color: "var(--tws-accent-ink)" }}>Storage</Link> › Piece</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }} className="break-words">{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ""}</h1>
        {p.job && <span className="text-sm"><Link href={`${base}/jobs/${p.job.id}`} style={link}>{p.job.number} · {p.job.title}</Link>{p.job.client ? <span style={muted}> · {p.job.client.name}</span> : null}</span>}
      </header>
      <div className="px-4 sm:px-10 py-6 grid gap-6 lg:grid-cols-2 items-start">
        <section style={card} className="flex flex-col gap-3">
          <span style={caps}>Where it is</span>
          <div className="text-2xl font-extrabold break-words">{where}</div>
          {sizeText(p) && <div className="text-sm">{sizeText(p)}</div>}
          {p.notes && <p className="text-sm m-0" style={muted}>{p.notes}</p>}
          <h2 style={{ ...h2, fontSize: 15, marginTop: 8 }}>History</h2>
          <ol className="text-[13px] flex flex-col gap-1 m-0 pl-3 list-none" style={{ ...muted, borderLeft: "3px solid var(--tws-tint)" }}>
            {p.moves.map(mv => <li key={mv.id}>{fmtDate(mv.createdAt)} · {WORD[mv.kind] ?? mv.kind}{mv.kind === "out" ? "" : ` ${mv.location ?? "(not placed)"}`}{mv.note ? `: ${mv.note}` : ""}{mv.byName ? ` · ${mv.byName}` : ""}</li>)}
          </ol>
          {d.staff && <Link href={`${base}/storage`} className="text-[13px]" style={link}>Move it or mark it gone out in Storage →</Link>}
        </section>
        <div className="flex flex-col gap-6">
          <section style={card} className="flex flex-col gap-2">
            <h2 style={h2}>Drawings</h2>
            {d.drawings.length === 0 ? <p className="text-sm m-0" style={muted}>No drawings on this build.</p> : d.drawings.map(dr => (
              <div key={dr.id} className="text-sm flex flex-wrap gap-x-3">
                {dr.url ? <a href={dr.url} target="_blank" rel="noopener noreferrer" style={link}>{dr.number ? `${dr.number} · ` : ""}{dr.title}</a> : <span>{dr.title}</span>}
                <span style={muted}>rev {dr.rev} · {dr.status === "approved" ? "signed off" : dr.status === "changes" ? "changes asked for" : "awaiting sign-off"}</span>
              </div>
            ))}
          </section>
          <section style={card} className="flex flex-col gap-2">
            <h2 style={h2}>FR certificates</h2>
            {d.certs.length === 0 ? <p className="text-sm m-0" style={muted}>None on this build.</p> : d.certs.map(c => (
              <div key={c.id} className="text-sm flex flex-wrap gap-x-3"><a href={c.url} target="_blank" rel="noopener noreferrer" style={link}>{c.title}</a><span style={muted}>{c.standard ?? ""}{c.expired ? " · expired" : ""}</span></div>
            ))}
          </section>
          {d.photos.length > 0 && (
            <section style={card} className="flex flex-col gap-2">
              <h2 style={h2}>Build photos</h2>
              <div className="grid grid-cols-3 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                {d.photos.map(ph => <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer"><img src={ph.url} alt={ph.caption ?? "Build photo"} loading="lazy" className="w-full aspect-[4/3] object-cover" style={{ background: "var(--tws-tint)" }} /></a>)}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
