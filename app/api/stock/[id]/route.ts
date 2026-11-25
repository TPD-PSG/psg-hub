// Edit a stock item (name, unit, reorder level, cost, supplier, location, archive)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePoUser } from "@/lib/purchaseOrders";
import { stockFields } from "@/lib/stockFields";
import { canSeeCompanyRecord } from "@/lib/spaces";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const id = parseInt((await params).id);
  const item = await prisma.stockItem.findUnique({ where: { id }, select: { entityId: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeCompanyRecord({ id: u.userId, role: u.role }, item.entityId))) return NextResponse.json({ error: "This space isn't yours" }, { status: 403 });
  const f = await stockFields(await req.json(), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  return NextResponse.json(await prisma.stockItem.update({ where: { id }, data: f.data }));
}
