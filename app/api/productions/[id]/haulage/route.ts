import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, money, toDate } from "@/lib/parse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "haulage");
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const badDate = missingDates(body, ["departureAt"]);
  if (badDate) return badDate;
  const movement = await prisma.haulageMovement.create({
    data: {
      productionId:   Number(id),
      haulageCompany: body.haulageCompany,
      driverName:     body.driverName || null,
      vehicleInfo:    body.vehicleInfo || null,
      fromLocation:   body.fromLocation,
      toLocation:     body.toLocation,
      departureAt:    toDate(body.departureAt)!,
      arrivalAt:      (toDate(body.arrivalAt) ?? null),
      cargo:          body.cargo || null,
      notes:          body.notes || null,
      estimatedCost:  money(body.estimatedCost),
      actualCost:     body.actualCost != null ? Number(body.actualCost) : null,
      rechargeable:   body.rechargeable ?? false,
      budgetLineId:   body.budgetLineId ? Number(body.budgetLineId) : null,
    },
  });
  return NextResponse.json(movement, { status: 201 });
}
