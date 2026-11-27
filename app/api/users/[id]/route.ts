import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") return false;
  return true;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = { name: body.name, email: body.email, role: body.role };
  if (body.password) data.passwordHash = await hash(body.password, 12);
  if (body.permissions !== undefined) data.permissions = JSON.stringify(body.permissions);
  if (body.color !== undefined) data.color = body.color || null;
  // Home company: their company's space (if it has one) becomes their home page and theme
  if (body.homeEntityId !== undefined) {
    const e = body.homeEntityId === "" || body.homeEntityId === null ? null : Number(body.homeEntityId);
    if (e !== null && !(await prisma.entity.count({ where: { id: e } }))) return NextResponse.json({ error: "Unknown company" }, { status: 400 });
    data.homeEntityId = e;
  }
  // Client logins: the client company whose builds they see and sign off
  if (body.clientId !== undefined) {
    const c = body.clientId === "" || body.clientId === null ? null : Number(body.clientId);
    if (c !== null && !(await prisma.client.count({ where: { id: c } }))) return NextResponse.json({ error: "Unknown client company" }, { status: 400 });
    data.clientId = c;
  }
  // Internal cost per day for job costing (admins only, like the rest of this route)
  if (body.costDayRate !== undefined) {
    const r = body.costDayRate === "" || body.costDayRate === null ? null : Number(body.costDayRate);
    if (r !== null && (!Number.isFinite(r) || r < 0)) return NextResponse.json({ error: "Day rate must be an amount" }, { status: 400 });
    data.costDayRate = r;
  }
  const user = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: { id: true, name: true, email: true, role: true, permissions: true, color: true, costDayRate: true, homeEntityId: true, clientId: true, createdAt: true },
  });
  return NextResponse.json(user);
}

// Deactivate or reactivate: a deactivated person can't sign in (and is signed out within five
// minutes), but everything they did stays (audit round 2)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.deactivated !== "boolean") return NextResponse.json({ error: "Say whether to deactivate" }, { status: 400 });
  if (body.deactivated && id === Number((session!.user as { id?: string }).id)) return NextResponse.json({ error: "You can't deactivate yourself" }, { status: 400 });
  const u = await prisma.user.update({ where: { id }, data: { deactivatedAt: body.deactivated ? new Date() : null }, select: { id: true, deactivatedAt: true } }).catch(() => null);
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(u);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const count = await prisma.user.count();
  if (count <= 1) return NextResponse.json({ error: "Cannot delete the last user" }, { status: 400 });
  // Deleting someone would delete the days they logged (and change past job costs): keep them,
  // and offer to deactivate instead (audit round 2)
  const uid = Number(id);
  const [days, clocks] = await Promise.all([prisma.timeEntry.count({ where: { userId: uid } }), prisma.clockEntry.count({ where: { userId: uid } })]);
  if (days || clocks) {
    return NextResponse.json({ error: `They have ${days || clocks} record${(days || clocks) === 1 ? "" : "s"} of time logged on jobs, which would be lost. Deactivate them instead: they can't sign in, and their history stays.`, canDeactivate: true }, { status: 409 });
  }
  await prisma.user.delete({ where: { id: uid } });
  return NextResponse.json({ ok: true });
}
