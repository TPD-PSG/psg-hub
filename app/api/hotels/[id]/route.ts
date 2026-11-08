import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const hotel = await prisma.hotel.update({
    where: { id: Number(id) },
    data: {
      name:    body.name,
      city:    body.city || null,
      address: body.address || null,
      phone:   body.phone || null,
      email:   body.email || null,
      website: body.website || null,
      notes:   body.notes || null,
    },
  });
  return NextResponse.json(hotel);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.hotel.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
