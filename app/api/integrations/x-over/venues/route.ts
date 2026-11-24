import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard, bad, readJson, parseVenueInput, venueType, techSpecsJson, InputError } from "@/lib/xover-sync";

export const dynamic = "force-dynamic";

// GET /api/integrations/x-over/venues?updatedSince=<ISO>
// Venues whose row or contacts changed at or after `updatedSince` (all venues if omitted), plus `ids`:
// every venue id there is, so x-over can tell when one has been removed.
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
  const [venues, all] = await Promise.all([
    prisma.venue.findMany({
      where: since ? { updatedAt: { gte: since } } : undefined,
      select: {
        id: true, name: true, type: true, address: true, city: true, postcode: true, phone: true, email: true,
        website: true, capacity: true, techNotes: true, techSpecs: true, techSpecName: true, techSpecMime: true,
        updatedAt: true,
        contacts: { select: { id: true, name: true, role: true, phone: true, email: true }, orderBy: { id: "asc" } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.venue.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
  ]);
  // Whether a file exists without loading it: R2 key, or a non-empty base64 column
  const withFile = new Set((await prisma.venue.findMany({
    where: { id: { in: venues.map((v) => v.id) }, OR: [{ techSpecFileKey: { not: null } }, { techSpecFile: { not: null } }] },
    select: { id: true },
  })).map((v) => v.id));

  return NextResponse.json({
    serverTime: serverTime.toISOString(),
    ids: all.map((v) => v.id),
    venues: venues.map(({ techSpecs, techSpecName, techSpecMime, ...v }) => ({
      ...v,
      updatedAt: v.updatedAt.toISOString(),
      techSpecs: techSpecsJson(techSpecs),
      techSpecFile: withFile.has(v.id) ? { name: techSpecName ?? "Tech spec", mime: techSpecMime ?? "application/octet-stream" } : null,
    })),
  });
}

// POST /api/integrations/x-over/venues — a venue an x-over customer added, approved by x-over's staff
export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const json = await readJson(req);
  if (!json.ok) return bad("Body must be a JSON object");

  let input;
  try {
    input = parseVenueInput(json.body, { requireName: true });
  } catch (e) {
    if (e instanceof InputError) return bad(e.message);
    throw e;
  }

  const venue = await prisma.venue.create({
    data: { ...input, name: input.name!, type: venueType(json.body) },
    select: { id: true, updatedAt: true },
  });
  return NextResponse.json({ id: venue.id, updatedAt: venue.updatedAt.toISOString() }, { status: 201 });
}
