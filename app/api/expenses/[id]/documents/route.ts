import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const docs = await prisma.productionExpenseDocument.findMany({
    where: { expenseId: Number(id) },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true, mime: true, createdAt: true },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string) ?? "receipt";
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = await file.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");

  const doc = await prisma.productionExpenseDocument.create({
    data: {
      expenseId: Number(id),
      type,
      name: file.name,
      mime: file.type,
      file: base64,
    },
    select: { id: true, type: true, name: true, mime: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
