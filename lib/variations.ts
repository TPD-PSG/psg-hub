// Variations on a build (27 Nov 2026): extra or changed work after the quote, priced in lines like
// a quote. Draft → sent to the client → approved or declined. The client decides in My builds,
// or a PSG admin records what the client said. Approved variations add to the job's price
// (lib/jobCosting). Only staff who can see money (BD, finance, admins) work on them.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess } from "@/lib/jobDesign";
import type { JobViewer } from "@/lib/jobData";
import { quoteTotals } from "@/lib/quotes";
import { notify } from "@/lib/clientPortal";

export const VARIATION_INCLUDE = { lines: { orderBy: { sortOrder: "asc" as const } } };
type Line = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number };
type V = { id: number; number: number; title: string; notes: string | null; vatRate: number; status: string; sentAt: Date | null; decidedAt: Date | null; decidedByName: string | null; decidedOnBehalf: boolean; decisionComment: string | null; createdAt: Date; lines: (Line & { id: number })[] };

export const forStaff = (v: V) => ({ ...v, label: `V${v.number}`, totals: quoteTotals(v.lines, v.vatRate) });

/** What the client sees: no costs or margin. */
export const forClient = (v: V) => {
  const t = quoteTotals(v.lines, v.vatRate);
  return {
    id: v.id, label: `V${v.number}`, title: v.title, notes: v.notes, vatRate: v.vatRate, status: v.status, sentAt: v.sentAt, decidedAt: v.decidedAt,
    decidedByName: v.decidedByName, decidedOnBehalf: v.decidedOnBehalf, decisionComment: v.decisionComment,
    lines: v.lines.map(l => ({ id: l.id, section: l.section, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice })),
    totals: { net: t.net, vat: t.vat, gross: t.gross },
  };
};

/** PSG staff who can see money, on a job they can see. */
export async function variationStaff(rawJobId: string): Promise<{ error: NextResponse } | { v: JobViewer; id: number }> {
  const a = await jobAccess(rawJobId);
  if (a.error) return { error: a.error };
  if (!a.v.seeMoney) return { error: NextResponse.json({ error: "Variations are for people who can see prices (BD, finance or admin)" }, { status: 403 }) };
  return { v: a.v, id: a.id };
}

export const variationsFor = async (jobId: number) =>
  (await prisma.jobVariation.findMany({ where: { jobId }, include: VARIATION_INCLUDE, orderBy: { number: "asc" } })).map(forStaff);

/** The job's accepted quote VAT rate, else 20%. */
export async function defaultVat(jobId: number) {
  const q = await prisma.quote.findFirst({ where: { jobId, status: "accepted" }, select: { vatRate: true } });
  return q?.vatRate ?? 20;
}

/** Record a decision (client or admin) and tell the other side. */
export async function decideVariation(id: number, decision: "approved" | "declined", who: { name: string; onBehalf: boolean }, comment: string | null) {
  const v = await prisma.jobVariation.findUnique({ where: { id }, include: { job: { select: { id: true, title: true, clientId: true, entity: { select: { slug: true, hasSpace: true } } } } } });
  if (!v) return "Not found";
  if (v.status === "approved" || v.status === "declined") return `V${v.number} has already been ${v.status}`;
  if (decision === "declined" && !comment?.trim()) return "Say why, so we can change it";
  await prisma.jobVariation.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decidedByName: who.name, decidedOnBehalf: who.onBehalf, decisionComment: comment?.trim().slice(0, 2000) || null, ...(v.sentAt ? {} : { sentAt: new Date() }) },
  });
  const link = v.job.entity?.hasSpace && v.job.entity.slug ? `/spaces/${v.job.entity.slug}/jobs/${v.job.id}` : `/jobs/${v.job.id}`;
  if (!who.onBehalf) {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    await notify([v.createdById, ...admins.map(a => a.id)], { title: `${who.name} ${decision} variation V${v.number} on ${v.job.title}`, body: `${v.title}${comment?.trim() ? `: ${comment.trim()}` : ""}`, link }).catch(() => {});
  } else if (v.job.clientId) {
    const clients = await prisma.user.findMany({ where: { clientId: v.job.clientId, role: "client" }, select: { id: true } });
    await notify(clients.map(c => c.id), { title: `Variation V${v.number} on ${v.job.title} recorded as ${decision}`, body: v.title, link: "/my-builds" }).catch(() => {});
  }
  return null;
}

/** What the variation PDF needs (prices only, never costs). */
export async function variationPdfData(id: number) {
  const v = await prisma.jobVariation.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" }, select: { section: true, description: true, quantity: true, unit: true, unitPrice: true } },
      job: { select: { number: true, title: true, entity: { select: { name: true, hasSpace: true, slug: true, color: true, logoMime: true, updatedAt: true } }, client: { select: { name: true, billingName: true, billingAddress: true, address: true, billingEmail: true } } } },
    },
  });
  if (!v) return null;
  return {
    label: `V${v.number}`, title: v.title, notes: v.notes, vatRate: v.vatRate, status: v.status, createdAt: v.createdAt, sentAt: v.sentAt, decidedAt: v.decidedAt, decidedByName: v.decidedByName,
    jobNumber: v.job.number, jobTitle: v.job.title, entity: v.job.entity, client: v.job.client, lines: v.lines,
  };
}
