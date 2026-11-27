import { myCompanyLimit, productionWhere, optionalProductionWhere } from "@/lib/companyScope";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assignments = await prisma.staffAssignment.findMany({
    where: productionWhere(await myCompanyLimit()), // companies they can see
    orderBy: { startDate: "asc" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, color: true } },
      production: { select: { id: true, name: true } },
      tourStop: { select: { id: true, venue: { select: { name: true, city: true } } } },
    },
  });
  return NextResponse.json(assignments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const badDate = missingDates(body, ["startDate", "endDate"]);
  if (badDate) return badDate;
  const access = await requireProductionAccess(body.productionId);
  if ("error" in access) return access.error;
  const assignment = await prisma.staffAssignment.create({
    data: {
      userId: Number(body.userId),
      productionId: Number(body.productionId),
      tourStopId: body.tourStopId ? Number(body.tourStopId) : null,
      startDate: toDate(body.startDate)!,
      endDate: toDate(body.endDate)!,
      activityType: body.activityType || null,
      notes: body.notes || null,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, color: true } },
      production: { select: { id: true, name: true } },
      tourStop: { select: { id: true, venue: { select: { name: true, city: true } } } },
    },
  });
  return NextResponse.json(assignment);
}
