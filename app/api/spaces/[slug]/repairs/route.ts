// A space's repairs and aftercare: list, and report one (staff; multipart with an optional photo).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { readReport, repairsFor, tellWorkshop, REPAIR_SELECT } from "@/lib/repairs";
import { nameOf } from "@/lib/setStorage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const [repairs, jobs] = await Promise.all([
    repairsFor(m.space.id),
    prisma.job.findMany({ where: { entityId: m.space.id, status: { not: "cancelled" } }, select: { id: true, number: true, title: true, storedPieces: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  return NextResponse.json({ space: m.space, repairs, jobs, me: { admin: m.role === "admin" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const r = await readReport(await req.formData(), { entityId: m.space.id });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const by = (await nameOf(m.userId)) ?? "PSG";
  const repair = await prisma.repair.create({ data: { ...r.data, reportedById: m.userId, reportedByName: by }, select: REPAIR_SELECT });
  await tellWorkshop(r.job, r.data.title, by, r.data.urgency);
  return NextResponse.json(repair, { status: 201 });
}
