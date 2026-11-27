import { NextRequest, NextResponse } from "next/server";
import { fileHeaders } from "@/lib/fileHeaders";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { loadFile, removeFile } from "@/lib/storage";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rec = await requireRecordAccess("spendDocument", id);

  if ("error" in rec) return rec.error;
  const doc = await prisma.spendDocument.findUnique({ where: { id: Number(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = await loadFile(doc.fileKey, doc.file);
  if (!buffer) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buffer, {
    headers: {
      ...fileHeaders(doc.mime, doc.name, {}, { download: true }),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("spendDocument", id);

  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const doc = await prisma.spendDocument.update({
    where: { id: Number(id) },
    data: {
      invoiceDate: (toDate(body.invoiceDate) ?? null),
      invoiceAmount: body.invoiceAmount != null ? Number(body.invoiceAmount) : null,
      invoiceNumber: body.invoiceNumber !== undefined ? (body.invoiceNumber || null) : undefined,
      issuedForPayment: body.issuedForPayment ?? false,
    },
    select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true, createdAt: true },
  });
  return NextResponse.json(doc);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("spendDocument", id);

  if ("error" in rec) return rec.error;
  const removed = await prisma.spendDocument.delete({ where: { id: Number(id) }, select: { fileKey: true } });
  await removeFile(removed.fileKey);
  return NextResponse.json({ ok: true });
}
