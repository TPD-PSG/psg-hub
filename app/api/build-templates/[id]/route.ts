// Delete a build template (whoever made it, or an admin, in its space).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await prisma.buildTemplate.findUnique({ where: { id: parseInt((await params).id) || 0 } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(t.entityId);
  if ("error" in m) return m.error;
  if (!m.staff || (t.createdById !== m.userId && m.role !== "admin")) return NextResponse.json({ error: "Only whoever made it, or an admin, can delete it" }, { status: 403 });
  await prisma.buildTemplate.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
}
