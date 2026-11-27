import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseShowReportPdf, type ParsedReport } from "@/lib/showReportParser";
import { toDate } from "@/lib/parse";
import { loadBase64 } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret");
  const isCron = cronSecret && authHeader === cronSecret;
  if (!session && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callerRole = (session?.user as { role?: string } | undefined)?.role;
  if (!isCron && callerRole !== "admin" && callerRole !== "member") {
    return NextResponse.json({ error: "Only PSG staff can run the report import" }, { status: 403 });
  }

  const MAX_PER_RUN = 4;

  // Find records that have a stored PDF but no attendance data (incomplete parse)
  const incomplete = await prisma.showReport.findMany({
    where: {
      OR: [{ rawPdf: { not: null } }, { pdfKey: { not: null } }],
      attendance: null,
    },
    select: {
      id: true,
      emailSubject: true,
      performanceNumber: true,
      venue: true,
      reportDate: true,
      rawPdf: true,
      pdfKey: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
    take: MAX_PER_RUN,
  });

  if (incomplete.length === 0) {
    return NextResponse.json({ message: "Nothing to reparse", reparsed: 0 });
  }

  const results: { id: number; subject: string | null; status: string; parsed?: ParsedReport }[] = [];

  // Parse in parallel so four PDFs fit comfortably inside Railway's 60s request limit
  await Promise.all(incomplete.map(async record => {
    try {
      const pdf = await loadBase64(record.pdfKey, record.rawPdf);
      if (!pdf) { results.push({ id: record.id, subject: record.emailSubject, status: "no_pdf" }); return; }
      const parsed = await parseShowReportPdf(pdf, { subject: record.emailSubject ?? "", receivedAt: record.createdAt });
      console.log(`[reparse] id=${record.id} parsed ${parsed.length} report(s)`);

      // Pick the parsed entry that matches this record's performance number, or first
      const match = parsed.find(p => p.performanceNumber === record.performanceNumber) ?? parsed[0];

      if (!match || (!match.attendance && !match.notes)) {
        results.push({ id: record.id, subject: record.emailSubject, status: "still_empty", parsed: match });
        return;
      }

      await prisma.showReport.update({
        where: { id: record.id },
        data: {
          attendance: match.attendance ?? undefined,
          houseCapacity: match.houseCapacity ?? undefined,
          performance: match.performance ?? undefined,
          runningTime: match.runningTime ?? undefined,
          playingTime: match.playingTime ?? undefined,
          notes: match.notes ?? undefined,
          // Only overwrite venue/date if currently null
          venue: record.venue ?? match.venue ?? undefined,
          reportDate: record.reportDate ?? toDate(match.reportDate),
        },
      });

      results.push({ id: record.id, subject: record.emailSubject, status: "updated", parsed: match });
    } catch (err) {
      results.push({ id: record.id, subject: record.emailSubject, status: `error: ${(err as { message?: string } | null)?.message}` });
    }
  }));

  const remaining = await prisma.showReport.count({
    where: { OR: [{ rawPdf: { not: null } }, { pdfKey: { not: null } }], attendance: null },
  });

  return NextResponse.json({ reparsed: results.length, remaining, results });
}
