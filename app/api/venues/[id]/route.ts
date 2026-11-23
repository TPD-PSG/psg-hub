import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { removeFile } from "@/lib/storage";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const venue = await prisma.venue.update({
    where: { id: Number(id) },
    data: {
      name: body.name ?? undefined,
      type: body.type ?? undefined,
      city: body.city ?? undefined,
      address: body.address ?? undefined,
      postcode: body.postcode ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      website: body.website ?? undefined,
      capacity: body.capacity !== undefined ? (body.capacity ? Number(body.capacity) : null) : undefined,
      techNotes: body.techNotes ?? undefined,
      notes: body.notes ?? undefined,
    },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });
  // Don't send the stored tech-spec file back on every save
  const { techSpecFile, techSpecFileKey, ...rest } = venue;
  return NextResponse.json({ ...rest, hasTechSpecFile: !!(techSpecFile || techSpecFileKey) });
}

export async function DELETE(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const venueId = Number(id);
  // Don't silently wipe tour dates: refuse while any tour stop uses this venue
  const stops = await prisma.tourStop.findMany({
    where: { venueId },
    select: { production: { select: { name: true } } },
  });
  if (stops.length) {
    const names = [...new Set(stops.map(s => s.production?.name).filter(Boolean))];
    return NextResponse.json({
      error: `This venue is on ${stops.length} tour date${stops.length === 1 ? "" : "s"}${names.length ? ` (${names.join(", ")})` : ""}. Remove or move those tour dates first.`,
    }, { status: 409 });
  }
  // Note the venue's stored files so they can be removed from R2 once the rows are gone
  const files = await prisma.venue.findUnique({ where: { id: venueId }, select: { techSpecFileKey: true, documents: { select: { fileKey: true } } } });
  await prisma.venueContact.deleteMany({ where: { venueId } });
  await prisma.venue.delete({ where: { id: venueId } });
  for (const key of [files?.techSpecFileKey, ...(files?.documents ?? []).map(d => d.fileKey)]) await removeFile(key);
  return NextResponse.json({ ok: true });
}
