// Emailing a call sheet to the people on it (PSG staff only). GET: who it would reach and who has
// no email. POST { pdf }: the PDF the page just made, sent to each person with their own call
// time in the email; marked UPDATED when the sheet went out before.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRecordAccess } from "@/lib/access";
import { recipientsFor } from "@/lib/callSheets";
import { mailConfigured, sendEmail } from "@/lib/mail";
import { fmtDate } from "@/lib/format";

const MAX_PDF = 6 * 1024 * 1024; // base64 characters; a call sheet PDF is well under 1 MB
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function staff(id: string) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u || (u.role !== "admin" && u.role !== "member")) return { error: NextResponse.json({ error: "Only PSG staff can email call sheets" }, { status: 403 }) };
  const rec = await requireRecordAccess("callSheet", id);
  if ("error" in rec) return { error: rec.error };
  return { userId: Number(u.id) };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await staff(id);
  if ("error" in s) return s.error;
  const { to, noEmail } = await recipientsFor(Number(id));
  return NextResponse.json({ to: to.map(r => ({ name: r.name, email: r.email })), noEmail: noEmail.map(r => r.name), mailReady: mailConfigured() });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await staff(id);
  if ("error" in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const pdf = typeof body.pdf === "string" ? body.pdf.replace(/^data:application\/pdf;[^,]*,/, "") : "";
  if (!pdf || pdf.length > MAX_PDF || !/^[A-Za-z0-9+/]+=*$/.test(pdf) || !Buffer.from(pdf.slice(0, 16), "base64").toString("latin1").startsWith("%PDF")) {
    return NextResponse.json({ error: "The call sheet PDF didn't come through. Try again." }, { status: 400 });
  }
  if (!mailConfigured()) return NextResponse.json({ error: "Email isn't set up on this Hub, so the sheet can't be sent. Download the PDF instead." }, { status: 503 });

  const sheet = await prisma.callSheet.findUnique({ where: { id: Number(id) }, select: { id: true, date: true, title: true, venue: true, sentAt: true, production: { select: { name: true } } } });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { to } = await recipientsFor(sheet.id);
  if (!to.length) return NextResponse.json({ error: "Nobody on this sheet has an email address" }, { status: 400 });

  const isUpdate = !!sheet.sentAt;
  const day = fmtDate(sheet.date.toISOString());
  const what = [sheet.production.name, sheet.title, day].filter(Boolean).join(" · ");
  const subject = `${isUpdate ? "UPDATED call sheet" : "Call sheet"}: ${what}`;
  const filename = `call-sheet-${sheet.production.name}-${sheet.date.toISOString().slice(0, 10)}${isUpdate ? "-updated" : ""}.pdf`.replace(/[^A-Za-z0-9.-]+/g, "-").toLowerCase();
  const failed: { name: string; email: string; error: string }[] = [];
  for (const r of to) {
    const html = `<p>Hi ${esc(r.name.split(" ")[0])},</p>
<p>${isUpdate ? "<strong>This call sheet has changed since it was last sent.</strong> " : ""}Here's the call sheet for <strong>${esc(what)}</strong>${sheet.venue ? ` at ${esc(sheet.venue)}` : ""}.</p>
<p>Your call: <strong>${esc(r.callTime || "see the attached sheet")}</strong></p>
<p>The full sheet is attached.</p><p>Production Solutions Group</p>`;
    try {
      await sendEmail({ to: r.email!, subject, html, attachments: [{ name: filename, contentType: "application/pdf", base64: pdf }] });
    } catch (e) {
      failed.push({ name: r.name, email: r.email!, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
    }
  }
  const sent = to.filter(r => !failed.some(f => f.email === r.email));
  await prisma.callSheetSend.create({ data: { callSheetId: sheet.id, sentById: s.userId || null, isUpdate, recipients: JSON.stringify(sent.map(r => ({ name: r.name, email: r.email }))), failed: failed.length ? JSON.stringify(failed) : null } });
  if (sent.length) await prisma.callSheet.update({ where: { id: sheet.id }, data: { sentAt: new Date() } });
  return NextResponse.json({ sent: sent.length, failed: failed.map(f => ({ name: f.name, email: f.email })), isUpdate }, { status: sent.length ? 200 : 502 });
}
