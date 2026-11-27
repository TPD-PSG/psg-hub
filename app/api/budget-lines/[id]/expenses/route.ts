import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { money, toDate } from "@/lib/parse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetLine", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { description: "Say what the expense was for" });
  if (bad) return bad;
  const expense = await prisma.expense.create({
    data: {
      budgetLineId:     Number(id),
      phase:            body.phase || "Capitalisation",
      description:      body.description,
      estimated:        (money(body.estimated) ?? 0),
      committed:        (money(body.committed) ?? 0),
      spent:            (money(body.spent) ?? 0),
      poNumber:         body.poNumber || null,
      paymentDue:       (toDate(body.paymentDue) ?? null),
      issuedForPayment: body.issuedForPayment ?? false,
      vatExempt:        body.vatExempt ?? false,
      supplier:         body.supplier || null,
      notes:            body.notes || null,
      approvedBy:       body.approvedBy || null,
      approvedDate:     (toDate(body.approvedDate) ?? null),
      approvalMethod:   body.approvalMethod || null,
      isPSGExpense:     body.isPSGExpense ?? false,
      paymentMethod:    body.paymentMethod || null,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}
