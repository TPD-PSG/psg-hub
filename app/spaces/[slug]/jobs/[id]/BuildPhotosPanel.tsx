// "Build photos" card: photo grid (share to board, show the client, delete) and the upload control.
import { useState } from "react";
import Link from "next/link";
import { alertDialog, confirmDialog } from "@/components/Dialogs";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { card, h2, muted, link, input, label as lbl } from "@/lib/twsUi";
import type { JobPhoto, Me } from "./spaceJobTypes";

export default function BuildPhotosPanel({ jobId, job, base, me, initialPhotos }: { jobId: number; job: JobDetail; base: string; me: Me; initialPhotos: JobPhoto[] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  async function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of [...list].slice(0, 12)) fd.append("photos", await shrinkPhoto(f));
    if (photoCaption.trim()) fd.append("caption", photoCaption.trim());
    const res = await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body: fd });
    setUploading(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alertDialog(d.error ?? "Couldn't add the photos");
    setPhotos(d); setPhotoCaption("");
  }
  async function sharePhoto(p: JobPhoto) {
    const res = await fetch(`/api/space-photos/${p.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't share it");
    setPhotos(ps => ps.map(x => (x.id === p.id ? { ...x, postId: -1 } : x)));
  }
  async function showClient(p: JobPhoto) {
    const res = await fetch(`/api/space-photos/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientVisible: !p.clientVisible }) });
    if (!res.ok) return alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't change that");
    setPhotos(ps => ps.map(x => (x.id === p.id ? { ...x, clientVisible: !p.clientVisible } : x)));
  }
  async function deletePhoto(p: JobPhoto) {
    if (!(await confirmDialog("Delete this photo?"))) return;
    const res = await fetch(`/api/space-photos/${p.id}`, { method: "DELETE" });
    if (res.ok) setPhotos(ps => ps.filter(x => x.id !== p.id));
    else alertDialog((await res.json().catch(() => ({}))).error ?? "Couldn't delete it");
  }

  return (
    <section style={card} className="flex flex-col gap-2.5" aria-label="Build photos">
      <h2 style={h2}>Build photos</h2>
      {job.client && <p className="text-xs m-0" style={muted}>Tick &ldquo;Client&rdquo; on a photo for {job.client.name} to see it in their progress photos.</p>}
      {photos.length === 0 ? <p className="text-sm" style={muted}>No photos yet. Photos added this month put the build up for build of the month.</p> : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map(p => (
            <figure key={p.id} className="flex flex-col gap-1 group" style={{ margin: 0 }}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks */}
                <img src={p.url} alt={p.caption ?? `${job.title} build photo`} loading="lazy" className="w-full h-24 object-cover" style={{ background: "var(--tws-tint)" }} />
              </a>
              <figcaption className="text-[11px] flex flex-wrap justify-between gap-x-2 gap-y-0.5" style={muted}>
                <span className="truncate min-w-0 basis-full">{p.caption ?? p.uploadedBy?.name ?? ""}</span>
                <span className="flex gap-2 shrink-0">
                  {job.client && (
                    <label className="flex items-center gap-1 cursor-pointer" title={`Show ${job.client.name} this photo`} style={p.clientVisible ? { color: "var(--tws-ink)", fontWeight: 700 } : undefined}>
                      <input type="checkbox" checked={!!p.clientVisible} onChange={() => showClient(p)} style={{ accentColor: "var(--tws-char)" }} />Client
                    </label>
                  )}
                  {p.postId ? <span>On board</span> : <button type="button" onClick={() => sharePhoto(p)} className="font-semibold" style={{ color: "var(--tws-accent-ink)" }}>Share</button>}
                  {(p.uploadedById === me.id || me.isAdmin) && <button type="button" onClick={() => deletePhoto(p)} aria-label="Delete photo" style={{ color: "var(--tws-bad-ink)" }}>✕</button>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--tws-line-soft)" }}>
        <div><label htmlFor="ph-cap" style={lbl}>Caption (optional)</label><input id="ph-cap" style={input} value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="e.g. Truck frames welded" /></div>
        <label className="text-center cursor-pointer text-sm font-bold py-2.5" style={{ border: "2px solid var(--tws-char)", opacity: uploading ? 0.5 : 1 }}>
          {uploading ? "Uploading…" : "+ Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} />
        </label>
        <Link href={`${base}/noticeboard`} className="text-[13px] font-semibold" style={link}>Noticeboard →</Link>
      </div>
    </section>
  );
}
