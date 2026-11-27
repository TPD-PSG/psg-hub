// Workshop calendar: the space's live builds, each piece (part) and its discipline stages, for a
// run of weeks. Staff only.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarStaff, disciplinesFor, isWorkshopManager, STAGE_SELECT, workshopManagers } from "@/lib/workshopCalendar";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await calendarStaff((await params).slug);
  if ("error" in m) return m.error;
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const asked = q.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(q.get("from")!) ? new Date(`${q.get("from")}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(asked.getTime() - ((asked.getUTCDay() + 6) % 7) * DAY); // the Monday
  const weeks = Math.min(26, Math.max(2, Number(q.get("weeks")) || 6));
  const [disciplines, jobs, people] = await Promise.all([
    disciplinesFor(m.space.id, true),
    prisma.job.findMany({
      where: { entityId: m.space.id, status: "active", stage: { not: null } },
      select: {
        id: true, number: true, title: true, stage: true, endDate: true, deliveryMethod: true, client: { select: { name: true } },
        // References: current drawings, design and model-box files, and links (VectorWorks, scenic references…)
        drawings: { select: { id: true, number: true, title: true, revisions: { where: { status: { not: "superseded" } }, orderBy: { createdAt: "desc" }, take: 1, select: { rev: true, status: true, fileId: true } } }, orderBy: [{ number: "asc" }, { id: "asc" }] },
        files: { where: { kind: { in: ["design", "modelbox"] }, revision: null }, select: { id: true, kind: true, name: true, caption: true }, orderBy: { createdAt: "desc" } },
        links: { select: { id: true, label: true, url: true, kind: true }, orderBy: { id: "asc" } },
        parts: { select: { id: true, label: true, pencilled: true, done: true, days: true, hours: true, startDate: true, user: { select: { id: true, name: true } }, stages: { select: STAGE_SELECT, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } }, orderBy: [{ startDate: "asc" }, { id: "asc" }] },
      },
      orderBy: [{ endDate: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({ where: { deactivatedAt: null, OR: [{ homeEntityId: m.space.id }, { role: { in: ["admin", "member"] } }] }, select: { id: true, name: true, homeEntityId: true }, orderBy: { name: "asc" } }),
  ]);
  const managers = await workshopManagers(m.space.id);
  const ticked = (await prisma.user.findMany({ where: { workshopManager: true, id: { in: people.map(p => p.id) } }, select: { id: true } })).map(u => u.id);
  return NextResponse.json({
    space: m.space, from: from.toISOString().slice(0, 10), days: weeks * 7, disciplines,
    jobs: jobs.map(j => ({ ...j, drawings: j.drawings.filter(d => d.revisions.length).map(d => ({ id: d.id, number: d.number, title: d.title, rev: d.revisions[0].rev, status: d.revisions[0].status, url: `/api/job-files/${d.revisions[0].fileId}` })), files: j.files.map(f => ({ ...f, url: `/api/job-files/${f.id}` })) })),
    people: people.map(p => ({ id: p.id, name: p.name, team: p.homeEntityId === m.space.id, manager: ticked.includes(p.id) })),
    canDecide: await isWorkshopManager(m.userId, m.role, m.space.id), isAdmin: m.role === "admin", managersSet: ticked.length > 0, managerCount: managers.length,
  });
}
