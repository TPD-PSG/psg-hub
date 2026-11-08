import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const booking = await prisma.hotelBooking.update({
    where: { id: Number(id) },
    data: {
      hotelId:        Number(body.hotelId),
      crewId:         body.crewId ? Number(body.crewId) : null,
      guestName:      body.guestName || null,
      roomType:       body.roomType || null,
      roomNumber:     body.roomNumber || null,
      checkIn:        new Date(body.checkIn),
      checkOut:       new Date(body.checkOut),
      ratePerNight:   body.ratePerNight ? Number(body.ratePerNight) : null,
      totalCost:      body.totalCost ? Number(body.totalCost) : null,
      confirmationNo: body.confirmationNo || null,
      isPaid:         body.isPaid ?? false,
      notes:          body.notes || null,
    },
    include: { hotel: true, crew: true },
  });
  return NextResponse.json(booking);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.hotelBooking.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
