import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reports = await prisma.showReport.findMany({
    where: { productionId: Number(id) },
    include: { createdByUser: { select: { id: true, name: true } } },
    orderBy: { reportDate: "desc" },
  });
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : undefined;
  const body = await req.json();
  const report = await prisma.showReport.create({
    data: {
      productionId: Number(id),
      reportDate: new Date(body.reportDate),
      venue: body.venue || null,
      performance: body.performance || null,
      attendance: body.attendance ? Number(body.attendance) : null,
      notes: body.notes || null,
      createdByUserId: userId ?? null,
    },
    include: { createdByUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json(report, { status: 201 });
}
