// Edit a stock item (name, unit, reorder level, cost, supplier, location, archive)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePoUser } from "@/lib/purchaseOrders";
import { stockFields } from "@/lib/stockFields";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const id = parseInt((await params).id);
  if (!(await prisma.stockItem.count({ where: { id } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const f = await stockFields(await req.json(), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  return NextResponse.json(await prisma.stockItem.update({ where: { id }, data: f.data }));
}
