import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("event", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const event = await prisma.event.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      type: body.type,
      startAt: toDate(body.startAt),
      endAt: toDate(body.endAt),
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(event);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("event", id);
  if ("error" in rec) return rec.error;
  await prisma.event.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
