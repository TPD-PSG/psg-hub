import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordRun } from "@/lib/job-status";
import { summariseDaily } from "@/lib/jobSummaries";
import { weekDigest } from "@/lib/showDigest";
import { digestLine, mondayOf } from "@/lib/showDigestCore";

export const dynamic = "force-dynamic";

// Called by Railway cron daily — creates in-app notifications for upcoming/overdue items.
// Protected by a shared secret set in NOTIFY_SECRET env var.
async function runDaily(req: NextRequest): Promise<Response> {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || req.headers.get("x-notify-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const created: string[] = [];

  // Load today's notifications once, so re-running the job never sends duplicates
  // (this used to check the database separately for every task, date and person)
  const today = await prisma.notification.findMany({
    where: { createdAt: { gte: startOfToday } },
    select: { userId: true, link: true, title: true },
  });
  const sentLinks = new Set(today.map(n => `${n.userId}|${n.link}`));
  const sentTitles = new Set(today.map(n => `${n.userId}|${n.title}`));
  const todoTitles = today.filter(n => n.link === "/finance?tab=todo");
  const queue: { userId: number; title: string; body?: string; link: string }[] = [];
  const add = (n: { userId: number; title: string; body?: string; link: string }, key: string) => {
    queue.push(n);
    sentLinks.add(`${n.userId}|${n.link}`);
    sentTitles.add(`${n.userId}|${n.title}`);
    created.push(key);
  };

  // ── 1. Tasks due today or overdue (not done) ──────────────────────────────
  const overdueTasks = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { lt: endOfToday }, assigneeUserId: { not: null } },
    select: { id: true, title: true, dueDate: true, assigneeUserId: true, production: { select: { name: true } } },
  });
  for (const task of overdueTasks) {
    if (!task.assigneeUserId) continue;
    const link = `/tasks?highlight=${task.id}`;
    if (sentLinks.has(`${task.assigneeUserId}|${link}`)) continue;
    const label = task.dueDate && new Date(task.dueDate) >= startOfToday ? "due today" : "overdue";
    add({
      userId: task.assigneeUserId,
      title: `Task ${label}: ${task.title}`,
      body: task.production ? ` · ${task.production.name}` : undefined,
      link,
    }, `task-${task.id}`);
  }

  // ── 2. Tasks awaiting sign-off ────────────────────────────────────────────
  const signoffTasks = await prisma.task.findMany({
    where: { status: "awaiting_signoff", signoffUserId: { not: null } },
    select: { id: true, title: true, signoffUserId: true, production: { select: { name: true } } },
  });
  for (const task of signoffTasks) {
    if (!task.signoffUserId) continue;
    const link = `/tasks?highlight=${task.id}`;
    if (sentLinks.has(`${task.signoffUserId}|${link}`)) continue;
    add({ userId: task.signoffUserId, title: `Sign-off needed: ${task.title}`, body: task.production?.name || undefined, link }, `signoff-${task.id}`);
  }

  // ── 3. Key dates in the next 7 days ──────────────────────────────────────
  const keyDates = await prisma.productionKeyDate.findMany({
    where: { startDate: { gte: now, lte: in7Days } },
    select: {
      id: true, type: true, label: true, startDate: true,
      production: { select: { id: true, name: true, team: { select: { userId: true } } } },
    },
  });
  const KEY_DATE_LABELS: Record<string, string> = {
    first_rehearsal: "First Rehearsal", press_night: "Press Night", opening_night: "Opening Night",
    closing_night: "Closing Night", load_in: "Load In", get_out: "Get Out",
    tech_week: "Technical Rehearsals", dress_rehearsal: "Dress Rehearsal", touring_start: "Touring Start",
    touring_end: "Touring End",
  };
  for (const kd of keyDates) {
    const dateStr = new Date(kd.startDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const title = `${kd.production.name} — ${kd.label || KEY_DATE_LABELS[kd.type] || kd.type} on ${dateStr}`;
    for (const member of kd.production.team) {
      if (sentTitles.has(`${member.userId}|${title}`)) continue;
      add({ userId: member.userId, title, link: `/productions/${kd.production.id}?section=schedule` }, `kd-${kd.id}-user-${member.userId}`);
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
        const already = todoTitles.some(n => n.userId === admin.id && n.title.includes(todo.client))
          || queue.some(n => n.userId === admin.id && n.link === "/finance?tab=todo" && n.title.includes(todo.client));
        if (already) continue;
        add({ userId: admin.id, title: `Invoice due ${dateStr}: ${todo.client}`, body: todo.description || undefined, link: "/finance?tab=todo" }, `todo-${todo.id}-admin-${admin.id}`);
      }
    }
  }

  // ── 4b. Overdue meeting actions, chased with whoever ran the meeting ──────
  // People with a Hub login are already reminded of their own overdue tasks (section 1). Actions
  // given to someone without one ("Sam (venue)") would otherwise never be chased, so the meeting's
  // owner gets one reminder per meeting listing what's overdue and who has it.
  const overdueActions = await prisma.task.findMany({
    where: { meetingId: { not: null }, status: { not: "done" }, dueDate: { lt: startOfToday } },
    select: { title: true, dueDate: true, assigneeName: true, assigneeUser: { select: { name: true } }, createdByUserId: true, meeting: { select: { id: true, title: true, meetingDate: true, productionId: true, createdByUserId: true } } },
    orderBy: { dueDate: "asc" },
  });
  const byMeeting = new Map<number, typeof overdueActions>();
  for (const t of overdueActions) if (t.meeting) byMeeting.set(t.meeting.id, [...(byMeeting.get(t.meeting.id) ?? []), t]);
  for (const [meetingId, acts] of byMeeting) {
    const mt = acts[0].meeting!;
    const owner = mt.createdByUserId ?? acts[0].createdByUserId;
    if (!owner) continue;
    const link = `/productions/${mt.productionId}?section=meetings&meeting=${meetingId}`;
    if (sentLinks.has(`${owner}|${link}`)) continue;
    const day = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : "");
    const lines = acts.slice(0, 8).map(t => `${t.title} (${t.assigneeUser?.name ?? t.assigneeName ?? "no owner"}, due ${day(t.dueDate)})`);
    add({
      userId: owner,
      title: `${acts.length} overdue action${acts.length === 1 ? "" : "s"} from ${mt.title} (${day(mt.meetingDate)})`,
      body: lines.join(" · ") + (acts.length > 8 ? ` · and ${acts.length - 8} more` : ""),
      link,
    }, `meeting-actions-${meetingId}`);
  }

  // ── 4c. Mondays: last week's show-report digest for each show's PSG team ──
  // (?digestFor=YYYY-MM-DD runs it for that week on any day, for testing and catch-up)
  const forced = req.nextUrl.searchParams.get("digestFor");
  const isMonday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(now) === "Monday";
  if (isMonday || forced) {
    const weekStart = forced ? mondayOf(forced) : new Date(mondayOf().getTime() - 7 * 86400e3);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400e3);
    const shows = await prisma.production.findMany({
      where: { showReports: { some: { reportDate: { gte: weekStart, lt: weekEnd } } } },
      select: { id: true, name: true, team: { select: { user: { select: { id: true, role: true } } } } },
    });
    for (const show of shows) {
      const g = await weekDigest(show.id, weekStart.toISOString().slice(0, 10));
      const link = `/productions/${show.id}?section=reports&digest=${g.week}`;
      const when = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      for (const { user } of show.team) {
        if (user.role !== "admin" && user.role !== "member") continue; // PSG staff
        if (sentLinks.has(`${user.id}|${link}`)) continue;
        add({ userId: user.id, title: `${show.name}: week of ${when}`, body: digestLine(g), link }, `digest-${show.id}-${user.id}`);
      }
    }
  }

  if (queue.length) await prisma.notification.createMany({ data: queue });

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

// Runs runDaily and records the outcome for the Hub Settings status panel. Rejected callers
// (401/403) aren't runs, so they aren't recorded.
export async function POST(req: NextRequest) {
  let res: Response;
  try {
    res = await runDaily(req);
  } catch (err) {
    await recordRun(prisma, "notify-daily", false, `Crashed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  if (res.status === 401 || res.status === 403) return res;
  const body = await res.clone().json().catch(() => ({}));
  const { ok, summary } = summariseDaily(res, body);
  await recordRun(prisma, "notify-daily", ok, summary);
  return res;
}
