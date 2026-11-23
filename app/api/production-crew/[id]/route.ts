import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionCrew", id);
  if ("error" in rec) return rec.error;
  const body = await req.json();
  const link = await prisma.productionCrew.update({
    where: { id: Number(id) },
    data: {
      role:      body.role || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate:   body.endDate ? new Date(body.endDate) : null,
      dayRate:   body.dayRate ? Number(body.dayRate) : null,
      notes:     body.notes || null,
    },
  });
  return NextResponse.json(link);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionCrew", id);
  if ("error" in rec) return rec.error;
  await prisma.productionCrew.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
