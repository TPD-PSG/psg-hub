// Tick, untick, reword or remove a build check. PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { denyOutOfScope } from "@/lib/companyScope";
import { CHECK_SELECT } from "@/lib/buildChecks";

type P = { params: Promise<{ id: string; checkId: string }> };
const find = async (params: P["params"]) => {
  const { id, checkId } = await params;
  return prisma.buildCheck.findFirst({ where: { id: parseInt(checkId), jobId: parseInt(id) }, select: { id: true, done: true } });
};

export async function PATCH(req: Request, { params }: P) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const c = await find(params);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.done === "boolean" && body.done !== c.done) Object.assign(data, body.done ? { done: true, doneById: v.userId, doneAt: new Date() } : { done: false, doneById: null, doneAt: null });
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim().slice(0, 300);
  return NextResponse.json(await prisma.buildCheck.update({ where: { id: c.id }, data, select: CHECK_SELECT }));
}

export async function DELETE(_req: Request, { params }: P) {
  const outOfScope = await denyOutOfScope("job", (await params).id);
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const c = await find(params);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.buildCheck.delete({ where: { id: c.id } });
  return NextResponse.json({ ok: true });
}
