import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.propertyContact.update({
    where: { id: Number(id) },
    data: { name: body.name, role: body.role, phone: body.phone || null, email: body.email || null, notes: body.notes || null },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.propertyContact.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
