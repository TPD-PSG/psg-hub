import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { touchVenue } from "@/lib/night-run-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Add the contact's name" });
  if (bad) return bad;
  const contact = await prisma.venueContact.create({
    data: {
      venueId: Number(id),
      name: body.name,
      role: body.role || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    },
  });
  await touchVenue(contact.venueId);
  return NextResponse.json(contact, { status: 201 });
}
