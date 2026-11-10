import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoices = await prisma.companyInvoice.findMany({ orderBy: { dueDate: "asc" } });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const invoice = await prisma.companyInvoice.create({
    data: {
      type: body.type,
      reference: body.reference || null,
      description: body.description,
      party: body.party,
      production: body.production || null,
      netAmount: Number(body.netAmount) || 0,
      vatAmount: Number(body.vatAmount) || 0,
      issueDate: body.issueDate ? new Date(body.issueDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status || "draft",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(invoice);
}
