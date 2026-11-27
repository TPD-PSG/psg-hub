import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordRun } from "@/lib/job-status";
import { summariseDaily } from "@/lib/jobSummaries";
import { weekDigest } from "@/lib/showDigest";
import { digestLine, mondayOf } from "@/lib/showDigestCore";
import { allLeads, incidentPath, localStaff } from "@/lib/incidents";
import { checkState, KIND_LABEL as CHECK_LABEL } from "@/lib/equipmentCore";
import { REMIND_DAYS } from "@/lib/complianceCore";
import { incidentRef } from "@/lib/incidentsCore";

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
  const queue: { userId: number; title: string; body?: string; link: string }[] = [];
  const add = (n: { userId: number; title: string; body?: string; link: string }, key: string) => {
    queue.push(n);
    sentLinks.add(`${n.userId}|${n.link}`);
    sentTitles.add(`${n.userId}|${n.title}`);
    created.push(key);
  };

  // Each section runs on its own: one failing never stops the rest, the save or the backup
  // (audit round 2). Failures are named in the run's result and its status.
  const failed: string[] = [];
  const section = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failed.push(name); console.error(`[notify-daily] section ${name} failed:`, e instanceof Error ? e.message : e); }
  };
  // Shared by several sections
  const ukDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d); // YYYY-MM-DD
  const todayUk = ukDay(now);
  const daysUntil = (d: Date) => Math.round((Date.parse(ukDay(d)) - Date.parse(todayUk)) / 86400e3);
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  const isMondayUk = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(now) === "Monday";
  // Stage reminders (audit round 2): rather than firing only on an exact day (so a missed run lost
  // it), each reminder goes once when its stage is reached: the stage is in the link (…&r=30), and
  // links already sent in the past year aren't sent again. Every count is in UK calendar days.
  const past = await prisma.notification.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 400 * 86400e3) }, link: { contains: "r=" } },
    select: { userId: true, link: true },
  });
  const sentEver = new Set(past.map(n => `${n.userId}|${n.link}`));
  /** The stage due now: the smallest threshold at or above the days left (null once it's past). */
  const stageFor = (left: number, stages: number[]) => (left < 0 ? null : [...stages].sort((x, y) => x - y).find(t => left <= t) ?? null);
  const sendOnce = (n: { userId: number; title: string; body?: string; link: string }, key: string) => {
    if (sentEver.has(`${n.userId}|${n.link}`) || sentLinks.has(`${n.userId}|${n.link}`)) return;
    sentEver.add(`${n.userId}|${n.link}`);
    add(n, key);
  };
  const inDays = (left: number) => (left === 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`);

  // ── 1. Tasks due today or overdue (not done) ──────────────────────────────
  await section("tasks due", async () => {
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
  });

  // ── 2. Tasks awaiting sign-off ────────────────────────────────────────────
  await section("sign-offs", async () => {
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
  });

  // ── 3. Key dates in the next 7 days ──────────────────────────────────────
  await section("key dates", async () => {
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
  });

  // ── 4. Invoice to-dos due in the next 3 days ──────────────────────────────
  await section("invoice to-dos", async () => {
    const dueTodos = await prisma.invoiceTodo.findMany({
      where: { done: false, dueDate: { gte: now, lte: in3Days } },
      select: { id: true, client: true, description: true, dueDate: true },
    });
    // One reminder per to-do (not per client: two to-dos for one client each get theirs; audit round 2)
    for (const todo of dueTodos) {
      const dateStr = new Date(todo.dueDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
      const link = `/finance?tab=todo&todo=${todo.id}`;
      for (const admin of admins) {
        if (sentLinks.has(`${admin.id}|${link}`)) continue;
        add({ userId: admin.id, title: `Invoice due ${dateStr}: ${todo.client}`, body: todo.description || undefined, link }, `todo-${todo.id}-admin-${admin.id}`);
      }
    }
  });

  // ── 4b. Overdue meeting actions, chased with whoever ran the meeting ──────
  // People with a Hub login are already reminded of their own overdue tasks (section 1). Actions
  // given to someone without one ("Sam (venue)") would otherwise never be chased, so the meeting's
  // owner gets one reminder per meeting listing what's overdue and who has it.
  await section("meeting actions", async () => {
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
  });

  // ── 4d. Tender deadlines: the deal's owner (else the admins), 7, 3 and 1 days before and on the day
  await section("tenders", async () => {
    const tenders = await prisma.opportunity.findMany({
      where: { stage: { notIn: ["won", "lost"] }, tenderDeadline: { gte: new Date(now.getTime() - 86400e3), lte: new Date(now.getTime() + 8 * 86400e3) } },
      select: { id: true, title: true, tenderDeadline: true, ownerUserId: true, client: { select: { name: true } } },
    });
    for (const t of tenders) {
      const n = daysUntil(t.tenderDeadline!);
      const stage = stageFor(n, [7, 3, 1, 0]);
      if (stage === null) continue;
      const title = `Tender due ${inDays(n)}: ${t.title}`;
      for (const uid of t.ownerUserId ? [t.ownerUserId] : admins.map(a => a.id)) {
        sendOnce({ userId: uid, title, body: [t.client?.name, t.tenderDeadline!.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })].filter(Boolean).join(" · "), link: `/bd?deal=${t.id}&r=${stage}` }, `tender-${t.id}-${uid}`);
      }
    }
  });

  // ── 4e. A show from a won deal closed yesterday: nudge whoever won it to follow up ────
  await section("closed shows", async () => {
    const yesterdayUk = ukDay(new Date(now.getTime() - 86400e3));
    const closedShows = await prisma.production.findMany({
      where: { endDate: { gte: new Date(Date.parse(yesterdayUk) - 86400e3), lt: new Date(Date.parse(todayUk) + 86400e3) } },
      select: { id: true, name: true, endDate: true, bdClient: { select: { id: true, name: true } }, fromOpportunity: { select: { ownerUserId: true, client: { select: { id: true, name: true } } } } },
    });
    for (const p of closedShows) {
      if (!p.endDate || ukDay(p.endDate) !== yesterdayUk || !p.fromOpportunity) continue;
      const client = p.fromOpportunity.client ?? p.bdClient;
      const title = `${p.name} closed yesterday: follow up${client ? ` with ${client.name}` : ""}`;
      const link = client ? `/bd/clients/${client.id}` : "/bd";
      for (const uid of p.fromOpportunity.ownerUserId ? [p.fromOpportunity.ownerUserId] : admins.map(a => a.id)) {
        if (sentTitles.has(`${uid}|${title}`)) continue;
        add({ userId: uid, title, body: "A good moment to thank them and ask what's next.", link }, `closed-${p.id}-${uid}`);
      }
    }
  });

  // ── 4f. Health & safety: overdue incident actions to their owner; RIDDOR reports not yet made,
  //        3 days before, on the day and every day after, to the H&S leads and the local staff
  await section("incidents and RIDDOR", async () => {
    const place = (i: { production: { name: string } | null; entity: { name: string } | null }) => i.production?.name ?? i.entity?.name ?? "";
    const lateActions = await prisma.incidentAction.findMany({
      where: { doneAt: null, ownerId: { not: null }, dueDate: { lt: startOfToday }, incident: { status: { not: "closed" } } },
      select: { id: true, text: true, ownerId: true, incident: { select: { id: true, year: true, number: true, productionId: true, production: { select: { name: true } }, entity: { select: { name: true, slug: true } } } } },
    });
    for (const a of lateActions) {
      const title = `Overdue incident action: ${a.text}`.slice(0, 200);
      if (sentTitles.has(`${a.ownerId}|${title}`)) continue;
      add({ userId: a.ownerId!, title, body: `${incidentRef(a.incident)} · ${place(a.incident)}`, link: incidentPath(a.incident) }, `incident-action-${a.id}`);
    }
    const riddorOpen = await prisma.incident.findMany({
      where: { riddorReportedAt: null, riddorDueDate: { lt: new Date(now.getTime() + 5 * 86400e3) }, NOT: { riddor: null }, status: { not: "closed" } },
      select: { id: true, year: true, number: true, productionId: true, entityId: true, riddorDueDate: true, production: { select: { name: true } }, entity: { select: { name: true, slug: true } } },
    });
    if (riddorOpen.length) {
      const leads = await allLeads();
      for (const i of riddorOpen) {
        const due = i.riddorDueDate!;
        const left = daysUntil(due); // UK calendar days: 0 on the deadline day itself
        if (left > 3) continue; // from 3 days before, then every day it's due or late
        const title = `RIDDOR report ${left < 0 ? "overdue" : `due ${inDays(left)}`}: ${incidentRef(i)} ${place(i)}`.slice(0, 200);
        const link = `${incidentPath(i)}&r=${left >= 0 ? stageFor(left, [3, 0]) : `late-${ukDay(now)}`}`; // late: one a day
        const who = [...new Set([...leads, ...(await localStaff(i))])];
        for (const userId of who) {
          sendOnce({ userId, title, body: `Report it to the HSE by ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}, then note the date and reference on the report.`, link }, `riddor-${i.id}-${userId}`);
        }
      }
    }
  });

  // ── 4g. Machine refreshers: 30 days before and on the day, to the person and the machine's trainers
  await section("machine refreshers", async () => {
    const soonEnds = await prisma.machineInduction.findMany({
      where: { revokedAt: null, expiresAt: { gte: new Date(now.getTime() - 120 * 86400e3), lt: new Date(now.getTime() + 32 * 86400e3) } },
      select: { id: true, machineId: true, userId: true, personName: true, inductedAt: true, expiresAt: true, machine: { select: { name: true, archived: true, entity: { select: { slug: true } }, trainers: { select: { userId: true } } } } },
    });
    // Only the induction that counts: drop any with a newer one for the same person and machine
    const keyOf = (i: { machineId: number; userId: number | null; personName: string }) => `${i.machineId}|${i.userId ?? `n:${i.personName.toLowerCase()}`}`;
    const latest = new Map<string, Date>();
    const others = soonEnds.length ? await prisma.machineInduction.findMany({ where: { revokedAt: null, machineId: { in: [...new Set(soonEnds.map(i => i.machineId))] } }, select: { machineId: true, userId: true, personName: true, inductedAt: true } }) : [];
    for (const o of others) { const k = keyOf(o); if (!latest.has(k) || latest.get(k)! < o.inductedAt) latest.set(k, o.inductedAt); }
    for (const i of soonEnds) {
      if (i.machine.archived || latest.get(keyOf(i))! > i.inductedAt) continue;
      const left = daysUntil(i.expiresAt!);
      const stage = left < 0 ? (isMondayUk ? `late-${ukDay(now)}` : null) : stageFor(left, [30, 0]); // lapsed: a Monday nudge
      if (stage === null) continue;
      const link = `/spaces/${i.machine.entity.slug}/safety?i=${i.id}&r=${stage}#inductions`;
      const when = left < 0 ? "has lapsed" : left === 0 ? "is due today" : `is due ${inDays(left)} (${i.expiresAt!.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })})`;
      for (const userId of new Set([i.userId, ...i.machine.trainers.map(t => t.userId)].filter((x): x is number => !!x))) {
        const title = (userId === i.userId ? `Your ${i.machine.name} induction refresher ${when}` : `${i.personName}'s ${i.machine.name} refresher ${when}`).slice(0, 200);
        sendOnce({ userId, title, link, body: left <= 0 ? "Until it's done, the planner and tablet will flag work that needs this machine." : "A trainer can record the refresher on the Safety page." }, `refresher-${i.id}-${userId}`);
      }
    }
  });

  // ── 4h. Equipment checks: 14 days before and on the day, to the workshop's own staff
  await section("equipment checks", async () => {
    const kitChecks = await prisma.equipmentCheck.findMany({
      where: { machine: { archived: false } },
      select: { id: true, kind: true, firstDue: true, machine: { select: { name: true, entityId: true, entity: { select: { slug: true } } } }, records: { orderBy: { doneAt: "desc" }, take: 1, select: { doneAt: true, passed: true, nextDue: true } } },
    });
    const kitStaff = new Map<number, number[]>();
    for (const c of kitChecks) {
      const st = checkState(c, c.records, now);
      if (!st.due) continue;
      const left = daysUntil(st.due);
      const stage = left < 0 ? (isMondayUk ? `late-${ukDay(now)}` : null) : stageFor(left, [14, 0]); // overdue: a Monday nudge
      if (stage === null) continue;
      if (!kitStaff.has(c.machine.entityId)) kitStaff.set(c.machine.entityId, (await prisma.user.findMany({ where: { homeEntityId: c.machine.entityId, role: "member", deactivatedAt: null }, select: { id: true } })).map(u => u.id));
      const title = `${c.machine.name}: ${CHECK_LABEL[c.kind] ?? "check"} ${left < 0 ? "overdue" : `due ${inDays(left)}`}`.slice(0, 200);
      for (const userId of kitStaff.get(c.machine.entityId)!) {
        sendOnce({ userId, title, body: left <= 0 ? "Until it's recorded, the planner and tablet say not to use it." : "Book it in, then record the result on the Safety page.", link: `/spaces/${c.machine.entity.slug}/safety?c=${c.id}&r=${stage}#equipment` }, `kit-${c.id}-${userId}`);
      }
    }
  });

  // ── 4i. Compliance register: renewals and reviews 60, 30 and 7 days before and on the day,
  //        to the item's owner and the admins
  await section("compliance register", async () => {
    const regItems = await prisma.complianceItem.findMany({
      where: { archived: false, OR: [{ expiresAt: { not: null } }, { reviewAt: { not: null } }] },
      select: { id: true, name: true, category: true, expiresAt: true, reviewAt: true, ownerId: true, entity: { select: { shortName: true, name: true } } },
    });
    for (const it of regItems) {
      // Renewal and review each have their own reminders
      for (const [what, d] of [["renewal", it.expiresAt], ["review", it.reviewAt]] as const) {
        if (!d) continue;
        const left = daysUntil(d);
        const stage = left < 0 ? (isMondayUk ? `late-${ukDay(now)}` : null) : stageFor(left, REMIND_DAYS); // overdue: a Monday nudge
        if (stage === null) continue;
        const whose = it.entity ? ` (${it.entity.shortName ?? it.entity.name})` : "";
        const title = `${it.name}${whose}: ${what} ${left < 0 ? "overdue" : `due ${inDays(left)}`}`.slice(0, 200);
        for (const userId of new Set([...(it.ownerId ? [it.ownerId] : []), ...admins.map(u => u.id)])) {
          sendOnce({ userId, title, body: `Upload the new ${what === "renewal" ? "certificate or schedule" : "version"} on the Compliance register when it's done.`, link: `/compliance?item=${it.id}&w=${what}&r=${stage}` }, `compliance-${it.id}-${what}-${userId}`);
        }
      }
    }
  });

  // ── 4c. Mondays: last week's show-report digest for each show's PSG team ──
  // (?digestFor=YYYY-MM-DD runs it for that week on any day, for testing and catch-up)
  await section("weekly digest", async () => {
    const forced = req.nextUrl.searchParams.get("digestFor");
    if (isMondayUk || forced) {
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
  });

  await section("save", async () => { if (queue.length) await prisma.notification.createMany({ data: queue }); });

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

  return NextResponse.json({ ok: failed.length === 0, created: failed.includes("save") ? 0 : created.length, items: created, failed, backup: backupResult });
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
