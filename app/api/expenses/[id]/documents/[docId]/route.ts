import { NextRequest, NextResponse } from "next/server";
import { fileHeaders } from "@/lib/fileHeaders";
import { prisma } from "@/lib/prisma";
import { expenseOwnerAccess } from "@/lib/expenseAccess";
import { loadFile, removeFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const a = await expenseOwnerAccess(id); // the submitter or an admin
  if ("error" in a) return a.error;
  const doc = await prisma.productionExpenseDocument.findFirst({ where: { id: Number(docId) || 0, expenseId: a.expenseId } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await loadFile(doc.fileKey, doc.file);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      ...fileHeaders(doc.mime, doc.name, { "Cache-Control": "private, max-age=86400" }),
    },
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const a = await expenseOwnerAccess(id); // the submitter or an admin
  if ("error" in a) return a.error;
  const doc = await prisma.productionExpenseDocument.findFirst({ where: { id: Number(docId) || 0, expenseId: a.expenseId }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const removed = await prisma.productionExpenseDocument.delete({ where: { id: doc.id }, select: { fileKey: true } });
  await removeFile(removed.fileKey);
  return NextResponse.json({ ok: true });
}
