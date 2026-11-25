import { myCompanyLimit, entityChangeError } from "@/lib/companyScope";
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { stageLabel } from "@/lib/bdPipeline";
import { OPPORTUNITY_INCLUDE, opportunityData, shapeOpportunity } from "@/lib/opportunities";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = Number((session.user as any).id) || null;
  const id = parseInt((await params).id);
  const existing = await prisma.opportunity.findUnique({ where: { id }, select: { stage: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = opportunityData(await req.json());
  const moveErr = entityChangeError(await myCompanyLimit(), data);
  if (moveErr) return NextResponse.json({ error: moveErr }, { status: 400 });

  // A stage change is stamped and logged, so "how long has it sat here" and the history are known
  const stageChanged = typeof data.stage === "string" && data.stage !== existing.stage;
  const opp = await prisma.opportunity.update({
    where: { id },
    data: {
      ...data,
      ...(stageChanged ? {
        stageChangedAt: new Date(),
        activities: { create: { kind: "stage", text: `${stageLabel(existing.stage)} → ${stageLabel(data.stage as string)}`, userId } },
      } : {}),
    },
    include: OPPORTUNITY_INCLUDE,
  });
  return NextResponse.json(shapeOpportunity(opp));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.opportunity.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
