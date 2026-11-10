import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const invoice = await prisma.companyInvoice.update({
    where: { id: Number(id) },
    data: {
      type: body.type ?? undefined,
      reference: body.reference ?? undefined,
      description: body.description ?? undefined,
      party: body.party ?? undefined,
      production: body.production ?? undefined,
      netAmount: body.netAmount !== undefined ? Number(body.netAmount) : undefined,
      vatAmount: body.vatAmount !== undefined ? Number(body.vatAmount) : undefined,
      issueDate: body.issueDate ? new Date(body.issueDate) : body.issueDate === "" ? null : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === "" ? null : undefined,
      status: body.status ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.companyInvoice.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
