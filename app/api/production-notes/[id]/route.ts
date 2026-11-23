import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const { id } = await params;
  const rec = await requireRecordAccess("productionNote", id);
  if ("error" in rec) return rec.error;
  const existing = await prisma.productionNote.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdByUserId !== userId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const note = await prisma.productionNote.update({
    where: { id: Number(id) },
    data: {
      title: body.title !== undefined ? body.title : undefined,
      body: body.body !== undefined ? body.body : undefined,
      color: body.color !== undefined ? (body.color || null) : undefined,
    },
    include: { createdByUser: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return NextResponse.json(note);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const { id } = await params;
  const rec = await requireRecordAccess("productionNote", id);
  if ("error" in rec) return rec.error;
  const existing = await prisma.productionNote.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 403 });
  if (existing.createdByUserId !== userId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.productionNote.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
