import { NextResponse } from "next/server";
import { requireProductionAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const productionId = Number(id);
  const stops = await prisma.tourStop.findMany({
    where: { productionId },
    include: { venue: { select: { id: true, name: true, city: true, capacity: true } } },
    orderBy: { stopNumber: "asc" },
  });
  return NextResponse.json(stops);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const productionId = Number(id);
  const body = await req.json().catch(() => ({}));

  // Auto-assign next stop number
  const last = await prisma.tourStop.findFirst({
    where: { productionId },
    orderBy: { stopNumber: "desc" },
  });
  const stopNumber = body.stopNumber ?? (last ? last.stopNumber + 1 : 1);

  const stop = await prisma.tourStop.create({
    data: {
      productionId,
      venueId: Number(body.venueId),
      stopNumber,
      loadInDate: (toDate(body.loadInDate) ?? null),
      startDate: (toDate(body.startDate) ?? null),
      endDate: (toDate(body.endDate) ?? null),
      performanceStart: (toDate(body.performanceStart) ?? null),
      performanceEnd: (toDate(body.performanceEnd) ?? null),
      notes: body.notes ?? null,
    },
    include: { venue: { select: { id: true, name: true, city: true, capacity: true } } },
  });
  return NextResponse.json(stop, { status: 201 });
}
