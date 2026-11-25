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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const count = await prisma.user.count();
  if (count <= 1) return NextResponse.json({ error: "Cannot delete the last user" }, { status: 400 });
  await prisma.user.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
