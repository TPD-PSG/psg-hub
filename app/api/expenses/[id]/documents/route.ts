import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expenseOwnerAccess } from "@/lib/expenseAccess";
import { saveFile } from "@/lib/storage";

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/gif", "image/webp",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await expenseOwnerAccess((await params).id); // the submitter or an admin
  if ("error" in a) return a.error;
  const id = a.expenseId;
  const docs = await prisma.productionExpenseDocument.findMany({
    where: { expenseId: Number(id) },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true, mime: true, createdAt: true },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await expenseOwnerAccess((await params).id); // the submitter or an admin
  if ("error" in a) return a.error;
  const id = a.expenseId;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string) ?? "receipt";
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const stored = await saveFile("expense-documents", file.name, await file.arrayBuffer(), file.type);

  const doc = await prisma.productionExpenseDocument.create({
    data: {
      expenseId: Number(id),
      type,
      name: file.name,
      mime: file.type,
      file: stored.base64 ?? "",
      fileKey: stored.key,
    },
    select: { id: true, type: true, name: true, mime: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
