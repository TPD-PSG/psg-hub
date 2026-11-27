// Edit or remove a package. Removing one never touches the hires it was added to.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad, text } from "@/lib/rentalAccess";
import { lineList } from "@/lib/rentalFields";

const load = (id: number) => prisma.rentalPackage.findUnique({ where: { id }, select: { id: true, entityId: true } });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await load(parseInt((await params).id));
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("name" in b) { const n = text(b.name, 120); if (!n) return bad("Give the package a name"); data.name = n; }
  if ("description" in b) data.description = text(b.description, 500);
  if ("items" in b) {
    const items = await lineList(b.items, p.entityId, 100);
    if ("error" in items) return bad(items.error);
    if (!items.list.length) return bad("A package needs at least one product");
    const m = new Map<number, number>();
    for (const x of items.list) m.set(x.productId, (m.get(x.productId) ?? 0) + x.quantity);
    await prisma.rentalPackageItem.deleteMany({ where: { packageId: p.id } });
    data.items = { create: [...m].map(([productId, quantity]) => ({ productId, quantity })) };
  }
  return NextResponse.json(await prisma.rentalPackage.update({ where: { id: p.id }, data, include: { items: { include: { product: { select: { id: true, name: true } } } } } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await load(parseInt((await params).id));
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  await prisma.rentalPackage.delete({ where: { id: p.id } });
  return NextResponse.json({ deleted: true });
}
