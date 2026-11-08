import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const keyDates = await prisma.productionKeyDate.findMany({
    where: { productionId: Number(id) },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(keyDates);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const keyDate = await prisma.productionKeyDate.create({
    data: {
      productionId: Number(id),
      type: body.type,
      label: body.label || null,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(keyDate);
}
