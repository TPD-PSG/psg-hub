import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// GET — validate token, return name/email
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.userInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });

  return NextResponse.json({ name: invite.name, email: invite.email, role: invite.role });
}

// POST — accept invite, create user account
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.userInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });

  const { password } = await req.json();
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check email not already taken (edge case)
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: invite.name,
      email: invite.email,
      role: invite.role,
      passwordHash,
      permissions: invite.permissions ?? null,
    },
  });

  await prisma.userInvite.update({ where: { token }, data: { usedAt: new Date() } });

  // Add to specified productions
  if (invite.productionIds) {
    try {
      const ids: number[] = JSON.parse(invite.productionIds);
      if (ids.length) {
        await prisma.productionTeam.createMany({
          data: ids.map(pid => ({ productionId: pid, userId: user.id })),

        });
      }
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
