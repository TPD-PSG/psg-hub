import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.propertyKey.update({
    where: { id: Number(id) },
    data: { description: body.description, holder: body.holder || null, quantity: body.quantity ? Number(body.quantity) : 1, notes: body.notes || null },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.propertyKey.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
