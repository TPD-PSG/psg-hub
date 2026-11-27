import { safeJson } from "@/lib/parse";
import { NEW_LOOK_KEY } from "@/lib/newLook";
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  // Admins get the full list for user management. Everyone else gets just
  // enough for pickers (assign task, add to team): no roles or permissions,
  // and clients/freelancers don't see staff email addresses.
  const select = role === "admin"
    ? { id: true, name: true, email: true, role: true, permissions: true, createdAt: true, avatarUrl: true, color: true, costDayRate: true, homeEntityId: true, clientId: true, deactivatedAt: true, preferences: true }
    : role === "member"
      ? { id: true, name: true, email: true, avatarUrl: true, color: true }
      : { id: true, name: true, avatarUrl: true, color: true };
  // Pickers leave out people who've been deactivated; admins see everyone
  const users = await prisma.user.findMany({ where: role === "admin" ? {} : { deactivatedAt: null }, select, orderBy: { name: "asc" } });
  // Admins see who has the New look (beta) on; the rest of a person's preferences stay private
  return NextResponse.json(users.map(u => {
    if (!("preferences" in u)) return u;
    const { preferences, ...rest } = u as typeof u & { preferences: string | null };
    return { ...rest, newLook: safeJson<Record<string, unknown>>(preferences, {})[NEW_LOOK_KEY] === true };
  }));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  // A client login can be linked to its client company straight away
  const clientId = body.clientId ? Number(body.clientId) : null;
  if (clientId !== null && !(await prisma.client.count({ where: { id: clientId } }))) return NextResponse.json({ error: "Unknown client company" }, { status: 400 });
  const user = await prisma.user.create({
    data: {
      clientId,
      name: body.name,
      email: body.email,
      passwordHash: await hash(body.password, 12),
      role: body.role ?? "member",
      permissions: body.permissions ? JSON.stringify(body.permissions) : null,
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true, avatarUrl: true, color: true },
  });
  return NextResponse.json(user, { status: 201 });
}
