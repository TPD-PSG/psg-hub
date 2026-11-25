// The company spaces this person can open, with each one's build of the month (for Fun Corner)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeSpace } from "@/lib/spaces";
import { buildOfMonth } from "@/lib/spaceBoard";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = { id: Number(u.id), role: u.role ?? "member" };
  const all = await prisma.entity.findMany({ where: { hasSpace: true, archived: false, slug: { not: null } }, select: { id: true, name: true, shortName: true, slug: true }, orderBy: { sortOrder: "asc" } });
  const out = [];
  for (const e of all) if (await canSeeSpace(me, e.id)) out.push({ ...e, botm: await buildOfMonth(e.id, me.id) });
  return NextResponse.json(out);
}
