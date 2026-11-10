import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expenses = await prisma.productionExpense.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const expense = await prisma.productionExpense.create({
    data: {
      production: body.production || null,
      category: body.category || "misc",
      description: body.description,
      supplier: body.supplier || null,
      netAmount: Number(body.netAmount) || 0,
      vatAmount: Number(body.vatAmount) || 0,
      date: body.date ? new Date(body.date) : null,
      paymentMethod: body.paymentMethod || "to_pay",
      status: body.status || "pending",
      reference: body.reference || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(expense);
}
