import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const { id } = await params;

  // Non-admins can only edit their own pending expenses
  if (role !== "admin") {
    const existing = await prisma.productionExpense.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.submittedByUserId !== userId || existing.status !== "pending") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const expense = await prisma.productionExpense.update({
    where: { id: Number(id) },
    data: {
      production: body.production ?? undefined,
      productionId: body.productionId !== undefined ? (body.productionId ? Number(body.productionId) : null) : undefined,
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
    include: {
      productionLink: { select: { id: true, name: true } },
      submittedByUser: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const { id } = await params;

  if (role !== "admin") {
    const existing = await prisma.productionExpense.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.submittedByUserId !== userId || existing.status !== "pending") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.productionExpense.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
