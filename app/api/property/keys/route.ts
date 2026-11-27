import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const item = await prisma.propertyKey.create({
    data: { propertyId: PROPERTY_ID, description: body.description, holder: body.holder || null, quantity: body.quantity ? Number(body.quantity) : 1, notes: body.notes || null },
  });
  return NextResponse.json(item, { status: 201 });
}
