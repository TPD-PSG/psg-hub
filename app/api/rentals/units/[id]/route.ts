// One unit: its barcode, serial, status (available, in repair, lost, retired), shelf, and the case it's packed in.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { unitFields } from "@/lib/rentalFields";
import { cleanBarcode } from "@/lib/rentals";

const load = (id: number) => prisma.rentalUnit.findUnique({ where: { id }, select: { id: true, product: { select: { entityId: true, isCase: true } } } });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await load(parseInt((await params).id));
  if (!u) return notFound();
  const a = await staffForEntity(u.product.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const f = unitFields(b);
  if ("error" in f) return bad(f.error);
  if (f.data.barcode && await prisma.rentalUnit.findFirst({ where: { barcode: f.data.barcode as string, id: { not: u.id } } })) return bad(`${f.data.barcode} is already on another unit`, 409);
  // Packing into a case: { case: "<case barcode>" } or { containerId }, null to unpack
  if ("case" in b || "containerId" in b) {
    const want = "case" in b ? (b.case ? cleanBarcode(b.case) : null) : b.containerId == null ? null : Number(b.containerId);
    if (want === null || want === "") f.data.containerId = null;
    else {
      const c = await prisma.rentalUnit.findFirst({ where: typeof want === "number" ? { id: want } : { barcode: want }, select: { id: true, containerId: true, product: { select: { entityId: true, isCase: true } } } });
      if (!c || c.product.entityId !== u.product.entityId) return bad("No case with that barcode here");
      if (!c.product.isCase) return bad("That barcode isn't a case: mark its product as a case first");
      if (c.id === u.id) return bad("A case can't go inside itself");
      // No loops: the case mustn't sit (however deep) inside this unit
      for (let up = c.containerId, n = 0; up && n < 20; n++) {
        if (up === u.id) return bad("That case is packed inside this one");
        up = (await prisma.rentalUnit.findUnique({ where: { id: up }, select: { containerId: true } }))?.containerId ?? null;
      }
      f.data.containerId = c.id;
    }
  }
  return NextResponse.json(await prisma.rentalUnit.update({ where: { id: u.id }, data: f.data }));
}

/** Only for units added by mistake; anything real is marked retired or lost instead. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await load(parseInt((await params).id));
  if (!u) return notFound();
  const a = await staffForEntity(u.product.entityId);
  if ("error" in a) return a.error;
  await prisma.rentalUnit.updateMany({ where: { containerId: u.id }, data: { containerId: null } });
  await prisma.rentalUnit.delete({ where: { id: u.id } });
  return NextResponse.json({ deleted: true });
}
