import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, money, toDate } from "@/lib/parse";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "accommodation");
  if ("error" in access) return access.error;
  const bookings = await prisma.hotelBooking.findMany({
    where: { productionId: Number(id) },
    orderBy: { checkIn: "asc" },
    include: { hotel: true, crew: true },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "accommodation");
  if ("error" in access) return access.error;
  const body = await req.json();
  const badDate = missingDates(body, ["checkIn", "checkOut"]);
  if (badDate) return badDate;
  const booking = await prisma.hotelBooking.create({
    data: {
      productionId:   Number(id),
      hotelId:        Number(body.hotelId),
      crewId:         body.crewId ? Number(body.crewId) : null,
      guestName:      body.guestName || null,
      roomType:       body.roomType || null,
      roomNumber:     body.roomNumber || null,
      checkIn:        toDate(body.checkIn)!,
      checkOut:       toDate(body.checkOut)!,
      ratePerNight:   money(body.ratePerNight),
      totalCost:      money(body.totalCost),
      confirmationNo: body.confirmationNo || null,
      isPaid:         body.isPaid ?? false,
      notes:          body.notes || null,
    },
    include: { hotel: true, crew: true },
  });
  return NextResponse.json(booking, { status: 201 });
}
