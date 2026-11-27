// One rental product: its units, and the hires it's on from today.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { productFields } from "@/lib/rentalFields";

const load = (id: number) => prisma.rentalProduct.findUnique({ where: { id }, select: { id: true, entityId: true } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await load(parseInt((await params).id));
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const product = await prisma.rentalProduct.findUnique({
    where: { id: p.id },
    include: {
      units: { orderBy: { barcode: "asc" }, include: { container: { select: { id: true, barcode: true, product: { select: { name: true } } } }, contents: { select: { id: true, barcode: true, product: { select: { name: true } } } } } },
      hireLines: { where: { hire: { returnDate: { gte: today }, status: { in: ["quote", "confirmed", "out"] } } }, include: { hire: { select: { id: true, number: true, title: true, status: true, outDate: true, returnDate: true } } } },
    },
  });
  return NextResponse.json(product);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await load(parseInt((await params).id));
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  const f = productFields(await req.json().catch(() => ({})), false);
  if ("error" in f) return bad(f.error);
  if (f.data.isCase === false && await prisma.rentalUnit.count({ where: { container: { productId: p.id } } }))
    return bad("Empty its cases first: units are still packed in them");
  return NextResponse.json(await prisma.rentalProduct.update({ where: { id: p.id }, data: f.data }));
}

/** Deleting is only for mistakes: a product that's been on a hire is archived instead. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await load(parseInt((await params).id));
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  if (await prisma.rentalHireLine.count({ where: { productId: p.id } })) {
    await prisma.rentalProduct.update({ where: { id: p.id }, data: { archived: true } });
    return NextResponse.json({ archived: true });
  }
  await prisma.rentalProduct.delete({ where: { id: p.id } });
  return NextResponse.json({ deleted: true });
}
