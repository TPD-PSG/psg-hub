import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const venues = await prisma.venue.findMany({
    include: { contacts: { orderBy: { name: "asc" } }, _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(venues);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const venue = await prisma.venue.create({
    data: {
      name: body.name,
      type: body.type || "other",
      city: body.city || null,
      address: body.address || null,
      postcode: body.postcode || null,
      phone: body.phone || null,
      email: body.email || null,
      website: body.website || null,
      capacity: body.capacity ? Number(body.capacity) : null,
      techNotes: body.techNotes || null,
      notes: body.notes || null,
    },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });
  return NextResponse.json(venue, { status: 201 });
}
