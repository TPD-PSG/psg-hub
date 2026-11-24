// Log days on a job. Staff log their own; admins can log for someone else. The person's day rate
// is copied onto the entry, so changing a rate later doesn't rewrite past jobs.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const jobId = parseInt((await params).id);
  const body = await req.json();
  const days = Number(body.days);
  if (!Number.isFinite(days) || days <= 0 || days > 31 || Math.round(days * 2) !== days * 2) return NextResponse.json({ error: "Days in halves, e.g. 0.5, 1, 1.5" }, { status: 400 });
  if (typeof body.date !== "string" || !body.date) return NextResponse.json({ error: "Which day?" }, { status: 400 });
  const userId = body.userId && Number(body.userId) !== v.userId ? Number(body.userId) : v.userId;
  if (userId !== v.userId && v.role !== "admin") return NextResponse.json({ error: "You can only log your own time" }, { status: 403 });
  const [job, user] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { costDayRate: true } }),
  ]);
  if (!job || !user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const entry = await prisma.timeEntry.create({
    data: { jobId, userId, date: new Date(body.date), days, dayRate: user.costDayRate, note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null },
  });
  return NextResponse.json({ ...entry, dayRate: v.seeMoney ? entry.dayRate : null }, { status: 201 });
}
