// Upload a new revision of a drawing: it gets the next letter and the previous one is superseded.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { jobAccess, FILE_KINDS, FILE_MAX } from "@/lib/jobDesign";
import { gateOverrides, drawingsFor, gateBlockers, nextRev } from "@/lib/drawings";
import { notifyClientOfDrawing } from "@/lib/clientPortal";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; drawingId: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const drawing = await prisma.drawing.findFirst({ where: { id: parseInt((await params).drawingId), jobId: a.id }, include: { revisions: { select: { id: true, rev: true } } } });
  if (!drawing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose the drawing file" }, { status: 400 });
  if (!(FILE_KINDS.design as readonly string[]).includes(file.type)) return NextResponse.json({ error: "Drawings must be PDF, JPEG, PNG or WebP" }, { status: 400 });
  if (file.size > FILE_MAX) return NextResponse.json({ error: "The drawing is over 25 MB" }, { status: 400 });
  const stored = await saveFile("job-files", file.name, await file.arrayBuffer(), file.type);
  const rev = nextRev(drawing.revisions.map(r => r.rev));
  await prisma.$transaction([
    prisma.drawingRevision.updateMany({ where: { drawingId: drawing.id, status: { not: "superseded" } }, data: { status: "superseded" } }),
    prisma.drawingRevision.create({
      data: { drawing: { connect: { id: drawing.id } }, rev, note, file: { create: { jobId: a.id, kind: "design", name: file.name.slice(0, 200), mime: file.type, size: file.size, fileKey: stored.key, data: stored.base64, uploadedById: a.v.userId } } },
    }),
  ]);
  await notifyClientOfDrawing(a.id, `${drawing.number ? `${drawing.number} ` : ""}${drawing.title}, rev ${rev}`).catch(() => {});
  return NextResponse.json({ rev, drawings: await drawingsFor(a.id), blockers: await gateBlockers(a.id), overrides: await gateOverrides(a.id) }, { status: 201 });
}
