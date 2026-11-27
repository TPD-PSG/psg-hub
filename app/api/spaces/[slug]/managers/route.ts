// Workshop managers for this space: who handles running-late and reschedule requests. Admins set them.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (m.role !== "admin") return NextResponse.json({ error: "Only admins choose the workshop managers" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const u = await prisma.user.findFirst({ where: { id: Number(body.userId) || 0, deactivatedAt: null, OR: [{ homeEntityId: m.space.id }, { role: { in: ["admin", "member"] } }] }, select: { id: true } });
  if (!u) return NextResponse.json({ error: "Pick someone on the team" }, { status: 404 });
  await prisma.user.update({ where: { id: u.id }, data: { workshopManager: !!body.manager } });
  return NextResponse.json({ userId: u.id, manager: !!body.manager });
}
