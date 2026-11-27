import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireProductionAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const productionId = Number(searchParams.get("productionId"));
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });
  const access = await requireProductionAccess(productionId, "budget");
  if ("error" in access) return access.error;

  const variations = await prisma.budgetVariation.findMany({
    where: { productionId },
    include: {
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: { include: { budgetLine: { select: { id: true, department: true, description: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(variations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id?: string })?.id);
  const body = await req.json().catch(() => ({}));
  const { productionId, type, title, justification, clientRef, notes, items } = body;
  if (!productionId || !type || !title) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  const access = await requireProductionAccess(productionId, "budget");
  if ("error" in access) return access.error;

  const variation = await prisma.budgetVariation.create({
    data: {
      productionId,
      type,
      title,
      justification: justification || null,
      clientRef: clientRef || null,
      notes: notes || null,
      status: "draft",
      requestedById: userId || null,
      items: {
        create: (items || []).map((item: { budgetLineId: number; amount: number; note?: string }) => ({
          budgetLineId: item.budgetLineId,
          amount: item.amount,
          note: item.note || null,
        })),
      },
    },
    include: {
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: { include: { budgetLine: { select: { id: true, department: true, description: true } } } },
    },
  });
  return NextResponse.json(variation);
}
