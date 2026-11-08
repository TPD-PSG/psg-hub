import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.productionCrew.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
