// User invites: the email with the set-your-password link, and the list for Admin → Users.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";

export const INVITE_DAYS = 7;
export const newInviteToken = () => crypto.randomBytes(32).toString("hex");
export const inviteExpiry = () => new Date(Date.now() + INVITE_DAYS * 86400e3);

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendInviteEmail(name: string, email: string, token: string) {
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
            <p style="margin:0 0 16px;font-size:16px;color:#fff">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.8)">
              You've been invited to join PSG Hub. Click the button below to set your password and get started.
            </p>
            <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600">
              Accept Invitation
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">
              This link expires in ${INVITE_DAYS} days. If you weren't expecting this invitation, you can ignore this email.
            </p>
          </div>
        </div>
      `,
  });
}

/** Invites not yet accepted, latest per email, leaving out anyone who now has an account. */
export async function openInvites() {
  const rows = await prisma.userInvite.findMany({
    where: { usedAt: null },
    select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) { const k = r.email.toLowerCase(); if (!latest.has(k)) latest.set(k, r); }
  const users = await prisma.user.findMany({ where: { email: { in: rows.map(r => r.email) } }, select: { email: true } });
  const taken = new Set(users.map(u => u.email.toLowerCase()));
  const now = new Date();
  return [...latest.values()].filter(r => !taken.has(r.email.toLowerCase())).map(r => ({ ...r, expired: r.expiresAt < now }));
}
