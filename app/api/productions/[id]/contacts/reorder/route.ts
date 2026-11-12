import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// PATCH body: { order: [{ id: number, sortOrder: number }] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params; // consume params
  const body = await req.json();
  const updates: { id: number; sortOrder: number }[] = body.order ?? [];
  await Promise.all(
    updates.map(u => prisma.productionContact.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }))
  );
  return NextResponse.json({ ok: true });
}
