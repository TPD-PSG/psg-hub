import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rec = await requireRecordAccess("showReport", id);

  if ("error" in rec) return rec.error;
  const report = await prisma.showReport.findUnique({
    where: { id: parseInt(id) },
    select: { rawPdf: true, emailSubject: true, reportDate: true, performanceNumber: true },
  });

  if (!report?.rawPdf) return NextResponse.json({ error: "No PDF available" }, { status: 404 });

  const buffer = Buffer.from(report.rawPdf, "base64");
  const filename = report.emailSubject
    ? report.emailSubject.replace(/\.pdf$/i, "") + ".pdf"
    : `show-report-${report.performanceNumber ?? id}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
