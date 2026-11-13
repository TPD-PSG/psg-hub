import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const movement = await prisma.haulageMovement.update({
    where: { id: Number(id) },
    data: {
      haulageCompany: body.haulageCompany,
      driverName:     body.driverName || null,
      vehicleInfo:    body.vehicleInfo || null,
      fromLocation:   body.fromLocation,
      toLocation:     body.toLocation,
      departureAt:    new Date(body.departureAt),
      arrivalAt:      body.arrivalAt ? new Date(body.arrivalAt) : null,
      cargo:          body.cargo || null,
      notes:          body.notes || null,
      estimatedCost:  body.estimatedCost != null ? Number(body.estimatedCost) : null,
      actualCost:     body.actualCost != null ? Number(body.actualCost) : null,
      rechargeable:   body.rechargeable ?? false,
      budgetLineId:   body.budgetLineId ? Number(body.budgetLineId) : null,
    },
  });
  return NextResponse.json(movement);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.haulageMovement.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
