import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = await prisma.propertyMaintenance.create({
    data: {
      propertyId: PROPERTY_ID,
      title: body.title,
      description: body.description || null,
      status: body.status || "reported",
      priority: body.priority || "normal",
      contractor: body.contractor || null,
      cost: body.cost ? Number(body.cost) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
