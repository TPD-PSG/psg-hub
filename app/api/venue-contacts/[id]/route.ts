import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const contact = await prisma.venueContact.update({
    where: { id: Number(id) },
    data: {
      name: body.name ?? undefined,
      role: body.role ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.venueContact.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
