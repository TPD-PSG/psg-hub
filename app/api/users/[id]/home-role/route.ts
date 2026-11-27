// Admins set each person's Home role (director, PM or office): which panels the new look's Home shows
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HOME_ROLES } from "@/lib/newLook";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const homeRole = body.homeRole === null || body.homeRole === "" ? null : (HOME_ROLES as readonly string[]).includes(body.homeRole) ? body.homeRole : undefined;
  if (homeRole === undefined) return NextResponse.json({ error: "Director, PM or office" }, { status: 400 });
  const u = await prisma.user.update({ where: { id: Number((await params).id) || 0 }, data: { homeRole }, select: { id: true, homeRole: true } }).catch(() => null);
  return u ? NextResponse.json(u) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
