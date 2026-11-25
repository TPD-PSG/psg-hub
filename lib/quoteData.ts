// Server-side helpers for the quote API routes.
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { nextNumber, JOB_TYPES, QUOTE_STATUSES } from "@/lib/quotes";

export const QUOTE_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  // Branding for the PDF: a company with its own space (e.g. TWS) gets its own logo and colours
  entity: { select: { id: true, name: true, hasSpace: true, slug: true, color: true, logoMime: true, updatedAt: true } },
  client: { select: { id: true, name: true, billingName: true, billingAddress: true, billingEmail: true, address: true } },
  opportunity: { select: { id: true, title: true, stage: true } },
  job: { select: { id: true, number: true, title: true } },
  createdBy: { select: { id: true, name: true } },
};

/** PSG staff only (admins and members); returns the user id or an error response. */
export async function requireStaff(): Promise<{ userId: number; role: string } | { error: NextResponse }> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (role !== "admin" && role !== "member") return { error: NextResponse.json({ error: "PSG staff only" }, { status: 403 }) };
  return { userId: Number((session.user as { id?: string }).id), role };
}

export async function newNumber(prefix: "Q" | "J" | "PO") {
  const year = new Date().getFullYear();
  const like = { startsWith: `${prefix}-${year}-` };
  const used = prefix === "Q"
    ? (await prisma.quote.findMany({ where: { number: like }, select: { number: true } })).map(q => q.number)
    : prefix === "PO"
      ? (await prisma.purchaseOrder.findMany({ where: { number: like }, select: { number: true } })).map(p => p.number)
      : (await prisma.job.findMany({ where: { number: like }, select: { number: true } })).map(j => j.number);
  return nextNumber(prefix, year, used);
}

/** Header fields from a body; only keys sent are changed. */
export function quoteFields(body: Record<string, unknown>) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (v === "" || v == null ? null : Number.isInteger(Number(v)) ? Number(v) : null);
  const d: Record<string, unknown> = {};
  if (has("title") && text(body.title)) d.title = text(body.title);
  if (has("jobType") && JOB_TYPES.some(t => t.key === body.jobType)) d.jobType = body.jobType;
  if (has("entityId")) d.entityId = int(body.entityId);
  if (has("clientId")) d.clientId = int(body.clientId);
  if (has("opportunityId")) d.opportunityId = int(body.opportunityId);
  if (has("vatRate")) { const v = Number(body.vatRate); if (Number.isFinite(v) && v >= 0 && v <= 100) d.vatRate = v; }
  if (has("validUntil")) d.validUntil = typeof body.validUntil === "string" && body.validUntil ? new Date(body.validUntil) : null;
  if (has("terms")) d.terms = text(body.terms);
  if (has("internalNotes")) d.internalNotes = text(body.internalNotes);
  if (has("status") && (QUOTE_STATUSES as readonly string[]).includes(body.status as string)) d.status = body.status;
  return d;
}
