import { NextRequest, NextResponse } from "next/server";
import { fileHeaders } from "@/lib/fileHeaders";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { loadFile, removeFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;

  const doc = await prisma.venueDocument.findUnique({ where: { id: Number(docId) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await loadFile(doc.fileKey, doc.file);
  if (!buffer) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buffer, {
    headers: {
      ...fileHeaders(doc.mime, doc.name, {}, { download: true }),
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  const removed = await prisma.venueDocument.delete({ where: { id: Number(docId) }, select: { fileKey: true } });
  await removeFile(removed.fileKey);
  return NextResponse.json({ ok: true });
}
