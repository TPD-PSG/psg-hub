// Crew offers (stage 4 of replacing Flex, 27 Nov 2026). A crew job on a rental hire or a
// production is offered to people from the crew directory. Each gets a private link (emailed
// when they have an address, and in their Hub notifications when their email matches a login)
// where they say whether they're available. The team books who they want.
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, parseDay, text } from "@/lib/rentalAccess";
import { requireProductionAccess } from "@/lib/access";
import { sendEmail, mailConfigured } from "@/lib/mail";
import { notify } from "@/lib/clientPortal";

export const OFFER_STATUS = { offered: "Asked", available: "Available", unavailable: "Can't do it", booked: "Booked", released: "Released" } as const;
export const PAY_UNIT = { day: "a day", hour: "an hour", job: "for the job" } as const;

export const JOB_INCLUDE = {
  offers: { orderBy: { sentAt: "asc" as const }, include: { crew: { select: { id: true, name: true, discipline: true, email: true, phone: true } }, bookedBy: { select: { name: true } } } },
  hire: { select: { id: true, number: true, title: true, entityId: true } },
  production: { select: { id: true, name: true } },
};

/** Who may manage crew jobs: PSG staff, on a hire in a rentals space they can open, or a production they can see. */
export async function jobAccess(where: { hireId?: number | null; productionId?: number | null }): Promise<{ userId: number } | { error: NextResponse }> {
  if (where.hireId) {
    const h = await prisma.rentalHire.findUnique({ where: { id: where.hireId }, select: { entityId: true } });
    if (!h) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
    const a = await staffForEntity(h.entityId);
    return "error" in a ? a : { userId: a.user.userId };
  }
  if (where.productionId) {
    const a = await requireProductionAccess(where.productionId, "crew");
    if ("error" in a) return a;
    if (a.role !== "admin" && a.role !== "member") return { error: NextResponse.json({ error: "PSG staff only" }, { status: 403 }) };
    return { userId: a.userId };
  }
  return { error: NextResponse.json({ error: "A crew job is on a hire or a production" }, { status: 400 }) };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Check a crew job's fields (creating needs a role and a date). */
export function jobFields(b: Record<string, unknown>, creating: boolean): { data: Record<string, unknown> } | { error: string } {
  const d: Record<string, unknown> = {};
  if (creating || "role" in b) { const r = text(b.role, 80); if (!r) return { error: "Say what the job is, e.g. Lighting technician" }; d.role = r; }
  if (creating || "date" in b) { const day = parseDay(b.date); if (!day) return { error: "Give the job's date" }; d.date = day; }
  for (const k of ["callTime", "endTime"] as const) {
    if (!(k in b)) continue;
    if (b[k] == null || b[k] === "") { d[k] = null; continue; }
    if (typeof b[k] !== "string" || !TIME.test(b[k] as string)) return { error: "Times look like 08:00" };
    d[k] = b[k];
  }
  if (creating || "places" in b) {
    const n = Number(b.places ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 200) return { error: "Say how many people, from 1" };
    d.places = n;
  }
  for (const [k, max, msg] of [["payRate", 100_000, "Pay is a number of pounds"], ["chargeRate", 100_000, "The charge is a number of pounds"], ["hours", 24, "Hours are 0 to 24"]] as const) {
    if (!(k in b)) continue;
    if (b[k] == null || b[k] === "") { d[k] = null; continue; }
    const n = Number(b[k]);
    if (!isFinite(n) || n < 0 || n > max) return { error: msg };
    d[k] = Math.round(n * 100) / 100;
  }
  if ("payUnit" in b) {
    if (typeof b.payUnit !== "string" || !(b.payUnit in PAY_UNIT)) return { error: "Pay is by the day, the hour or the job" };
    d.payUnit = b.payUnit;
  }
  if ("location" in b) d.location = text(b.location, 200);
  if ("notes" in b) d.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null;
  return { data: d };
}

export const newToken = () => crypto.randomBytes(24).toString("base64url");
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const payLabel = (j: { payRate: number | null; payUnit: string; hours: number | null }) =>
  j.payRate == null ? null : `£${j.payRate.toFixed(2).replace(/\.00$/, "")} ${PAY_UNIT[j.payUnit as keyof typeof PAY_UNIT] ?? ""}${j.payUnit === "hour" && j.hours ? ` (${j.hours} hours)` : ""}`;

type JobForMail = { role: string; date: Date; callTime: string | null; endTime: string | null; location: string | null; payRate: number | null; payUnit: string; hours: number | null; notes: string | null; hire: { title: string } | null; production: { name: string } | null };
const what = (j: JobForMail) => j.hire?.title ?? j.production?.name ?? "a job";

/** Email (when there's an address and the Hub can send) and notify a Hub login with the same email. */
const ORIGIN = () => process.env.NEXTAUTH_URL ?? "https://hub.production-solutions.group";
export async function tellCrew(kind: "offer" | "booked" | "released", offer: { token: string; crew: { name: string; email: string | null } }, job: JobForMail) {
  const link = `${ORIGIN()}/crew-offer/${offer.token}`;
  const when = `${dayLabel(job.date)}${job.callTime ? `, call ${job.callTime}${job.endTime ? ` to ${job.endTime}` : ""}` : ""}`;
  const subject = kind === "offer" ? `Are you free? ${job.role} on ${dayLabel(job.date)}` : kind === "booked" ? `You're booked: ${job.role} on ${dayLabel(job.date)}` : `Change of plan: ${job.role} on ${dayLabel(job.date)}`;
  const line = kind === "offer" ? "We'd like to know if you're available for this. Tap the button to say yes or no." : kind === "booked" ? "You're booked for this. Thank you! The details are below and on the link." : "We no longer need you for this one. Sorry for the change, and thank you for being available.";
  const pay = payLabel(job);
  let emailed: string | null = null;
  if (offer.crew.email && mailConfigured()) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1d21;max-width:560px">
      <p>Hi ${esc(offer.crew.name.split(/\s+/)[0])},</p><p>${esc(line)}</p>
      <table style="border-collapse:collapse;margin:12px 0">${[["Job", job.role], ["For", what(job)], ["When", when], job.location ? ["Where", job.location] : null, pay ? ["Pay", pay] : null].filter(Boolean).map(r => `<tr><td style="padding:4px 12px 4px 0;color:#5f626a">${esc(r![0])}</td><td style="padding:4px 0;font-weight:bold">${esc(r![1])}</td></tr>`).join("")}</table>
      ${job.notes ? `<p style="white-space:pre-wrap">${esc(job.notes)}</p>` : ""}
      <p><a href="${link}" style="display:inline-block;background:#1a1d21;color:#fff;padding:12px 20px;text-decoration:none;font-weight:bold">${kind === "offer" ? "Say if you're free" : "See the details"}</a></p>
      <p style="color:#5f626a;font-size:12px">PSG Rentals &amp; Crew · Production Solutions Group. This link is just for you.</p></div>`;
    try { await sendEmail({ to: offer.crew.email, subject, html }); emailed = offer.crew.email; } catch (e) { console.error("[crew offers] email", e instanceof Error ? e.message : e); }
  }
  if (offer.crew.email) {
    const users = await prisma.user.findMany({ where: { email: { equals: offer.crew.email.trim().toLowerCase() } }, select: { id: true } });
    if (users.length) await notify(users.map(u => u.id), { title: subject, body: `${what(job)} · ${when}`, link: `/crew-offer/${offer.token}` });
  }
  return emailed;
}

/**
 * Keep a hire's crew charge in step with who's booked: one charge line per job, the number of
 * people booked at the job's charge each. No one booked (or no charge set) removes the line.
 */
export async function syncHireCharge(jobId: number) {
  const job = await prisma.crewJob.findUnique({ where: { id: jobId }, select: { id: true, hireId: true, role: true, date: true, chargeRate: true, offers: { where: { status: "booked" }, select: { id: true } }, charge: { select: { id: true } } } });
  if (!job?.hireId) return;
  const booked = job.offers.length;
  if (!booked || !job.chargeRate) { if (job.charge) await prisma.rentalHireCharge.delete({ where: { id: job.charge.id } }); return; }
  const description = `Crew: ${job.role}, ${job.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
  if (job.charge) await prisma.rentalHireCharge.update({ where: { id: job.charge.id }, data: { description, quantity: booked, unitPrice: job.chargeRate } });
  else await prisma.rentalHireCharge.create({ data: { hireId: job.hireId, crewJobId: job.id, description, quantity: booked, unitPrice: job.chargeRate, sortOrder: 500 } });
}

/** Booked on a production: they're added to its crew (role, the day, day rate), and taken off again if released. */
export async function syncProductionCrew(offerId: number) {
  const o = await prisma.crewOffer.findUnique({ where: { id: offerId }, include: { job: true } });
  if (!o?.job.productionId) return;
  if (o.status === "booked" && !o.productionCrewId) {
    const pc = await prisma.productionCrew.create({ data: { productionId: o.job.productionId, crewId: o.crewId, role: o.job.role, startDate: o.job.date, endDate: o.job.date, dayRate: o.job.payUnit === "day" ? o.job.payRate : null, notes: "Booked through a crew offer" } });
    await prisma.crewOffer.update({ where: { id: o.id }, data: { productionCrewId: pc.id } });
  } else if (o.status !== "booked" && o.productionCrewId) {
    await prisma.productionCrew.delete({ where: { id: o.productionCrewId } }).catch(() => {});
    await prisma.crewOffer.update({ where: { id: o.id }, data: { productionCrewId: null } });
  }
}

/** The job's totals: places, who's booked, what they're paid and what the client is charged. */
export function jobSummary(j: { places: number; payRate: number | null; payUnit: string; hours: number | null; chargeRate: number | null; offers: { status: string }[] }) {
  const booked = j.offers.filter(o => o.status === "booked").length;
  const each = j.payRate == null ? null : j.payUnit === "hour" ? j.payRate * (j.hours ?? 0) : j.payRate;
  return {
    booked, open: Math.max(0, j.places - booked), full: booked >= j.places,
    available: j.offers.filter(o => o.status === "available").length, waiting: j.offers.filter(o => o.status === "offered").length,
    payTotal: each == null ? null : Math.round(each * booked * 100) / 100,
    chargeTotal: j.chargeRate == null ? null : Math.round(j.chargeRate * booked * 100) / 100,
  };
}
