// Raise a snag on a build you have a part on
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { myJob, myWorkViewer } from "@/lib/myWork";
import { missing } from "@/lib/required";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; jobId: string }> }) {
  const { slug, jobId } = await params;
  const v = await myWorkViewer(slug);
  if ("error" in v) return v.error;
  const j = await myJob(v, jobId);
  if ("error" in j) return j.error;
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { text: "Say what the snag is" });
  if (bad) return bad;
  const last = await prisma.buildCheck.aggregate({ where: { jobId: j.jobId, kind: "snag" }, _max: { sortOrder: true } });
  const snag = await prisma.buildCheck.create({
    data: { jobId: j.jobId, kind: "snag", text: String(body.text).trim().slice(0, 300), createdById: v.userId, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    select: { id: true, text: true, done: true, createdAt: true, createdBy: { select: { name: true } }, doneBy: { select: { name: true } } },
  });
  return NextResponse.json(snag, { status: 201 });
}
