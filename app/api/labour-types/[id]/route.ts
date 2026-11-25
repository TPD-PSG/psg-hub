// Change a labour type: name, day rate, notes, or retire / restore it (staff of its space).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { labourFor, labourFields } from "@/lib/labourTypes";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const l = await prisma.labourType.findUnique({ where: { id: parseInt((await params).id) || 0 } });
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(l.entityId);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const f = labourFields(await req.json().catch(() => ({})), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (f.data.name && f.data.name !== l.name && (await prisma.labourType.count({ where: { entityId: l.entityId, name: f.data.name as string } }))) return NextResponse.json({ error: `There's already ${f.data.name}` }, { status: 409 });
  await prisma.labourType.update({ where: { id: l.id }, data: f.data });
  return NextResponse.json(await labourFor(l.entityId));
}
