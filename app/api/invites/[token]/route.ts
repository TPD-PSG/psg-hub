import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { safeJson } from "@/lib/parse";

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

  const { password } = await req.json().catch(() => ({}));
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check email not already taken (edge case)
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  // Productions that still exist, without duplicates
  const wanted = [...new Set(safeJson<unknown[]>(invite.productionIds, []).map(Number).filter(Number.isInteger))];
  const productions = wanted.length
    ? await prisma.production.findMany({ where: { id: { in: wanted } }, select: { id: true } })
    : [];

  // Create the account, mark the invite used and add team places together, so a failure can't leave half an account
  await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: {
        name: invite.name,
        email: invite.email,
        role: invite.role,
        passwordHash,
        permissions: invite.permissions ?? null,
        // Their company and (for client logins) client company, if still there
        homeEntityId: invite.homeEntityId && (await tx.entity.count({ where: { id: invite.homeEntityId } })) ? invite.homeEntityId : null,
        clientId: invite.clientId && (await tx.client.count({ where: { id: invite.clientId } })) ? invite.clientId : null,
      },
    });
    await tx.userInvite.update({ where: { token }, data: { usedAt: new Date() } });
    for (const p of productions) {
      await tx.productionTeam.upsert({
        where: { productionId_userId: { productionId: p.id, userId: user.id } },
        create: { productionId: p.id, userId: user.id },
        update: {},
      });
    }
  });

  return NextResponse.json({ ok: true });
}
