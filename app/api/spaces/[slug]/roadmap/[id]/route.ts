// Edit, move or delete a roadmap item from a space: same rules as the Hub (whoever raised it, or an admin; pin is admin only).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { ROADMAP_INCLUDE, roadmapFields } from "@/lib/roadmap";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string; id: string }> };

async function load(p: P) {
  const { slug, id } = await p.params;
  const m = await spaceMember(slug);
  if ("error" in m) return m;
  const item = await prisma.roadmapItem.findUnique({ where: { id: Number(id) || 0 } });
  if (!item) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const admin = m.role === "admin";
  if (!m.staff || (item.createdByUserId !== m.userId && !admin)) return { error: NextResponse.json({ error: "Only whoever raised it, or an admin, can change it" }, { status: 403 }) };
  return { m, item, admin };
}

export async function PUT(req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => ({}));
  const f = roadmapFields(body, false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (body.pinned !== undefined && r.admin) f.data.pinned = !!body.pinned;
  const item = await prisma.roadmapItem.update({ where: { id: r.item.id }, data: f.data, include: ROADMAP_INCLUDE });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  await prisma.roadmapItem.delete({ where: { id: r.item.id } });
  return NextResponse.json({ ok: true });
}
