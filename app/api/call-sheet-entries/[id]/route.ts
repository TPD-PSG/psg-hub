import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entry = await prisma.callSheetEntry.update({
    where: { id: Number(id) },
    data: {
      discipline: body.discipline ?? undefined,
      name: body.name ?? undefined,
      role: body.role ?? undefined,
      callTime: body.callTime ?? undefined,
      notes: body.notes ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.callSheetEntry.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
