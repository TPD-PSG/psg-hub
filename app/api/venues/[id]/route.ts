import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const venue = await prisma.venue.update({
    where: { id: Number(id) },
    data: {
      name: body.name ?? undefined,
      type: body.type ?? undefined,
      city: body.city ?? undefined,
      address: body.address ?? undefined,
      postcode: body.postcode ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      website: body.website ?? undefined,
      capacity: body.capacity !== undefined ? (body.capacity ? Number(body.capacity) : null) : undefined,
      techNotes: body.techNotes ?? undefined,
      notes: body.notes ?? undefined,
    },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });
  return NextResponse.json(venue);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.venue.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
