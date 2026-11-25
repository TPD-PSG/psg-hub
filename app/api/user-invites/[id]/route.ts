// Resend an invite (new link, another 7 days; the old link stops working) or cancel it. Admins only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail, newInviteToken, inviteExpiry, openInvites } from "@/lib/invites";

async function adminInvite(params: Promise<{ id: string }>) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const invite = await prisma.userInvite.findUnique({ where: { id: parseInt((await params).id) } });
  if (!invite || invite.usedAt) return { error: NextResponse.json({ error: "That invite has gone (already accepted or cancelled)" }, { status: 404 }) };
  return { invite };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await adminInvite(params);
  if ("error" in r) return r.error;
  const { invite } = r;
  if (await prisma.user.count({ where: { email: invite.email } })) return NextResponse.json({ error: "They already have an account" }, { status: 409 });
  const token = newInviteToken();
  await prisma.userInvite.update({ where: { id: invite.id }, data: { token, expiresAt: inviteExpiry(), createdAt: new Date() } });
  try {
    await sendInviteEmail(invite.name, invite.email, token);
  } catch (err) {
    return NextResponse.json({ error: `New link made but the email failed: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 500 });
  }
  return NextResponse.json(await openInvites());
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await adminInvite(params);
  if ("error" in r) return r.error;
  // Every unused invite for that email goes, so no older link still works
  await prisma.userInvite.deleteMany({ where: { email: r.invite.email, usedAt: null } });
  return NextResponse.json(await openInvites());
}
