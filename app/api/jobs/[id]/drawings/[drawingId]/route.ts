// Remove a drawing and all its revisions (admins only; its sign-off log goes with it).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removeFile } from "@/lib/storage";
import { jobAccess } from "@/lib/jobDesign";
import { gateOverrides, drawingsFor, gateBlockers } from "@/lib/drawings";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; drawingId: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  if (a.v.role !== "admin") return NextResponse.json({ error: "Only admins can remove a drawing" }, { status: 403 });
  const d = await prisma.drawing.findFirst({ where: { id: parseInt((await params).drawingId), jobId: a.id }, include: { revisions: { select: { fileId: true, file: { select: { fileKey: true } } } } } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.$transaction([
    prisma.drawing.delete({ where: { id: d.id } }),
    prisma.jobFile.deleteMany({ where: { id: { in: d.revisions.map(r => r.fileId) } } }),
  ]);
  for (const r of d.revisions) if (r.file.fileKey) await removeFile(r.file.fileKey).catch(() => {});
  return NextResponse.json({ drawings: await drawingsFor(a.id), blockers: await gateBlockers(a.id), overrides: await gateOverrides(a.id) });
}
