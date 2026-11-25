// A build's materials: its purchase orders, stock booked out to it, and the company's stock
// (for "add from stock"). PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePoUser, poTotal } from "@/lib/purchaseOrders";
import { canSeeCompanyRecord } from "@/lib/spaces";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const id = parseInt((await params).id);
  const job = await prisma.job.findUnique({ where: { id }, select: { entityId: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeCompanyRecord({ id: u.userId, role: u.role }, job.entityId))) return NextResponse.json({ error: "This space isn't yours" }, { status: 403 });
  const [pos, moves, items] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { jobId: id, status: { not: "cancelled" } },
      select: { id: true, number: true, status: true, inSage: true, supplierName: true, supplier: { select: { name: true } }, lines: { select: { id: true, description: true, quantity: true, unit: true, unitCost: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stockMove.findMany({ where: { jobId: id, kind: { in: ["book_out", "return"] } }, include: { item: { select: { name: true, unit: true } } }, orderBy: { createdAt: "asc" } }),
    job.entityId ? prisma.stockItem.findMany({ where: { entityId: job.entityId, archived: false }, select: { id: true, name: true, unit: true, quantity: true }, orderBy: { name: "asc" } }) : [],
  ]);
  return NextResponse.json({ pos: pos.map(p => ({ ...p, total: poTotal(p.lines) })), moves, items });
}
