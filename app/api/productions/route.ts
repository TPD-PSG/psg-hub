import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const productions = await prisma.production.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { events: true, budgetLines: true } },
      budgetLines: { include: { expenses: true } },
    },
  });
  return NextResponse.json(productions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const production = await prisma.production.create({
    data: {
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status || "planning",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(production, { status: 201 });
}
