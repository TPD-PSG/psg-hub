// Add a sub-hire to a hire: kit hired in from another company to cover what we're short of.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { subHireFields } from "@/lib/rentalFields";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await prisma.rentalHire.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true } });
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  const f = await subHireFields(await req.json().catch(() => ({})), h.entityId, true);
  if ("error" in f) return bad(f.error);
  const sub = await prisma.rentalSubHire.create({ data: { ...(f.data as { description: string }), hireId: h.id }, include: { product: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } });
  return NextResponse.json(sub, { status: 201 });
}
