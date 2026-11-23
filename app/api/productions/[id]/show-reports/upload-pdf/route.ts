import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { parseShowReportPdf, type ParsedReport } from "@/lib/showReportParser";
import { ClaudeOutputError } from "@/lib/claude";
import { toDate } from "@/lib/parse";
import { saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "reports");
  if ("error" in access) return access.error;
  const { session } = access;
  const productionId = parseInt(id);
  if (isNaN(productionId)) return NextResponse.json({ error: "Invalid production ID" }, { status: 400 });

  const production = await prisma.production.findUnique({ where: { id: productionId }, select: { id: true, name: true } });
  if (!production) return NextResponse.json({ error: "Production not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("pdf") as File | null;
  if (!file) return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  let parsed: ParsedReport[];
  try {
    parsed = await parseShowReportPdf(base64, { filename: file.name });
  } catch (err) {
    const message = err instanceof ClaudeOutputError ? err.message : "Couldn't read this PDF";
    return NextResponse.json({ error: `${file.name}: ${message}` }, { status: 422 });
  }

  // Store the PDF once (R2 if configured), shared by every report it contains
  const stored = await saveFile("show-reports", file.name, buffer, "application/pdf");

  // A PDF can hold several performances (e.g. matinee + evening): save each one
  const createdBy = (session.user as any)?.id ? parseInt((session.user as any).id) : null;
  const reports = [];
  for (const r of parsed) {
    reports.push(await prisma.showReport.create({
      data: {
        productionId,
        reportDate: toDate(r.reportDate) ?? new Date(),
        venue: r.venue,
        performance: r.performance,
        performanceNumber: r.performanceNumber,
        attendance: r.attendance,
        houseCapacity: r.houseCapacity,
        runningTime: r.runningTime,
        playingTime: r.playingTime,
        notes: r.notes,
        emailSubject: file.name,
        rawPdf: stored.base64,
        pdfKey: stored.key,
        productionMatched: true,
        createdByUserId: createdBy,
      },
      select: { id: true },
    }));
  }

  return NextResponse.json({ reportId: reports[0]?.id, reportIds: reports.map(r => r.id), parsed });
}
