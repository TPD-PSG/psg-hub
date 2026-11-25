// Add a stock item to a space's materials & kit
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInSpace } from "@/lib/spaceAccess";
import { stockFields } from "@/lib/stockFields";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInSpace((await params).slug);
  if ("error" in s) return s.error;
  const f = await stockFields(await req.json(), true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const item = await prisma.stockItem.create({ data: { ...f.data, name: f.data.name as string, entityId: s.space.id } });
  if (item.quantity > 0) await prisma.stockMove.create({ data: { itemId: item.id, change: item.quantity, kind: "adjust", note: "Opening stock", unitCost: item.unitCost, userId: s.user.userId } });
  return NextResponse.json(item, { status: 201 });
}
