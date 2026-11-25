import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const { id, linkId } = await params;
  const { count } = await prisma.jobLink.deleteMany({ where: { id: parseInt(linkId), jobId: parseInt(id) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
