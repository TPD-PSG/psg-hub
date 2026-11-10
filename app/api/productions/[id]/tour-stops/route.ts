import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const productionId = Number(id);
  const stops = await prisma.tourStop.findMany({
    where: { productionId },
    include: { venue: { select: { id: true, name: true, city: true, capacity: true } } },
    orderBy: { stopNumber: "asc" },
  });
  return NextResponse.json(stops);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const productionId = Number(id);
  const body = await req.json();

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
      loadInDate: body.loadInDate ? new Date(body.loadInDate) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      performanceStart: body.performanceStart ? new Date(body.performanceStart) : null,
      performanceEnd: body.performanceEnd ? new Date(body.performanceEnd) : null,
      notes: body.notes ?? null,
    },
    include: { venue: { select: { id: true, name: true, city: true, capacity: true } } },
  });
  return NextResponse.json(stop, { status: 201 });
}
