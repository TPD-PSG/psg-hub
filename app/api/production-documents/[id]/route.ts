import { NextRequest, NextResponse } from "next/server";
import { fileHeaders } from "@/lib/fileHeaders";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { saveFile, loadFile, removeFile } from "@/lib/storage";

export async function GET(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionDocument", id);
  if ("error" in rec) return rec.error;
  const doc = await prisma.productionDocument.findUnique({ where: { id: Number(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = await loadFile(doc.fileKey, doc.data);
  if (!buffer) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buffer, {
    headers: {
      ...fileHeaders(doc.mime, doc.name, {}, { download: true }),
    },
  });
}

export async function PATCH(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionDocument", id);
  if ("error" in rec) return rec.error;
  const body = await req.json();
  const doc = await prisma.productionDocument.update({
    where: { id: Number(id) },
    data: { folder: body.folder },
    select: { id: true, name: true, mime: true, folder: true, createdAt: true },
  });
  return NextResponse.json(doc);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionDocument", id);
  if ("error" in rec) return rec.error;
  const removed = await prisma.productionDocument.delete({ where: { id: Number(id) }, select: { fileKey: true } });
  await removeFile(removed.fileKey);
  return NextResponse.json({ ok: true });
}
