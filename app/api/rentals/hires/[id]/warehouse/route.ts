// A hire's warehouse view: what to pick (and from which shelves), what's scanned out, what's back.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound } from "@/lib/rentalAccess";
import { warehouseView } from "@/lib/rentalWarehouse";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await prisma.rentalHire.findUnique({ where: { id: parseInt((await params).id) }, select: { id: true, entityId: true } });
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  return NextResponse.json(await warehouseView(h.id));
}
