// The workshop planner for a space: its live builds (for the timeline), the parts of those
// builds, the crew (the space's team plus anyone planned on a part), and where crew are already
// booked on productions elsewhere in the Hub, so clashes show. No money.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { spaceBySlug, canSeeSpace } from "@/lib/spaces";
import { PART_SELECT, dayUtc } from "@/lib/buildParts";
import { current, inductionStatus, inducted as counts } from "@/lib/inductionsCore";

export const dynamic = "force-dynamic";

/** Monday of the week containing `d` (UTC). */
const monday = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const space = await spaceBySlug((await params).slug);
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = user.role ?? "member";
  if (!(await canSeeSpace({ id: Number(user.id), role }, space.id))) return NextResponse.json({ error: "This space isn't yours" }, { status: 403 });

  const q = new URL(req.url).searchParams;
  const from = monday(dayUtc(q.get("from")) ?? new Date());
  const days = 14;
  const to = new Date(from.getTime() + days * 86400e3);

  const jobs = await prisma.job.findMany({
    where: { entityId: space.id, status: "active" },
    select: { id: true, number: true, title: true, jobType: true, stage: true, startDate: true, endDate: true, deliveryMethod: true, client: { select: { name: true } } },
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
  });
  const parts = await prisma.buildPart.findMany({
    where: { jobId: { in: jobs.map(j => j.id) } },
    select: PART_SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  const team = await prisma.user.findMany({ where: { homeEntityId: space.id }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const extraIds = [...new Set(parts.filter(p => p.userId && !team.some(t => t.id === p.userId)).map(p => p.userId!))];
  const extra = extraIds.length ? await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const crew = [...team.map(t => ({ ...t, team: true })), ...extra.map(t => ({ ...t, team: false }))];
  // Already booked on a show elsewhere in the Hub during this fortnight
  const elsewhere = crew.length ? await prisma.staffAssignment.findMany({
    where: { userId: { in: crew.map(c => c.id) }, startDate: { lt: to }, endDate: { gte: from } },
    select: { userId: true, startDate: true, endDate: true, activityType: true, production: { select: { id: true, name: true } } },
  }) : [];
  // People who can be planned (any PSG staff, for adding someone from outside the team)
  const staff = role === "admin" || role === "member"
    ? await prisma.user.findMany({ where: { role: { in: ["admin", "member"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  // Machine inductions: the space's machines (to pick for a part), and parts planned on someone who
  // isn't inducted on a machine the part needs (a warning, not a block)
  const machines = await prisma.machine.findMany({ where: { entityId: space.id, archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const inds = await prisma.machineInduction.findMany({ where: { userId: { not: null }, machine: { entityId: space.id } }, select: { userId: true, machineId: true, inductedAt: true, expiresAt: true, revokedAt: true } });
  const inducted: Record<number, number[]> = {}; // person → machines they're inducted on today
  for (const key of new Set(inds.map(i => `${i.userId}:${i.machineId}`))) {
    const [u, mId] = key.split(":").map(Number);
    if (counts(inductionStatus(current(inds.filter(i => i.userId === u && i.machineId === mId))))) (inducted[u] ??= []).push(mId);
  }
  return NextResponse.json({
    space, from: from.toISOString().slice(0, 10), days, jobs, parts, crew, elsewhere, staff, machines, inducted,
    canEdit: role === "admin" || role === "member",
  });
}
