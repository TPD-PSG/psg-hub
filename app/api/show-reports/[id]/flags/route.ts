import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rec = await requireRecordAccess("showReport", id);

  if ("error" in rec) return rec.error;
  const reportId = parseInt(id);
  if (isNaN(reportId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { flags } = await req.json() as { flags: string[] };
  if (!Array.isArray(flags)) return NextResponse.json({ error: "flags must be an array" }, { status: 400 });

  const report = await prisma.showReport.update({
    where: { id: reportId },
    data: { flags: JSON.stringify(flags) },
    select: { id: true, flags: true },
  });

  return NextResponse.json({ id: report.id, flags: report.flags ? JSON.parse(report.flags) : [] });
}
