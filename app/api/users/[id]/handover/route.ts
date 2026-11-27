// Handing over a leaver's work (admins only). GET: what they still have open. POST { toUserId,
// kinds, deactivate? }: move the chosen kinds to someone else, tell them, and optionally deactivate.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { handOver, handoverSummary } from "@/lib/handover";
import { notify } from "@/lib/clientPortal";

async function admin() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.role === "admin" ? Number(u.id) : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await handoverSummary(id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await admin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const from = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const to = Number(body.toUserId);
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter((k: unknown): k is string => typeof k === "string") : [];
  const [leaver, taker] = await Promise.all([
    Number.isInteger(from) ? prisma.user.findUnique({ where: { id: from }, select: { id: true, name: true } }) : null,
    Number.isInteger(to) ? prisma.user.findUnique({ where: { id: to }, select: { id: true, role: true, deactivatedAt: true } }) : null,
  ]);
  if (!leaver) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!taker || taker.id === from) return NextResponse.json({ error: "Pick who takes over" }, { status: 400 });
  if (taker.deactivatedAt || taker.role === "client") return NextResponse.json({ error: "Hand over to someone active on the PSG team" }, { status: 400 });
  if (body.deactivate && from === me) return NextResponse.json({ error: "You can't deactivate yourself" }, { status: 400 });

  const moved = await handOver(from, to, kinds);
  if (body.deactivate) await prisma.user.update({ where: { id: from }, data: { deactivatedAt: new Date() } });
  if (moved.length) {
    await notify([to], {
      title: `${leaver.name}'s work has been handed to you`,
      body: moved.map(m => `${m.label}: ${m.count}`).join(" · "),
      link: "/tasks",
    });
  }
  return NextResponse.json({ moved, deactivated: !!body.deactivate });
}
