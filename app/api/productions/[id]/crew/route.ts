import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "crew");
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { crewId: "Pick a crew member" });
  if (bad) return bad;
  const link = await prisma.productionCrew.create({
    data: {
      productionId: Number(id),
      crewId:       Number(body.crewId),
      role:         body.role || null,
      startDate:    (toDate(body.startDate) ?? null),
      endDate:      (toDate(body.endDate) ?? null),
      dayRate:      body.dayRate ? Number(body.dayRate) : null,
      notes:        body.notes || null,
    },
    include: { crew: true },
  });
  return NextResponse.json(link, { status: 201 });
}
