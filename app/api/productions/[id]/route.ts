import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const production = await prisma.production.findUnique({
    where: { id: Number(id) },
    include: {
      events: { orderBy: { startAt: "asc" } },
      budgetLines: {
        orderBy: { department: "asc" },
        include: { expenses: { orderBy: { createdAt: "asc" } } },
      },
      crew: {
        orderBy: { createdAt: "asc" },
        include: { crew: true },
      },
      hotelBookings: {
        orderBy: { checkIn: "asc" },
        include: { hotel: true, crew: true },
      },
      haulageMovements: {
        orderBy: { departureAt: "asc" },
      },
      team: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      venueRef: { select: { id: true, name: true, city: true, capacity: true } },
    },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(production);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const production = await prisma.production.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      venueId: body.venueId ? Number(body.venueId) : null,
      isTour: body.isTour ?? false,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status,
      announcementStatus: body.announcementStatus || "not_announced",
      color: body.color || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(production);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.production.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
