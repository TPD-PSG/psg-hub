import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Called by Railway cron daily — creates in-app notifications for upcoming/overdue items.
// Protected by a shared secret set in NOTIFY_SECRET env var.
export async function POST(req: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (secret) {
    const auth = req.headers.get("x-notify-secret");
    if (auth !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const created: string[] = [];

  // ── 1. Tasks due today or overdue (not done) ──────────────────────────────
  const overdueTasks = await prisma.task.findMany({
    where: {
      status: { not: "done" },
      dueDate: { lt: endOfToday },
      assigneeUserId: { not: null },
    },
    select: { id: true, title: true, dueDate: true, assigneeUserId: true, production: { select: { name: true } } },
  });

  for (const task of overdueTasks) {
    if (!task.assigneeUserId) continue;
    const isToday = task.dueDate && new Date(task.dueDate) >= startOfToday;
    const label = isToday ? "due today" : "overdue";
    const prodLabel = task.production ? ` · ${task.production.name}` : "";

    // Avoid duplicate: don't re-notify if one already exists today for this task
    const existing = await prisma.notification.findFirst({
      where: {
        userId: task.assigneeUserId,
        link: `/tasks?highlight=${task.id}`,
        createdAt: { gte: startOfToday },
      },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: task.assigneeUserId,
        title: `Task ${label}: ${task.title}`,
        body: prodLabel || undefined,
        link: `/tasks?highlight=${task.id}`,
      },
    });
    created.push(`task-${task.id}`);
  }

  // ── 2. Tasks awaiting sign-off ────────────────────────────────────────────
  const signoffTasks = await prisma.task.findMany({
    where: { status: "awaiting_signoff", signoffUserId: { not: null } },
    select: { id: true, title: true, signoffUserId: true, production: { select: { name: true } } },
  });

  for (const task of signoffTasks) {
    if (!task.signoffUserId) continue;
    const existing = await prisma.notification.findFirst({
      where: {
        userId: task.signoffUserId,
        link: `/tasks?highlight=${task.id}`,
        createdAt: { gte: startOfToday },
      },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: task.signoffUserId,
        title: `Sign-off needed: ${task.title}`,
        body: task.production?.name || undefined,
        link: `/tasks?highlight=${task.id}`,
      },
    });
    created.push(`signoff-${task.id}`);
  }

  // ── 3. Key dates in the next 7 days ──────────────────────────────────────
  const keyDates = await prisma.productionKeyDate.findMany({
    where: { startDate: { gte: now, lte: in7Days } },
    select: {
      id: true, type: true, label: true, startDate: true,
      production: {
        select: {
          id: true, name: true,
          team: { select: { userId: true } },
        },
      },
    },
  });

  const KEY_DATE_LABELS: Record<string, string> = {
    first_rehearsal: "First Rehearsal", press_night: "Press Night", opening_night: "Opening Night",
    closing_night: "Closing Night", load_in: "Load In", get_out: "Get Out",
    tech_week: "Tech Week", dress_rehearsal: "Dress Rehearsal", touring_start: "Touring Start",
    touring_end: "Touring End",
  };

  for (const kd of keyDates) {
    const dateStr = new Date(kd.startDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const kdLabel = kd.label || KEY_DATE_LABELS[kd.type] || kd.type;
    const title = `${kd.production.name} — ${kdLabel} on ${dateStr}`;

    for (const member of kd.production.team) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: member.userId,
          title,
          createdAt: { gte: startOfToday },
        },
      });
      if (existing) continue;

      await prisma.notification.create({
        data: {
          userId: member.userId,
          title,
          link: `/productions/${kd.production.id}?section=schedule`,
        },
      });
      created.push(`kd-${kd.id}-user-${member.userId}`);
    }
  }

  // ── 4. Invoice to-dos due in the next 3 days ──────────────────────────────
  const dueTodos = await prisma.invoiceTodo.findMany({
    where: { done: false, dueDate: { gte: now, lte: in3Days } },
    select: { id: true, client: true, description: true, dueDate: true },
  });

  if (dueTodos.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    for (const todo of dueTodos) {
      const dateStr = new Date(todo.dueDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      for (const admin of admins) {
        const existing = await prisma.notification.findFirst({
          where: {
            userId: admin.id,
            link: `/finance?tab=todo`,
            title: { contains: todo.client },
            createdAt: { gte: startOfToday },
          },
        });
        if (existing) continue;

        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: `Invoice due ${dateStr}: ${todo.client}`,
            body: todo.description || undefined,
            link: `/finance?tab=todo`,
          },
        });
        created.push(`todo-${todo.id}-admin-${admin.id}`);
      }
    }
  }

  // ── 5. SQLite backup to Cloudflare R2 ────────────────────────────────────
  let backupResult: Record<string, unknown> = { skipped: true };
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const backupRes = await fetch(`${baseUrl}/api/backup`, {
      method: "POST",
      headers: secret ? { "x-notify-secret": secret } : {},
    });
    backupResult = await backupRes.json();
  } catch (err) {
    backupResult = { error: String(err) };
  }

  return NextResponse.json({ ok: true, created: created.length, items: created, backup: backupResult });
}
