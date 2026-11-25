// Repairs and aftercare for sets out on tour (27 Nov 2026). Reported by staff, or by the client in
// My builds (with an optional photo); tracked open → scheduled → done. The workshop team and admins
// hear about new reports; the client hears when theirs is scheduled or done.
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { notify } from "@/lib/clientPortal";

export const URGENCIES = ["urgent", "soon", "routine"] as const;
export const REPAIR_STATUSES = ["open", "scheduled", "done"] as const;
export const REPAIR_SELECT = {
  id: true, title: true, description: true, whereAt: true, urgency: true, status: true, scheduledFor: true, resolution: true,
  reportedByName: true, fromClient: true, doneAt: true, createdAt: true, photoFileId: true,
  job: { select: { id: true, number: true, title: true, client: { select: { name: true } } } },
  piece: { select: { id: true, name: true } },
} as const;

/** Read a report from a form (staff or client). jobIds limits which builds it may be on. */
export async function readReport(form: FormData, allowed: { entityId?: number; clientId?: number }) {
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const jobId = Number(form.get("jobId")) || 0;
  const job = await prisma.job.findFirst({ where: { id: jobId, status: { not: "cancelled" }, ...(allowed.entityId ? { entityId: allowed.entityId } : {}), ...(allowed.clientId ? { clientId: allowed.clientId } : {}) }, select: { id: true, title: true, entityId: true } });
  if (!job) return { error: "Pick the build it's about" };
  const title = text("title", 150);
  if (!title) return { error: "Say what needs repairing" };
  const urgency = URGENCIES.includes(String(form.get("urgency")) as (typeof URGENCIES)[number]) ? String(form.get("urgency")) : "soon";
  const pieceId = Number(form.get("pieceId")) || null;
  if (pieceId && !(await prisma.storedPiece.count({ where: { id: pieceId, jobId: job.id } }))) return { error: "That piece isn't on this build" };
  const photo = form.get("photo");
  let photoFileId: number | null = null;
  if (photo instanceof File && photo.size) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return { error: "The photo must be JPEG, PNG or WebP" };
    if (photo.size > 15 * 1024 * 1024) return { error: "The photo is over 15 MB" };
    const stored = await saveFile("job-files", photo.name, await photo.arrayBuffer(), photo.type);
    photoFileId = (await prisma.jobFile.create({ data: { jobId: job.id, kind: "repair", name: photo.name.slice(0, 200), mime: photo.type, size: photo.size, fileKey: stored.key, data: stored.base64 } })).id;
  }
  return { job, data: { jobId: job.id, pieceId, title, description: text("description", 3000), whereAt: text("whereAt", 150), urgency, photoFileId } };
}

/** Tell the workshop team (people whose home company it is) and admins about a new report. */
export async function tellWorkshop(job: { id: number; title: string; entityId: number | null }, title: string, by: string, urgency: string) {
  const people = await prisma.user.findMany({ where: { OR: [{ role: "admin" }, ...(job.entityId ? [{ homeEntityId: job.entityId, role: { in: ["admin", "member"] } }] : [])] }, select: { id: true } });
  const e = job.entityId ? await prisma.entity.findUnique({ where: { id: job.entityId }, select: { slug: true, hasSpace: true } }) : null;
  await notify(people.map(p => p.id), { title: `${urgency === "urgent" ? "URGENT repair" : "Repair needed"} on ${job.title}`, body: `${title} (reported by ${by})`, link: e?.hasSpace && e.slug ? `/spaces/${e.slug}/aftercare` : `/jobs/${job.id}` }).catch(() => {});
}

export const repairsFor = (entityId: number) => prisma.repair.findMany({
  where: { job: { entityId } }, select: REPAIR_SELECT,
  orderBy: [{ status: "asc" }, { createdAt: "desc" }],
});
