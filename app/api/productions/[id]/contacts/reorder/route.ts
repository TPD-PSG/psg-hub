import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// PATCH body: { order: [{ id: number, sortOrder: number }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "contacts");
  if ("error" in access) return access.error;
  const body = await req.json();
  const updates: { id: number; sortOrder: number }[] = body.order ?? [];
  await Promise.all(
    updates.map(u => prisma.productionContact.updateMany({ where: { id: u.id, productionId: Number(id) }, data: { sortOrder: u.sortOrder } }))
  );
  return NextResponse.json({ ok: true });
}
