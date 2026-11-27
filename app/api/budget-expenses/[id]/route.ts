import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { money, toDate } from "@/lib/parse";
import { removeFile } from "@/lib/storage";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("budgetExpense", id);

  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { description: "The description can't be blank" });
  if (blank) return blank;
  const expense = await prisma.expense.update({
    where: { id: Number(id) },
    data: {
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
  return NextResponse.json(expense);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetExpense", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const expense = await prisma.expense.update({
    where: { id: Number(id) },
    data: {
      ...(body.invoicedToClient !== undefined && { invoicedToClient: Boolean(body.invoicedToClient) }),
    },
  });
  return NextResponse.json(expense);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("budgetExpense", id);

  if ("error" in rec) return rec.error;
  // Its receipts go with it; note the R2 files first
  const docs = await prisma.spendDocument.findMany({ where: { expenseId: Number(id) }, select: { fileKey: true } });
  await prisma.expense.delete({ where: { id: Number(id) } });
  for (const d of docs) await removeFile(d.fileKey);
  return NextResponse.json({ ok: true });
}
