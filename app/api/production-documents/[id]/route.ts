import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function GET(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("productionDocument", id);
  if ("error" in rec) return rec.error;
  const doc = await prisma.productionDocument.findUnique({ where: { id: Number(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = Buffer.from(doc.data, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${doc.name}"`,
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
  await prisma.productionDocument.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
