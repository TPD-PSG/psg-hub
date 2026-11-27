import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const venues = await prisma.venue.findMany({
    select: {
      id: true, name: true, type: true, city: true, address: true, postcode: true,
      phone: true, email: true, website: true, capacity: true,
      techNotes: true, techSpecs: true, techSpecName: true, techSpecMime: true,
      notes: true,
      // techSpecFile excluded — base64 blob only needed on download
      contacts: { orderBy: { name: "asc" } },
      dropOff: true, // read-only here; Night Run owns it
      _count: { select: { contacts: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(venues);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Add the venue's name" });
  if (bad) return bad;
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
