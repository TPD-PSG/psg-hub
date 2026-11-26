import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { loadFile, removeFile } from "@/lib/storage";

export async function GET(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("hsDocument", id);
  if ("error" in rec) return rec.error;
  const doc = await prisma.hSDocument.findUnique({ where: { id: Number(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await loadFile(doc.fileKey, doc.data);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename="${doc.name}"`,
    },
  });
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("hsDocument", id);
  if ("error" in rec) return rec.error;
  const removed = await prisma.hSDocument.delete({ where: { id: Number(id) }, select: { fileKey: true } });
  await removeFile(removed.fileKey);
  return NextResponse.json({ ok: true });
}

// Set (or clear) when a risk assessment or method statement is due for review
export async function PATCH(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await requireRecordAccess("hsDocument", id);
  if ("error" in rec) return rec.error;
  if (rec.role !== "admin" && rec.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const reviewDate = body.reviewDate && !Number.isNaN(new Date(body.reviewDate).getTime()) ? new Date(body.reviewDate) : null;
  const doc = await prisma.hSDocument.update({ where: { id: Number(id) }, data: { reviewDate }, select: { id: true, reviewDate: true } });
  return NextResponse.json(doc);
}
