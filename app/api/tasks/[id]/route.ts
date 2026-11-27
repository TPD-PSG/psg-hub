import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("task", id);
  if ("error" in rec) return rec.error;
  const task = await prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      signoffUser: { select: { id: true, name: true, email: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("task", id);
  if ("error" in rec) return rec.error;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.task.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    title, description, taskListId, assigneeUserId, assigneeName,
    status, priority, dueDate, requiresSignoff, signoffUserId, signoffAt,
  } = body;

  const task = await prisma.task.update({
    where: { id: Number(id) },
    data: {
      title,
      description: description || null,
      taskListId: taskListId !== undefined ? (taskListId ? Number(taskListId) : null) : undefined,
      assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
      assigneeName: assigneeName || null,
      status,
      priority,
      dueDate: (toDate(dueDate) ?? null),
      requiresSignoff: !!requiresSignoff,
      signoffUserId: signoffUserId ? Number(signoffUserId) : null,
      signoffAt: (toDate(signoffAt) ?? null),
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      signoffUser: { select: { id: true, name: true, email: true } },
      production: { select: { id: true, name: true } },
    },
  });

  // Fire notification when status changes to awaiting_signoff
  if (
    status === "awaiting_signoff" &&
    existing.status !== "awaiting_signoff" &&
    task.signoffUserId
  ) {
    await prisma.notification.create({
      data: {
        userId: task.signoffUserId,
        title: "Sign-off required",
        body: task.title,
        link: task.productionId ? `/productions/${task.productionId}?tab=tasks` : "/tasks",
      },
    });
  }

  // Fire notification when new assignee set
  const newAssigneeId = assigneeUserId ? Number(assigneeUserId) : null;
  if (newAssigneeId && newAssigneeId !== existing.assigneeUserId) {
    await prisma.notification.create({
      data: {
        userId: newAssigneeId,
        title: "Task assigned to you",
        body: task.title,
        link: task.productionId ? `/productions/${task.productionId}?tab=tasks` : "/tasks",
      },
    });
  }

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("task", id);
  if ("error" in rec) return rec.error;
  await prisma.task.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
