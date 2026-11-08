import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
