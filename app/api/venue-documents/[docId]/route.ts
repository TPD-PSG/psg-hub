import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;

  const doc = await prisma.venueDocument.findUnique({ where: { id: Number(docId) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(doc.file, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  await prisma.venueDocument.delete({ where: { id: Number(docId) } });
  return NextResponse.json({ ok: true });
}
