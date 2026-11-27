// Printable QR labels for pieces (27 Nov 2026): ?job=<id> for a build's pieces in store, or
// ?ids=1,2,3. One label per item (a piece ×6 gives six labels, "1 of 6"…), 8 to an A4 sheet.
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { Piece, StorageData } from "@/components/SetStorage";
import { sizeText } from "@/lib/pieceSize";
import type { SpaceTheme } from "@/lib/spaces";
import PrintButton from "./PrintButton";
import { muted, pageHeader } from "@/lib/twsUi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function LabelsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ job?: string; ids?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const jobId = sp.job && /^\d+$/.test(sp.job) ? sp.job : null;
  const data = await serverApi<StorageData & { space?: SpaceTheme }>(`/api/spaces/${slug}/storage${jobId ? `?jobId=${jobId}` : ""}`);
  if (!data?.space) notFound();
  const ids = sp.ids ? new Set(sp.ids.split(",").map(Number).filter(Boolean)) : null;
  const pieces: Piece[] = data.pieces.filter(p => !p.outAt && (!ids || ids.has(p.id)));
  const labels = pieces.flatMap(p => Array.from({ length: Math.min(p.quantity, 50) }, (_, i) => ({ p, n: i + 1 })));
  const space = data.space;
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-2 print:hidden">
        <div className="text-[13px]" style={muted}><Link href={`/spaces/${slug}`} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › <Link href={`/spaces/${slug}/storage`} style={{ color: "var(--tws-accent-ink)" }}>Storage</Link> › Labels</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>QR labels</h1>
        <span className="text-sm" style={muted}>{labels.length} label{labels.length === 1 ? "" : "s"} for {pieces.length} piece{pieces.length === 1 ? "" : "s"} in store · 8 to an A4 sheet · scanning one opens the piece</span>
        <div><PrintButton /></div>
      </header>
      <div className="px-4 sm:px-10 py-6 print:p-0">
        {labels.length === 0 ? <p className="text-sm" style={muted}>No pieces in store to label{jobId ? " for this build" : ""}.</p> : (
          <div className="tws-labels grid grid-cols-1 sm:grid-cols-2 gap-3 print:gap-0">
            {labels.map(({ p, n }) => (
              <div key={`${p.id}-${n}`} className="tws-label flex gap-3 p-3 bg-white" style={{ border: "1px solid #24272b", breakInside: "avoid" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR from our own API */}
                <img src={`/api/stored-pieces/${p.id}/qr`} alt={`QR code for ${p.name}`} className="w-28 h-28 shrink-0" />
                <div className="min-w-0 flex flex-col gap-0.5" style={{ color: "#24272b", overflowWrap: "anywhere" }}>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{space.shortName ?? space.name}</span>
                  <strong className="text-base leading-tight break-words">{p.name}</strong>
                  {p.quantity > 1 && <span className="text-sm font-bold">{n} of {p.quantity}</span>}
                  {p.job && <span className="text-xs break-words">{p.job.number} · {p.job.title}</span>}
                  {p.job?.client && <span className="text-xs">{p.job.client.name}</span>}
                  {sizeText(p) && <span className="text-xs">{sizeText(p)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
