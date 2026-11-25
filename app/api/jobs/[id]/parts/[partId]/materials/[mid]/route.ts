// Change or remove one estimated material on a part. Returns the part with its materials.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { requireJobViewer } from "@/lib/jobData";
import { materialFields, PART_SELECT } from "@/lib/buildParts";

type P = { params: Promise<{ id: string; partId: string; mid: string }> };
async function find(p: P) {
  const { id, partId, mid } = await p.params;
  const out = await denyOutOfScope("job", id);
  if (out) return { error: out };
  const v = await requireJobViewer();
  if ("error" in v) return { error: v.error };
  const m = await prisma.buildPartMaterial.findFirst({ where: { id: parseInt(mid) || 0, partId: parseInt(partId) || 0, part: { jobId: parseInt(id) || 0 } }, select: { id: true, partId: true } });
  if (!m) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { m };
}

export async function PATCH(req: Request, p: P) {
  const r = await find(p);
  if ("error" in r) return r.error;
  const f = materialFields(await req.json().catch(() => ({})), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await prisma.buildPartMaterial.update({ where: { id: r.m.id }, data: f.data });
  return NextResponse.json(await prisma.buildPart.findUnique({ where: { id: r.m.partId }, select: PART_SELECT }));
}

export async function DELETE(_req: Request, p: P) {
  const r = await find(p);
  if ("error" in r) return r.error;
  await prisma.buildPartMaterial.delete({ where: { id: r.m.id } });
  return NextResponse.json(await prisma.buildPart.findUnique({ where: { id: r.m.partId }, select: PART_SELECT }));
}
