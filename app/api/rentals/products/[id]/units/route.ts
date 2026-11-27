// Add units to a product: { count } to barcode them automatically, or { barcodes } from the stickers.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { unitBarcodes } from "@/lib/rentalFields";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await prisma.rentalProduct.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true, entity: { select: { name: true, shortName: true } } } });
  if (!p) return notFound();
  const a = await staffForEntity(p.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const codes = await unitBarcodes(b, p.entity.shortName ?? p.entity.name);
  if ("error" in codes) return bad(codes.error, codes.status);
  if (!codes.list.length) return bad("Say how many units, or give their barcodes");
  const serial = typeof b.serial === "string" && b.serial.trim() && codes.list.length === 1 ? b.serial.trim().slice(0, 80) : null;
  await prisma.rentalUnit.createMany({ data: codes.list.map(barcode => ({ productId: p.id, barcode, serial })) });
  const units = await prisma.rentalUnit.findMany({ where: { barcode: { in: codes.list } }, orderBy: { barcode: "asc" } });
  return NextResponse.json({ units }, { status: 201 });
}
