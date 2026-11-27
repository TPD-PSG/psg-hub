import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const badDate = missingDates(body, ["startAt", "endAt"]);
  if (badDate) return badDate;
  const event = await prisma.event.create({
    data: {
      productionId: Number(id),
      title: body.title,
      type: body.type,
      startAt: toDate(body.startAt)!,
      endAt: toDate(body.endAt)!,
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(event, { status: 201 });
}
