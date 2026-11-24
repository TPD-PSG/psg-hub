import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; costId: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Only directors, BD and finance" }, { status: 403 });
  const { id, costId } = await params;
  const { count } = await prisma.jobCost.deleteMany({ where: { id: parseInt(costId), jobId: parseInt(id) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
