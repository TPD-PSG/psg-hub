import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookings = await prisma.hotelBooking.findMany({
    where: { productionId: Number(id) },
    orderBy: { checkIn: "asc" },
    include: { hotel: true, crew: true },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const booking = await prisma.hotelBooking.create({
    data: {
      productionId:   Number(id),
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
  return NextResponse.json(booking, { status: 201 });
}
