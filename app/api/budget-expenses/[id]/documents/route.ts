import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await prisma.spendDocument.findMany({
    where: { expenseId: Number(id) },
    select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, issuedForPayment: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const type = (formData.get("type") as string) || "quote";
  const invoiceDateRaw = formData.get("invoiceDate") as string | null;
  const invoiceAmountRaw = formData.get("invoiceAmount") as string | null;
  const issuedForPayment = formData.get("issuedForPayment") === "true";

  const doc = await prisma.spendDocument.create({
    data: {
      expenseId: Number(id),
      type,
      name: file.name,
      mime: file.type,
      file: base64,
      invoiceDate: invoiceDateRaw ? new Date(invoiceDateRaw) : null,
      invoiceAmount: invoiceAmountRaw ? Number(invoiceAmountRaw) : null,
      issuedForPayment,
    },
    select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, issuedForPayment: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
