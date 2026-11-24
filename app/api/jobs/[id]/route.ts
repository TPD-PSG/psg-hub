import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobFields, loadJob, requireJobViewer } from "@/lib/jobData";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const j = await loadJob(parseInt((await params).id), v);
  return j ? NextResponse.json({ seeMoney: v.seeMoney, job: j }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Only directors, BD and finance can change jobs" }, { status: 403 });
  const id = parseInt((await params).id);
  const ok = await prisma.job.update({ where: { id }, data: jobFields(await req.json()) }).catch(() => null);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ seeMoney: true, job: await loadJob(id, v) });
}

// Admins only; its time and costs go with it
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (v.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { count } = await prisma.job.deleteMany({ where: { id: parseInt((await params).id) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
