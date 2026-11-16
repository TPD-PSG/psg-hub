import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, role } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  // Check no existing user with that email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });

  // Expire any previous unused invites for this email
  await prisma.userInvite.updateMany({
    where: { email, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.userInvite.create({
    data: { token, email, name, role: role ?? "member", expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://hub.production-solutions.group";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  await sendEmail({
    to: email,
    subject: "You've been invited to PSG Hub",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a193d;color:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#1e3a7a;padding:24px 32px">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">PSG Hub</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.6)">Production Solutions Group</p>
        </div>
        <div style="padding:32px">
          <p style="margin:0 0 16px;font-size:16px;color:#fff">Hi ${name},</p>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.8)">
            You've been invited to join PSG Hub. Click the button below to set your password and get started.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600">
            Accept Invitation
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">
            This link expires in 7 days. If you weren't expecting this invitation, you can ignore this email.
          </p>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
