import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse";
import { prisma } from "@/lib/prisma";


export async function PUT(req: Request, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("keyDate", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
  const keyDate = await prisma.productionKeyDate.update({
    where: { id: Number(id) },
    data: {
      type: body.type,
      label: body.label || null,
      startDate: toDate(body.startDate),
      endDate: (toDate(body.endDate) ?? null),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(keyDate);
}

export async function DELETE(_: Request, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("keyDate", id);
  if ("error" in rec) return rec.error;
  await prisma.productionKeyDate.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
