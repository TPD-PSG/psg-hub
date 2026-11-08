import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const link = await prisma.productionCrew.create({
    data: {
      productionId: Number(id),
      crewId:       Number(body.crewId),
      role:         body.role || null,
      startDate:    body.startDate ? new Date(body.startDate) : null,
      endDate:      body.endDate ? new Date(body.endDate) : null,
      dayRate:      body.dayRate ? Number(body.dayRate) : null,
      notes:        body.notes || null,
    },
    include: { crew: true },
  });
  return NextResponse.json(link, { status: 201 });
}
