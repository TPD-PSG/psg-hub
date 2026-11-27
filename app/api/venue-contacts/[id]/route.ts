import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { touchVenue } from "@/lib/night-run-sync";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const contact = await prisma.venueContact.update({
    where: { id: Number(id) },
    data: {
      name: body.name ?? undefined,
      role: body.role ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  await touchVenue(contact.venueId);
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await prisma.venueContact.delete({ where: { id: Number(id) } });
  await touchVenue(removed.venueId);
  return NextResponse.json({ ok: true });
}
