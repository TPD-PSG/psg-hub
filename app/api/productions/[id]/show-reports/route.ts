import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reports = await prisma.showReport.findMany({
    where: { productionId: Number(id) },
    select: {
      id: true, productionId: true, reportDate: true, venue: true, performance: true,
      performanceNumber: true, attendance: true, houseCapacity: true,
      runningTime: true, playingTime: true, notes: true, flags: true,
      emailSubject: true, emailFrom: true, productionMatched: true,
      rawPdf: true,
      createdByUser: { select: { id: true, name: true } },
      createdAt: true, updatedAt: true,
    },
    orderBy: [{ performanceNumber: "desc" }, { reportDate: "desc" }],
  });
  // Strip rawPdf content but keep a hasPdf boolean to avoid sending MBs of base64
  const sanitised = reports.map(r => ({ ...r, rawPdf: r.rawPdf ? true : false }));
  return NextResponse.json(sanitised);
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
