// Scanning on a hire: { barcode, mode: "out" | "in" } (a handheld scanner, the phone camera or typed).
// DELETE { unitId } takes back a unit scanned out by mistake (only while it's still out).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { scanOut, scanIn, warehouseView } from "@/lib/rentalWarehouse";

const load = async (params: Promise<{ id: string }>) => prisma.rentalHire.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true } });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await load(params);
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  if (b.mode !== "out" && b.mode !== "in") return bad("Say whether you're scanning out or in");
  const r = b.mode === "out" ? await scanOut(h.id, b.barcode, a.user.userId) : await scanIn(h.entityId, b.barcode, a.user.userId, h.id);
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.status });
  return NextResponse.json({ message: r.message, barcodes: r.barcodes, hireId: r.hireId, view: await warehouseView(h.id) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await load(params);
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const row = await prisma.rentalHireUnit.findFirst({ where: { hireId: h.id, unitId: Number(b.unitId) }, include: { unit: { select: { contents: { select: { id: true } }, product: { select: { isCase: true } } } } } });
  if (!row) return notFound();
  if (row.backAt) return bad("That unit has already been checked back in");
  // Taking a case off takes off what's packed in it too
  const ids = [row.unitId, ...(row.unit.product.isCase ? row.unit.contents.map(c => c.id) : [])];
  await prisma.rentalHireUnit.deleteMany({ where: { hireId: h.id, unitId: { in: ids }, backAt: null } });
  return NextResponse.json({ view: await warehouseView(h.id) });
}
