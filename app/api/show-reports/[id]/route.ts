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
  const rec = await requireRecordAccess("showReport", id);
  if ("error" in rec) return rec.error;
  const body = await req.json();
  const report = await prisma.showReport.update({
    where: { id: Number(id) },
    data: {
      reportDate: toDate(body.reportDate),
      venue: body.venue || null,
      performance: body.performance || null,
      attendance: body.attendance ? Number(body.attendance) : null,
      notes: body.notes || null,
    },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(report);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("showReport", id);
  if ("error" in rec) return rec.error;
  await prisma.showReport.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
