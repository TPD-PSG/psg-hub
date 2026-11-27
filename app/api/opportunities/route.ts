import { myCompanyLimit, entityWhere, scopedEntityId } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { OPPORTUNITY_INCLUDE, opportunityData, shapeOpportunity } from "@/lib/opportunities";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const opportunities = await prisma.opportunity.findMany({ where: entityWhere(await myCompanyLimit()), include: OPPORTUNITY_INCLUDE, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(opportunities.map(shapeOpportunity));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = Number((session.user as { id?: string }).id) || null;
  const data = opportunityData(await req.json());
  if (!data.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const ent = scopedEntityId(await myCompanyLimit(), (data.entityId as number | null | undefined) ?? null);
  if ("error" in ent) return NextResponse.json({ error: ent.error }, { status: 400 });
  if (ent.entityId != null) data.entityId = ent.entityId;
  const opp = await prisma.opportunity.create({
    data: {
      type: "production",
      stage: "lead",
      ...data,
      ownerUserId: (data.ownerUserId as number | null | undefined) ?? userId, // whoever adds a deal owns it unless they pick someone
      title: data.title as string,
      activities: { create: { kind: "stage", text: "Deal added", userId } },
    },
    include: OPPORTUNITY_INCLUDE,
  });
  return NextResponse.json(shapeOpportunity(opp), { status: 201 });
}
