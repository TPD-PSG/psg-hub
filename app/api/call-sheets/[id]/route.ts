import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("callSheet", id);
  if ("error" in rec) return rec.error;
  const sheet = await prisma.callSheet.findUnique({
    where: { id: Number(id) },
    include: { entries: { orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }] } },
  });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sheet);
}

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("callSheet", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const sheet = await prisma.callSheet.update({
    where: { id: Number(id) },
    data: {
      date: toDate(body.date),
      title: body.title ?? undefined,
      venue: body.venue ?? undefined,
      generalNotes: body.generalNotes ?? undefined,
    },
    include: { entries: { orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }] } },
  });
  return NextResponse.json(sheet);
}

export async function DELETE(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("callSheet", id);
  if ("error" in rec) return rec.error;
  await prisma.callSheet.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
