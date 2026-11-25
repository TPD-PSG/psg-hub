// Tablet mode (27 Nov 2026): a shared workshop tablet. GET: the team, who's clocked on where, and
// the live builds (today's planned parts first for each person). POST { userId, action, jobId }:
// clock someone on (switching build closes the last one) or off. Staff of the space; a person
// can be clocked by anyone on the tablet only if they're in the space's team (or it's themselves).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { clockOff } from "@/lib/clocking";
import { nameOf } from "@/lib/setStorage";

export const dynamic = "force-dynamic";

async function state(entityId: number) {
  const today = new Date(); const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [team, jobs, open, parts] = await Promise.all([
    prisma.user.findMany({ where: { homeEntityId: entityId, role: { in: ["admin", "member"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.job.findMany({ where: { entityId, status: "active" }, select: { id: true, number: true, title: true, stage: true }, orderBy: { createdAt: "desc" } }),
    prisma.clockEntry.findMany({ where: { endAt: null, job: { entityId } }, select: { userId: true, jobId: true, startAt: true } }),
    prisma.buildPart.findMany({ where: { done: false, userId: { not: null }, startDate: { lte: new Date(day0) }, job: { entityId, status: "active" } }, select: { userId: true, jobId: true, label: true, startDate: true, days: true } }),
  ]);
  const todayParts = parts.filter(p => p.startDate && p.startDate.getTime() + p.days * 86400e3 > day0);
  return {
    team: team.map(t => ({ ...t, on: open.find(o => o.userId === t.id) ?? null, today: todayParts.filter(p => p.userId === t.id).map(p => ({ jobId: p.jobId, label: p.label })) })),
    jobs,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  return NextResponse.json({ space: m.space, ...(await state(m.space.id)) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId) || 0;
  const person = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, homeEntityId: true } });
  if (!person || (person.homeEntityId !== m.space.id && person.id !== m.userId)) return NextResponse.json({ error: "Only people in this workshop's team can be clocked here" }, { status: 403 });
  let logged = null;
  if (body.action === "on") {
    const job = await prisma.job.findFirst({ where: { id: Number(body.jobId) || 0, entityId: m.space.id, status: "active" }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "Pick one of this workshop's builds" }, { status: 400 });
    logged = await clockOff(userId); // switching builds closes the last one
    await prisma.clockEntry.create({ data: { userId, jobId: job.id, byName: await nameOf(m.userId) } });
  } else if (body.action === "off") {
    logged = await clockOff(userId);
    if (!logged) return NextResponse.json({ error: `${person.name} isn't clocked on` }, { status: 400 });
  } else return NextResponse.json({ error: "Clock on or off" }, { status: 400 });
  return NextResponse.json({ logged, ...(await state(m.space.id)) });
}
