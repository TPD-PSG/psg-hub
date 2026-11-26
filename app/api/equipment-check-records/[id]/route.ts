// A check record's certificate: anyone in the space can open it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFile } from "@/lib/storage";
import { workshopViewer } from "@/lib/inductions";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const r = Number.isInteger(id) ? await prisma.equipmentCheckRecord.findUnique({ where: { id }, select: { fileName: true, fileMime: true, fileKey: true, fileData: true, check: { select: { machine: { select: { entity: { select: { slug: true } } } } } } } }) : null;
  if (!r?.fileName || !r.check.machine.entity.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const v = await workshopViewer(r.check.machine.entity.slug);
  if ("error" in v) return v.error;
  const buf = await loadFile(r.fileKey, r.fileData);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buf, { headers: { "Content-Type": r.fileMime ?? "application/octet-stream", "Content-Disposition": `inline; filename="${r.fileName.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" } });
}
