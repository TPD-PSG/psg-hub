import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money, toDate } from "@/lib/parse";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { description: "The description can't be blank", party: "Who it's with can't be blank" });
  if (blank) return blank;
  const invoice = await prisma.companyInvoice.update({
    where: { id: Number(id) },
    data: {
      type: body.type ?? undefined,
      reference: body.reference ?? undefined,
      description: body.description ?? undefined,
      party: body.party ?? undefined,
      production: body.production ?? undefined,
      netAmount: body.netAmount !== undefined ? (money(body.netAmount) ?? 0) : undefined,
      vatAmount: body.vatAmount !== undefined ? (money(body.vatAmount) ?? 0) : undefined,
      issueDate: body.issueDate ? toDate(body.issueDate) : body.issueDate === "" ? null : undefined,
      dueDate: body.dueDate ? toDate(body.dueDate) : body.dueDate === "" ? null : undefined,
      status: body.status ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.companyInvoice.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
