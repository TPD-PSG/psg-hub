// Change an item: admins anything; its owner the details and dates (not who owns it, or retiring it).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { complianceViewer, register, itemFields, visibleItems, canManage } from "@/lib/compliance";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const v = await complianceViewer();
  if ("error" in v) return v.error;
  const id = Number((await params).id);
  const item = Number.isInteger(id) ? await prisma.complianceItem.findFirst({ where: { id, ...visibleItems(v) }, select: { id: true, ownerId: true } }) : null;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(v, item)) return NextResponse.json({ error: "Only admins or this item's owner can change it" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!v.admin && ("ownerId" in body || "archived" in body || "entityId" in body)) return NextResponse.json({ error: "Only admins can change the owner, company or retire it" }, { status: 403 });
  const f = await itemFields(body, false, v);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await prisma.complianceItem.update({ where: { id: item.id }, data: f.data });
  return NextResponse.json(await register(v));
}
