import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { afterBudgetChange } from "@/lib/budgetAlerts";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("tourStop", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const stop = await prisma.tourStop.update({
    where: { id: Number(id) },
    data: {
      venueId: body.venueId ? Number(body.venueId) : undefined,
      stopNumber: body.stopNumber != null ? Number(body.stopNumber) : undefined,
      loadInDate: body.loadInDate !== undefined ? ((toDate(body.loadInDate) ?? null)) : undefined,
      startDate: body.startDate !== undefined ? ((toDate(body.startDate) ?? null)) : undefined,
      endDate: body.endDate !== undefined ? ((toDate(body.endDate) ?? null)) : undefined,
      performanceStart: body.performanceStart !== undefined ? ((toDate(body.performanceStart) ?? null)) : undefined,
      performanceEnd: body.performanceEnd !== undefined ? ((toDate(body.performanceEnd) ?? null)) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      advancingStatus: body.advancingStatus !== undefined ? body.advancingStatus : undefined,
      contraEstimate: body.contraEstimate !== undefined ? (body.contraEstimate === null ? null : Number(body.contraEstimate)) : undefined,
      contraActual: body.contraActual !== undefined ? (body.contraActual === null ? null : Number(body.contraActual)) : undefined,
    },
    include: { venue: { select: { id: true, name: true, city: true } } },
  });
  if (body.contraActual !== undefined) await afterBudgetChange(stop.productionId);
  return NextResponse.json(stop);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("tourStop", id);
  if ("error" in rec) return rec.error;
  const gone = await prisma.tourStop.delete({ where: { id: Number(id) }, select: { productionId: true } });
  await afterBudgetChange(gone.productionId);
  return NextResponse.json({ ok: true });
}
