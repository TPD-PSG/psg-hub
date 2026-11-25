// A company space's home: its live jobs, build schedule, upcoming collections/deliveries, team,
// and the shared news. No money here (prices and costs stay on the Jobs pages).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { spaceBySlug, canSeeSpace } from "@/lib/spaces";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const space = await spaceBySlug((await params).slug);
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canSeeSpace({ id: Number(user.id), role: user.role ?? "member" }, space.id))) return NextResponse.json({ error: "This space isn't yours" }, { status: 403 });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in28 = new Date(today.getTime() + 28 * 86400e3);
  const [jobs, team, news] = await Promise.all([
    prisma.job.findMany({
      where: { entityId: space.id, status: "active" },
      select: {
        id: true, number: true, title: true, jobType: true, startDate: true, endDate: true,
        stage: true, stageChangedAt: true, deliveryMethod: true, deliveryNotes: true, forProduction: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } }, production: { select: { id: true, name: true } },
        _count: { select: { time: true } },
      },
      orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { homeEntityId: space.id }, select: { id: true, name: true, avatarUrl: true, role: true }, orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "news" } }),
  ]);
  // Parts of the live builds (crew per build this week, and what's still to plan)
  const parts = await prisma.buildPart.findMany({
    where: { jobId: { in: jobs.map(j => j.id) } },
    select: { id: true, jobId: true, label: true, userId: true, startDate: true, days: true, done: true },
  });
  // Build schedule: starts and finishes in the next four weeks; due out: finishing within 4 weeks
  const schedule = jobs.flatMap(j => [
    j.startDate && j.startDate >= today && j.startDate < in28 ? [{ date: j.startDate, kind: "Starts", jobId: j.id, title: j.title }] : [],
    j.endDate && j.endDate >= today && j.endDate < in28 ? [{ date: j.endDate, kind: "Due out", jobId: j.id, title: j.title }] : [],
  ].flat()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const dueOut = jobs.filter(j => j.endDate && j.endDate >= today && j.endDate < in28);
  const overdue = jobs.filter(j => j.endDate && j.endDate < today);
  return NextResponse.json({ space, jobs, parts, schedule, dueOut, overdue, team, news: news?.value || null, canEdit: user.role === "admin" || user.role === "member" });
}
