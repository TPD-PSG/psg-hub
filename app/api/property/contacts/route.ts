import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Add the contact's name" });
  if (bad) return bad;
  const item = await prisma.propertyContact.create({
    data: { propertyId: PROPERTY_ID, name: body.name, role: body.role, phone: body.phone || null, email: body.email || null, notes: body.notes || null },
  });
  return NextResponse.json(item, { status: 201 });
}
