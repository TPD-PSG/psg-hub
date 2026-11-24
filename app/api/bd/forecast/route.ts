// Director revenue forecast: confirmed, weighted pipeline and target by entity and month.
// Admins only, like the Director page. ?year=2027 (defaults to this year).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildForecast } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const now = new Date();
  const asked = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : now.getUTCFullYear();

  const [entities, productions, deals] = await Promise.all([
    prisma.entity.findMany({ select: { id: true, name: true, archived: true, sortOrder: true, targets: { select: { year: true, amount: true } } } }),
    prisma.production.findMany({
      where: { OR: [{ pmFee: { not: null } }, { feeStages: { some: {} } }] },
      select: { id: true, entityId: true, startDate: true, pmFee: true, feeStages: { select: { amount: true, dueDate: true, paidAt: true } } },
    }),
    prisma.opportunity.findMany({
      where: { stage: { not: "lost" } },
      select: { id: true, entityId: true, stage: true, value: true, probability: true, closeDate: true, stageChangedAt: true, updatedAt: true, productionId: true },
    }),
  ]);
  return NextResponse.json(buildForecast({ entities, productions, deals }, year, now));
}
