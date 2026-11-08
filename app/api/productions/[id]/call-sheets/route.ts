import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sheets = await prisma.callSheet.findMany({
    where: { productionId: Number(id) },
    include: { entries: { orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }] } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sheet = await prisma.callSheet.create({
    data: {
      productionId: Number(id),
      date: new Date(body.date),
      title: body.title || null,
      venue: body.venue || null,
      generalNotes: body.generalNotes || null,
    },
    include: { entries: true },
  });
  return NextResponse.json(sheet, { status: 201 });
}
