import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const stop = await prisma.tourStop.update({
    where: { id: Number(id) },
    data: {
      venueId: body.venueId ? Number(body.venueId) : undefined,
      stopNumber: body.stopNumber != null ? Number(body.stopNumber) : undefined,
      loadInDate: body.loadInDate !== undefined ? (body.loadInDate ? new Date(body.loadInDate) : null) : undefined,
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
      endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      performanceStart: body.performanceStart !== undefined ? (body.performanceStart ? new Date(body.performanceStart) : null) : undefined,
      performanceEnd: body.performanceEnd !== undefined ? (body.performanceEnd ? new Date(body.performanceEnd) : null) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
    include: { venue: { select: { id: true, name: true, city: true } } },
  });
  return NextResponse.json(stop);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.tourStop.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
