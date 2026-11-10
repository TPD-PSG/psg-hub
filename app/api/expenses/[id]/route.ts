import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const expense = await prisma.productionExpense.update({
    where: { id: Number(id) },
    data: {
      production: body.production ?? undefined,
      category: body.category ?? undefined,
      description: body.description ?? undefined,
      supplier: body.supplier ?? undefined,
      netAmount: body.netAmount !== undefined ? Number(body.netAmount) : undefined,
      vatAmount: body.vatAmount !== undefined ? Number(body.vatAmount) : undefined,
      date: body.date ? new Date(body.date) : body.date === "" ? null : undefined,
      paymentMethod: body.paymentMethod ?? undefined,
      status: body.status ?? undefined,
      reference: body.reference ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.productionExpense.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
