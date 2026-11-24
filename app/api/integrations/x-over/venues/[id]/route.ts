import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard, bad, readJson, parseVenueInput, InputError } from "@/lib/xover-sync";

// PATCH /api/integrations/x-over/venues/:id — a change approved by x-over's staff. Only the fields sent
// are changed; null clears one.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req);
  if (denied) return denied;

  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const venueId = Number(id);

  const json = await readJson(req);
  if (!json.ok) return bad("Body must be a JSON object");
  let data;
  try {
    data = parseVenueInput(json.body, { requireName: false });
  } catch (e) {
    if (e instanceof InputError) return bad(e.message);
    throw e;
  }
  if (!Object.keys(data).length) return bad("Nothing to change");

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const row = await prisma.venue.update({ where: { id: venueId }, data, select: { updatedAt: true } });
  return NextResponse.json({ updatedAt: row.updatedAt.toISOString() });
}
