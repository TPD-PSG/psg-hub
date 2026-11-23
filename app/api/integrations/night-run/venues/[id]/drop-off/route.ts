import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard, bad, readJson, parseDropOff, InputError } from "@/lib/night-run-sync";

// PUT /api/integrations/night-run/venues/:id/drop-off — replaces PSG Hub's copy (missing field = null)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req);
  if (denied) return denied;

  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const venueId = Number(id);

  const json = await readJson(req);
  if (!json.ok) return bad("Body must be a JSON object");
  let data;
  try {
    data = parseDropOff(json.body);
  } catch (e) {
    if (e instanceof InputError) return bad(e.message);
    throw e;
  }

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const row = await prisma.venueDropOff.upsert({
    where: { venueId },
    create: { venueId, ...data },
    update: data,
    select: { updatedAt: true },
  });
  return NextResponse.json({ updatedAt: row.updatedAt.toISOString() });
}
