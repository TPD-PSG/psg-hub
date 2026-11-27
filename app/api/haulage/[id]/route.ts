import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { money, toDate } from "@/lib/parse";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("haulage", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { haulageCompany: "The haulage company can't be blank", fromLocation: "Where it's from can't be blank", toLocation: "Where it's going can't be blank" });
  if (blank) return blank;
  const movement = await prisma.haulageMovement.update({
    where: { id: Number(id) },
    data: {
      haulageCompany: body.haulageCompany,
      driverName:     body.driverName || null,
      vehicleInfo:    body.vehicleInfo || null,
      fromLocation:   body.fromLocation,
      toLocation:     body.toLocation,
      departureAt:    toDate(body.departureAt),
      arrivalAt:      (toDate(body.arrivalAt) ?? null),
      cargo:          body.cargo || null,
      notes:          body.notes || null,
      estimatedCost:  money(body.estimatedCost),
      actualCost:     body.actualCost != null ? Number(body.actualCost) : null,
      rechargeable:   body.rechargeable ?? false,
      budgetLineId:   body.budgetLineId ? Number(body.budgetLineId) : null,
    },
  });
  return NextResponse.json(movement);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("haulage", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const movement = await prisma.haulageMovement.update({
    where: { id: Number(id) },
    data: {
      ...(body.invoicedToClient !== undefined && { invoicedToClient: Boolean(body.invoicedToClient) }),
    },
  });
  return NextResponse.json(movement);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("haulage", id);
  if ("error" in rec) return rec.error;
  await prisma.haulageMovement.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
