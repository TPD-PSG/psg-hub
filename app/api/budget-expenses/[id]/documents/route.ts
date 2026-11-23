import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { saveFile } from "@/lib/storage";

const DOC_SELECT = { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true, createdAt: true };
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetExpense", id);
  if ("error" in rec) return rec.error;
  const docs = await prisma.spendDocument.findMany({
    where: { expenseId: Number(id) },
    select: DOC_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetExpense", id);
  if ("error" in rec) return rec.error;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const stored = await saveFile("spend-documents", file.name, await file.arrayBuffer(), file.type);
  const type = (formData.get("type") as string) || "quote";
  const invoiceDateRaw = formData.get("invoiceDate") as string | null;
  const invoiceAmountRaw = formData.get("invoiceAmount") as string | null;
  const invoiceNumberRaw = formData.get("invoiceNumber") as string | null;
  const issuedForPayment = formData.get("issuedForPayment") === "true";

  const doc = await prisma.spendDocument.create({
    data: {
      expenseId: Number(id),
      type,
      name: file.name,
      mime: file.type,
      file: stored.base64 ?? "",
      fileKey: stored.key,
      invoiceDate: invoiceDateRaw ? new Date(invoiceDateRaw) : null,
      invoiceAmount: invoiceAmountRaw ? Number(invoiceAmountRaw) : null,
      invoiceNumber: invoiceNumberRaw || null,
      issuedForPayment,
    },
    select: DOC_SELECT,
  });
  return NextResponse.json(doc, { status: 201 });
}
