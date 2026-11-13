import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const expense = await prisma.expense.update({
    where: { id: Number(id) },
    data: {
      phase:            body.phase || "Capitalisation",
      description:      body.description,
      estimated:        Number(body.estimated) || 0,
      committed:        Number(body.committed) || 0,
      spent:            Number(body.spent) || 0,
      poNumber:         body.poNumber || null,
      paymentDue:       body.paymentDue ? new Date(body.paymentDue) : null,
      issuedForPayment: body.issuedForPayment ?? false,
      vatExempt:        body.vatExempt ?? false,
      supplier:         body.supplier || null,
      notes:            body.notes || null,
      approvedBy:       body.approvedBy || null,
      approvedDate:     body.approvedDate ? new Date(body.approvedDate) : null,
      approvalMethod:   body.approvalMethod || null,
      isPSGExpense:     body.isPSGExpense ?? false,
      paymentMethod:    body.paymentMethod || null,
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.expense.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
