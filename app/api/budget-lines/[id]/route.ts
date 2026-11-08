import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const line = await prisma.budgetLine.update({
    where: { id: Number(id) },
    data: {
      department: body.department,
      description: body.description,
      budgeted: Number(body.budgeted),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(line);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.budgetLine.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
