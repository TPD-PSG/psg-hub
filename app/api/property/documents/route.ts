import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.propertyDocument.create({
    data: {
      propertyId: PROPERTY_ID,
      name: body.name,
      type: body.type || "other",
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      fileUrl: body.fileUrl || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
