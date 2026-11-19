import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const event = await prisma.event.create({
    data: {
      productionId: Number(id),
      title: body.title,
      type: body.type,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(event, { status: 201 });
}
