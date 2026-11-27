// Change a sub-hire (status, supplier, cost…) or remove it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { subHireFields } from "@/lib/rentalFields";

const load = (id: number) => prisma.rentalSubHire.findUnique({ where: { id }, select: { id: true, hire: { select: { entityId: true } } } });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await load(parseInt((await params).id));
  if (!s) return notFound();
  const a = await staffForEntity(s.hire.entityId);
  if ("error" in a) return a.error;
  const f = await subHireFields(await req.json().catch(() => ({})), s.hire.entityId, false);
  if ("error" in f) return bad(f.error);
  return NextResponse.json(await prisma.rentalSubHire.update({ where: { id: s.id }, data: f.data, include: { product: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await load(parseInt((await params).id));
  if (!s) return notFound();
  const a = await staffForEntity(s.hire.entityId);
  if ("error" in a) return a.error;
  await prisma.rentalSubHire.delete({ where: { id: s.id } });
  return NextResponse.json({ deleted: true });
}
