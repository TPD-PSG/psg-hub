import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const report = await prisma.showReport.update({
    where: { id: Number(id) },
    data: {
      reportDate: new Date(body.reportDate),
      venue: body.venue || null,
      performance: body.performance || null,
      attendance: body.attendance ? Number(body.attendance) : null,
      notes: body.notes || null,
    },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(report);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.showReport.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
