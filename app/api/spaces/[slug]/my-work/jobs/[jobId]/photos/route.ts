// Add build photos to a build you have a part on (they show on the build's page for staff too)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { myJob, myWorkViewer } from "@/lib/myWork";
import { storePhotos, withUrl } from "@/lib/spaceBoard";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; jobId: string }> }) {
  const { slug, jobId } = await params;
  const v = await myWorkViewer(slug);
  if ("error" in v) return v.error;
  const j = await myJob(v, jobId);
  if ("error" in j) return j.error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Choose a photo to upload" }, { status: 400 });
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 12);
  if (!files.length) return NextResponse.json({ error: "Add a photo" }, { status: 400 });
  const caption = String(form.get("caption") ?? "").trim().slice(0, 200) || null;
  let rows;
  try { rows = await storePhotos(files, v.space.id, v.userId, { jobId: j.jobId, caption }); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  await prisma.spacePhoto.createMany({ data: rows });
  const photos = await prisma.spacePhoto.findMany({ where: { jobId: j.jobId }, select: { id: true, caption: true, createdAt: true, uploadedById: true, uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 });
  return NextResponse.json(photos.map(withUrl), { status: 201 });
}
