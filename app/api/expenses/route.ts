import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role;

  const where = role === "admin" ? {} : { submittedByUserId: userId };

  const expenses = await prisma.productionExpense.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      productionLink: { select: { id: true, name: true } },
      submittedByUser: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const body = await req.json();

  const expense = await prisma.productionExpense.create({
    data: {
      production: body.production || null,
      productionId: body.productionId ? Number(body.productionId) : null,
      submittedByUserId: userId,
      category: body.category || "misc",
      description: body.description,
      supplier: body.supplier || null,
      netAmount: Number(body.netAmount) || 0,
      vatAmount: Number(body.vatAmount) || 0,
      date: body.date ? new Date(body.date) : null,
      paymentMethod: body.paymentMethod || "to_pay",
      status: "pending",
      reference: body.reference || null,
      notes: body.notes || null,
    },
    include: {
      productionLink: { select: { id: true, name: true } },
      submittedByUser: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(expense);
}
