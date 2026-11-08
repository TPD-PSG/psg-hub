import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const keyDate = await prisma.productionKeyDate.update({
    where: { id: Number(id) },
    data: {
      type: body.type,
      label: body.label || null,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(keyDate);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.productionKeyDate.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
