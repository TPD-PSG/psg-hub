import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  const doc = await prisma.productionExpenseDocument.findUnique({ where: { id: Number(docId) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = Buffer.from(doc.file, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename="${doc.name}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  await prisma.productionExpenseDocument.delete({ where: { id: Number(docId) } });
  return NextResponse.json({ ok: true });
}
