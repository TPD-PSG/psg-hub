import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money, toDate } from "@/lib/parse";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoices = await prisma.companyInvoice.findMany({ orderBy: { dueDate: "asc" } });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { type: "Say whether it's a sales or purchase invoice", party: "Who's the invoice with?", description: "Add a description" });
  if (bad) return bad;
  const invoice = await prisma.companyInvoice.create({
    data: {
      type: body.type,
      reference: body.reference || null,
      description: body.description,
      party: body.party,
      production: body.production || null,
      netAmount: (money(body.netAmount) ?? 0),
      vatAmount: (money(body.vatAmount) ?? 0),
      issueDate: (toDate(body.issueDate) ?? null),
      dueDate: (toDate(body.dueDate) ?? null),
      status: body.status || "draft",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(invoice);
}
