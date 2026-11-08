import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.propertyContact.create({
    data: { propertyId: PROPERTY_ID, name: body.name, role: body.role, phone: body.phone || null, email: body.email || null, notes: body.notes || null },
  });
  return NextResponse.json(item, { status: 201 });
}
