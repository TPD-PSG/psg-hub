import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail, newInviteToken, inviteExpiry } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, role, permissions, productionIds } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  // Check no existing user with that email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });

  // Expire any previous unused invites for this email
  await prisma.userInvite.updateMany({
    where: { email, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = newInviteToken();
  const expiresAt = inviteExpiry(); // 7 days

  await prisma.userInvite.create({
    data: {
      token, email, name, role: role ?? "member", expiresAt,
      permissions: permissions ? JSON.stringify(permissions) : null,
      productionIds: productionIds?.length ? JSON.stringify(productionIds) : null,
    },
  });

  try {
    await sendInviteEmail(name, email, token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Invite created but email failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
