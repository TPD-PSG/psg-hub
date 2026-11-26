// One part of a build: plan it (person + start day), resize, rename, tick off or remove.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { partFields, PART_SELECT, partsForViewer } from "@/lib/buildParts";

type P = { params: Promise<{ id: string; partId: string }> };
const find = async (params: P["params"]) => {
  const { id, partId } = await params;
  return prisma.buildPart.findFirst({ where: { id: parseInt(partId), jobId: parseInt(id) }, select: { id: true } });
};

export async function PATCH(req: Request, { params }: P) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const part = await find(params);
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const f = await partFields(await req.json(), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  return NextResponse.json(partsForViewer(v.seeMoney, await prisma.buildPart.update({ where: { id: part.id }, data: f.data, select: PART_SELECT })));
}

export async function DELETE(_req: Request, { params }: P) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const part = await find(params);
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.buildPart.delete({ where: { id: part.id } });
  return NextResponse.json({ ok: true });
}
