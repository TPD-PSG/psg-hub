import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse";
import { removeFile } from "@/lib/storage";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("showReport", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));
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
  const removed = await prisma.showReport.delete({ where: { id: Number(id) }, select: { pdfKey: true } });
  // The PDF may be shared with a sibling report from the same email (matinee + evening)
  if (removed.pdfKey && !(await prisma.showReport.count({ where: { pdfKey: removed.pdfKey } }))) {
    await removeFile(removed.pdfKey);
  }
  return NextResponse.json({ ok: true });
}
