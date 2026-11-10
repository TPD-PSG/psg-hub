import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const assignment = await prisma.staffAssignment.update({
    where: { id: Number(id) },
    data: {
      userId: Number(body.userId),
      productionId: Number(body.productionId),
      tourStopId: body.tourStopId ? Number(body.tourStopId) : null,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      notes: body.notes || null,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      production: { select: { id: true, name: true } },
      tourStop: { select: { id: true, venue: { select: { name: true, city: true } } } },
    },
  });
  return NextResponse.json(assignment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.staffAssignment.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
