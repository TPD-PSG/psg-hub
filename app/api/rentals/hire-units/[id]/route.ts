// How a unit came back from a hire: damaged (goes into repair, with an optional damage charge on
// the hire), missing (marked lost), or OK after all (back in service).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { warehouseView, closeIfAllBack } from "@/lib/rentalWarehouse";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const row = await prisma.rentalHireUnit.findUnique({ where: { id: parseInt((await params).id) }, include: { hire: { select: { id: true, entityId: true } }, unit: { select: { id: true, barcode: true, status: true, product: { select: { name: true } } } } } });
  if (!row) return notFound();
  const a = await staffForEntity(row.hire.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  if (!["ok", "damaged", "missing"].includes(b.condition)) return bad("Condition is ok, damaged or missing");
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : null;
  if (b.condition === "damaged" && !note) return bad("Say what's wrong with it");
  let charge: number | null = null;
  if (b.charge !== undefined && b.charge !== null && b.charge !== "") {
    charge = Number(b.charge);
    if (!isFinite(charge) || charge < 0 || charge > 1e6) return bad("The charge is a number of pounds");
  }
  const unitStatus = b.condition === "damaged" ? "repair" : b.condition === "missing" ? "lost" : "available";
  const label = `${row.unit.product.name} ${row.unit.barcode}`;
  await prisma.$transaction([
    prisma.rentalHireUnit.update({ where: { id: row.id }, data: { condition: b.condition, note, backAt: row.backAt ?? new Date(), backById: row.backById ?? a.user.userId } }),
    // Only changes the unit if it was in service, or is being put back in service
    prisma.rentalUnit.update({ where: { id: row.unit.id }, data: { status: unitStatus, ...(b.condition !== "ok" && note ? { notes: `${b.condition === "damaged" ? "Damaged" : "Missing"} on hire: ${note}` } : {}) } }),
    ...(charge ? [prisma.rentalHireCharge.create({ data: { hireId: row.hire.id, description: `${b.condition === "missing" ? "Missing" : "Damage"}: ${label}${note ? ` (${note})` : ""}`.slice(0, 200), quantity: 1, unitPrice: charge, sortOrder: 1000 } })] : []),
  ]);
  await closeIfAllBack(row.hire.id);
  return NextResponse.json({ view: await warehouseView(row.hire.id) });
}
