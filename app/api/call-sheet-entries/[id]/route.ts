import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("callSheetEntry", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const entry = await prisma.callSheetEntry.update({
    where: { id: Number(id) },
    data: {
      discipline: body.discipline ?? undefined,
      name: body.name ?? undefined,
      role: body.role ?? undefined,
      callTime: body.callTime ?? undefined,
      notes: body.notes ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("callSheetEntry", id);
  if ("error" in rec) return rec.error;
  await prisma.callSheetEntry.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
