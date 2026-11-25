// Build photos: list and add (anyone who can open the build's company space)
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity, storePhotos, withUrl } from "@/lib/spaceBoard";

const jobOf = async (params: Promise<{ id: string }>) => prisma.job.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true } });
const SELECT = { id: true, caption: true, postId: true, createdAt: true, uploadedById: true, uploadedBy: { select: { name: true } } } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const job = await jobOf(params);
  if (!job?.entityId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(job.entityId);
  if ("error" in m) return m.error;
  const photos = await prisma.spacePhoto.findMany({ where: { jobId: job.id }, select: SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json(photos.map(withUrl));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const job = await jobOf(params);
  if (!job?.entityId) return NextResponse.json({ error: "Only builds for a company with a space can have photos" }, { status: 404 });
  const m = await memberOfEntity(job.entityId);
  if ("error" in m) return m.error;
  const form = await req.formData();
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 12);
  if (!files.length) return NextResponse.json({ error: "Add a photo" }, { status: 400 });
  const caption = String(form.get("caption") ?? "").trim().slice(0, 200) || null;
  let rows;
  try { rows = await storePhotos(files, job.entityId, m.userId, { jobId: job.id, caption }); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  await prisma.spacePhoto.createMany({ data: rows });
  const photos = await prisma.spacePhoto.findMany({ where: { jobId: job.id }, select: SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json(photos.map(withUrl), { status: 201 });
}
