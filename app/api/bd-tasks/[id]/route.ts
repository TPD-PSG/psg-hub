// Change or remove a follow-up task on a BD deal: only on deals in a company the person can see
// (the same check as the rest of BD; audit round 2).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { denyOutOfScope } from "@/lib/companyScope";

async function findTask(rawId: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const task = await prisma.bDTask.findUnique({ where: { id: parseInt(rawId) || 0 }, select: { id: true, opportunityId: true } });
  if (!task) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const out = await denyOutOfScope("opportunity", task.opportunityId);
  if (out) return { error: out };
  return { task };
}
const dateOrNull = (v: unknown) => (v && !Number.isNaN(new Date(v as string).getTime()) ? new Date(v as string) : null);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = await findTask((await params).id);
  if ("error" in f) return f.error;
  const data = await req.json().catch(() => ({}));
  const task = await prisma.bDTask.update({
    where: { id: f.task.id },
    data: {
      description: typeof data.description === "string" ? data.description : undefined,
      dueDate: "dueDate" in data ? dateOrNull(data.dueDate) : undefined,
      completedAt: data.completedAt !== undefined ? dateOrNull(data.completedAt) : undefined,
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = await findTask((await params).id);
  if ("error" in f) return f.error;
  await prisma.bDTask.delete({ where: { id: f.task.id } });
  return NextResponse.json({ ok: true });
}
