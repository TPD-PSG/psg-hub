import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;

  const { searchParams } = new URL(req.url);
  const productionId = searchParams.get("productionId");
  const companyWide = searchParams.get("companyWide");
  const assigneeId = searchParams.get("assigneeId");

  const where: Record<string, unknown> = {};
  if (productionId) where.productionId = Number(productionId);
  if (companyWide === "1") where.productionId = null;
  if (assigneeId) where.assigneeUserId = Number(assigneeId);

  // Non-admins only see tasks they are involved in
  if (role !== "admin" && userId) {
    where.OR = [
      { assigneeUserId: userId },
      { createdByUserId: userId },
      { signoffUserId: userId },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assigneeUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      signoffUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      createdByUser: { select: { id: true, name: true, avatarUrl: true } },
      production: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title, description, productionId, assigneeUserId, assigneeName,
    status, priority, dueDate, requiresSignoff, signoffUserId, createdByUserId,
  } = body;

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      productionId: productionId ? Number(productionId) : null,
      assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
      assigneeName: assigneeName || null,
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      requiresSignoff: !!requiresSignoff,
      signoffUserId: signoffUserId ? Number(signoffUserId) : null,
      createdByUserId: createdByUserId ? Number(createdByUserId) : null,
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      signoffUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // Notify assignee
  if (task.assigneeUserId) {
    await prisma.notification.create({
      data: {
        userId: task.assigneeUserId,
        title: "New task assigned to you",
        body: task.title,
        link: productionId ? `/productions/${productionId}?tab=tasks` : "/tasks",
      },
    });
  }

  // Notify sign-off person if task already awaiting sign-off
  if (task.requiresSignoff && task.signoffUserId && task.status === "awaiting_signoff") {
    await prisma.notification.create({
      data: {
        userId: task.signoffUserId,
        title: "Sign-off required",
        body: task.title,
        link: productionId ? `/productions/${productionId}?tab=tasks` : "/tasks",
      },
    });
  }

  return NextResponse.json(task, { status: 201 });
}
