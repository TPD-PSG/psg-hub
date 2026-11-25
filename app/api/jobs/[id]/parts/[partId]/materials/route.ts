// Estimated materials for one part of a build: add a line (PSG staff who can see the build).
// Returns the part with its materials.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { requireJobViewer } from "@/lib/jobData";
import { materialFields, PART_SELECT } from "@/lib/buildParts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  const { id, partId } = await params;
  const outOfScope = await denyOutOfScope("job", id);
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const part = await prisma.buildPart.findFirst({ where: { id: parseInt(partId) || 0, jobId: parseInt(id) || 0 }, select: { id: true, _count: { select: { materials: true } } } });
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (part._count.materials >= 200) return NextResponse.json({ error: "That's a lot of materials for one part. Split the part up." }, { status: 400 });
  const f = materialFields(await req.json().catch(() => ({})), true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await prisma.buildPartMaterial.create({ data: { ...(f.data as { description: string }), partId: part.id, sortOrder: part._count.materials } });
  return NextResponse.json(await prisma.buildPart.findUnique({ where: { id: part.id }, select: PART_SELECT }), { status: 201 });
}
