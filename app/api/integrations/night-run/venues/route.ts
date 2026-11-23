import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard, bad, readJson, parseNewVenue, dropOffJson, InputError } from "@/lib/night-run-sync";

export const dynamic = "force-dynamic";

// GET /api/integrations/night-run/venues?updatedSince=<ISO>
// Venues whose row, contacts or drop-off changed at or after `updatedSince` (all venues if omitted).
export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const raw = req.nextUrl.searchParams.get("updatedSince");
  let since: Date | null = null;
  if (raw) {
    since = new Date(raw);
    if (isNaN(since.getTime())) return bad("updatedSince must be an ISO 8601 date-time");
  }

  // Taken before the query, so anything that changes while it runs is caught by the next pull
  const serverTime = new Date();
  const venues = await prisma.venue.findMany({
    where: since ? { OR: [{ updatedAt: { gte: since } }, { dropOff: { updatedAt: { gte: since } } }] } : undefined,
    select: {
      id: true, name: true, type: true, address: true, city: true, postcode: true,
      phone: true, email: true, website: true, updatedAt: true,
      contacts: { select: { id: true, name: true, role: true, phone: true, email: true }, orderBy: { id: "asc" } },
      dropOff: true,
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    serverTime: serverTime.toISOString(),
    venues: venues.map(v => ({ ...v, updatedAt: v.updatedAt.toISOString(), dropOff: dropOffJson(v.dropOff) })),
  });
}

// POST /api/integrations/night-run/venues — a venue Night Run has that PSG Hub doesn't
export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const json = await readJson(req);
  if (!json.ok) return bad("Body must be a JSON object");

  let input;
  try {
    input = parseNewVenue(json.body);
  } catch (e) {
    if (e instanceof InputError) return bad(e.message);
    throw e;
  }

  const venue = await prisma.venue.create({
    data: { ...input.venue, ...(input.dropOff ? { dropOff: { create: input.dropOff } } : {}) },
    select: { id: true, updatedAt: true },
  });
  return NextResponse.json({ id: venue.id, updatedAt: venue.updatedAt.toISOString() }, { status: 201 });
}
