import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { money, toDate } from "@/lib/parse";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("hotelBooking", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const booking = await prisma.hotelBooking.update({
    where: { id: Number(id) },
    data: {
      hotelId:        Number(body.hotelId),
      crewId:         body.crewId ? Number(body.crewId) : null,
      guestName:      body.guestName || null,
      roomType:       body.roomType || null,
      roomNumber:     body.roomNumber || null,
      checkIn:        toDate(body.checkIn),
      checkOut:       toDate(body.checkOut),
      ratePerNight:   money(body.ratePerNight),
      totalCost:      money(body.totalCost),
      confirmationNo: body.confirmationNo || null,
      isPaid:         body.isPaid ?? false,
      notes:          body.notes || null,
    },
    include: { hotel: true, crew: true },
  });
  return NextResponse.json(booking);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("hotelBooking", id);
  if ("error" in rec) return rec.error;
  await prisma.hotelBooking.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
