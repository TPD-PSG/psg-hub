// The shared roadmap seen from a company space: every item (Hub and spaces alike); staff add ideas tagged to the space.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { ROADMAP_INCLUDE, roadmapFields } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  const items = await prisma.roadmapItem.findMany({ include: ROADMAP_INCLUDE, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ space: m.space, items, me: { id: m.userId, staff: m.staff, admin: m.role === "admin" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Only staff can add to the roadmap" }, { status: 403 });
  const f = roadmapFields(await req.json().catch(() => ({})), true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const item = await prisma.roadmapItem.create({
    data: { ...(f.data as { title: string }), status: (f.data.status as string) ?? "idea", createdByUserId: m.userId, entityId: m.space.id },
    include: ROADMAP_INCLUDE,
  });
  return NextResponse.json(item, { status: 201 });
}
