// Mark a snag on one of your builds fixed (or not)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { myJob, myWorkViewer } from "@/lib/myWork";

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const v = await myWorkViewer(slug);
  if ("error" in v) return v.error;
  const snag = await prisma.buildCheck.findFirst({ where: { id: Number(id) || 0, kind: "snag" }, select: { id: true, jobId: true } });
  if (!snag) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const j = await myJob(v, snag.jobId);
  if ("error" in j) return j.error;
  const body = await req.json().catch(() => ({}));
  if (typeof body.done !== "boolean") return NextResponse.json({ error: "Say whether it's fixed" }, { status: 400 });
  const updated = await prisma.buildCheck.update({
    where: { id: snag.id },
    data: body.done ? { done: true, doneById: v.userId, doneAt: new Date() } : { done: false, doneById: null, doneAt: null },
    select: { id: true, text: true, done: true, createdAt: true, createdBy: { select: { name: true } }, doneBy: { select: { name: true } } },
  });
  return NextResponse.json(updated);
}
