import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";

const prisma = new PrismaClient();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const keyDates = await prisma.productionKeyDate.findMany({
    where: { productionId: Number(id) },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(keyDates);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const body = await req.json();
  const badDate = missingDates(body, ["startDate"]);
  if (badDate) return badDate;
  const keyDate = await prisma.productionKeyDate.create({
    data: {
      productionId: Number(id),
      type: body.type,
      label: body.label || null,
      startDate: toDate(body.startDate)!,
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(keyDate);
}
