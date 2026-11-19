import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotels = await prisma.hotel.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { bookings: true } } },
  });
  return NextResponse.json(hotels);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const hotel = await prisma.hotel.create({
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
  return NextResponse.json(hotel, { status: 201 });
}
