import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { missingDates, toDate } from "@/lib/parse";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "reports");
  if ("error" in access) return access.error;
  const reports = await prisma.showReport.findMany({
    where: { productionId: Number(id) },
    select: {
      id: true, productionId: true, reportDate: true, venue: true, performance: true,
      performanceNumber: true, attendance: true, houseCapacity: true,
      runningTime: true, playingTime: true, notes: true, flags: true,
      emailSubject: true, emailFrom: true, productionMatched: true,
      createdByUser: { select: { id: true, name: true } },
      createdAt: true, updatedAt: true,
    },
    orderBy: [{ performanceNumber: "desc" }, { reportDate: "desc" }],
  });
  // The list only needs to know a PDF exists; don't read every PDF out of the database to find out
  const withPdf = new Set((await prisma.showReport.findMany({
    where: { productionId: Number(id), OR: [{ rawPdf: { not: null } }, { pdfKey: { not: null } }] },
    select: { id: true },
  })).map(r => r.id));
  return NextResponse.json(reports.map(r => ({ ...r, rawPdf: withPdf.has(r.id) })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "reports");
  if ("error" in access) return access.error;
  const userId = access.userId;
  const body = await req.json();
  const badDate = missingDates(body, ["reportDate"]);
  if (badDate) return badDate;
  const report = await prisma.showReport.create({
    data: {
      productionId: Number(id),
      reportDate: toDate(body.reportDate)!,
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
