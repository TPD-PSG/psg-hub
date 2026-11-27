// Hires: checking dates and lines, and what a hire is short of over its dates.
import { prisma } from "@/lib/prisma";
import { ownedFor, hiresAround, parseDay, text } from "@/lib/rentalAccess";
import { lineList, type LineIn } from "@/lib/rentalFields";
import { shortages, HIRE_STATUS, holdsKit, hireTotals } from "@/lib/rentals";

export const HIRE_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" as const }, include: { product: { select: { id: true, name: true, category: true, dayRate: true, weekRate: true } } } },
  charges: { orderBy: { sortOrder: "asc" as const } },
  invoice: { select: { id: true, status: true, reference: true, netAmount: true, vatAmount: true, issueDate: true, dueDate: true } },
  entity: { select: { name: true, hasSpace: true, slug: true, color: true, logoMime: true, updatedAt: true, address: true, phone: true } },
  production: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

export async function shortFor(entityId: number, hire: { id?: number; outDate: Date; returnDate: Date; lines: { productId: number; quantity: number }[] }) {
  const [owned, others] = await Promise.all([ownedFor(entityId), hiresAround(entityId, hire.outDate, hire.returnDate)]);
  const short = shortages(hire, owned, others);
  if (!short.length) return [];
  const names = new Map((await prisma.rentalProduct.findMany({ where: { id: { in: short.map(s => s.productId) } }, select: { id: true, name: true } })).map(p => [p.id, p.name]));
  return short.map(s => ({ ...s, name: names.get(s.productId) ?? "Product" }));
}

type HireBody = Record<string, unknown>;
/** Fields for a new hire (creating) or a change to one. Lines come back separately. */
export async function hireFields(b: HireBody, entityId: number, creating: boolean, was?: { outDate: Date; returnDate: Date }) {
  const data: Record<string, unknown> = {};
  if (creating || "title" in b) { const t = text(b.title, 160); if (!t) return { error: "Give the hire a name" }; data.title = t; }
  if ("clientName" in b) data.clientName = text(b.clientName, 160);
  if ("clientEmail" in b) {
    const e = text(b.clientEmail, 160);
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: "That email address doesn't look right" };
    data.clientEmail = e;
  }
  if ("notes" in b) data.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 4000) : null;
  if ("productionId" in b) {
    if (b.productionId == null || b.productionId === "") data.productionId = null;
    else {
      const pid = Number(b.productionId);
      if (!(await prisma.production.findUnique({ where: { id: pid }, select: { id: true } }))) return { error: "No such production" };
      data.productionId = pid;
    }
  }
  let outDate = was?.outDate, returnDate = was?.returnDate;
  if (creating || "outDate" in b) { const d = parseDay(b.outDate); if (!d) return { error: "Give the date the kit goes out" }; outDate = d; data.outDate = d; }
  if (creating || "returnDate" in b) { const d = parseDay(b.returnDate); if (!d) return { error: "Give the date the kit comes back" }; returnDate = d; data.returnDate = d; }
  if (outDate && returnDate && returnDate < outDate) return { error: "The kit can't come back before it goes out" };
  if (outDate && returnDate && returnDate.getTime() - outDate.getTime() > 400 * 86_400_000) return { error: "A hire can be up to 400 days; split longer ones" };
  if ("status" in b) {
    if (typeof b.status !== "string" || !(b.status in HIRE_STATUS)) return { error: "Status is quote, confirmed, out, returned or cancelled" };
    data.status = b.status;
  }
  // Pricing and the quote
  for (const [k, max, msg] of [["chargeDays", 1000, "Days charged is 0 to 1000"], ["discountPct", 100, "The discount is 0 to 100%"], ["vatRate", 100, "VAT is 0 to 100%"]] as const) {
    if (!(k in b)) continue;
    if ((b[k] === null || b[k] === "") && k !== "vatRate") { data[k] = null; continue; }
    const n = Number(b[k]);
    if (!isFinite(n) || n < 0 || n > max) return { error: msg };
    data[k] = Math.round(n * 100) / 100;
  }
  for (const k of ["paymentTerms", "customerPo"] as const) if (k in b) data[k] = text(b[k], 80);
  if ("deliveryTo" in b) data.deliveryTo = typeof b.deliveryTo === "string" && b.deliveryTo.trim() ? b.deliveryTo.trim().slice(0, 500) : null;
  if ("terms" in b) data.terms = typeof b.terms === "string" && b.terms.trim() ? b.terms.trim().slice(0, 4000) : null;
  if ("delivery" in b) {
    if (b.delivery != null && b.delivery !== "" && b.delivery !== "collection" && b.delivery !== "delivery") return { error: "Delivery is collection or delivery" };
    data.delivery = b.delivery || null;
  }
  if ("validUntil" in b) {
    if (b.validUntil == null || b.validUntil === "") data.validUntil = null;
    else { const d = parseDay(b.validUntil); if (!d) return { error: "Valid until isn't a date" }; data.validUntil = d; }
  }
  let charges: { description: string; quantity: number; unitPrice: number; sortOrder: number }[] | null = null;
  if ("charges" in b) {
    if (!Array.isArray(b.charges) || b.charges.length > 50) return { error: "Charges must be a list of up to 50" };
    charges = [];
    for (const [i, c] of (b.charges as Record<string, unknown>[]).entries()) {
      const description = text(c?.description, 200);
      const quantity = Number(c?.quantity ?? 1), unitPrice = Number(c?.unitPrice ?? 0);
      if (!description) return { error: "Each charge needs a description" };
      if (!isFinite(quantity) || quantity <= 0 || quantity > 10_000) return { error: "A charge's quantity is more than 0" };
      if (!isFinite(unitPrice) || Math.abs(unitPrice) > 1e7) return { error: "A charge's price is a number" };
      charges.push({ description, quantity, unitPrice: Math.round(unitPrice * 100) / 100, sortOrder: i });
    }
  }
  let lines: Awaited<ReturnType<typeof lineList>> | null = null;
  if ("lines" in b) {
    lines = await lineList(b.lines, entityId);
    if ("error" in lines) return { error: lines.error };
  }
  return { data, charges, lines: lines && "list" in lines ? lines.list : null, outDate: outDate!, returnDate: returnDate! };
}

/** Day and week rates copied from the products for lines that don't give their own */
export async function withRates(lines: LineIn[]) {
  const rates = new Map((await prisma.rentalProduct.findMany({ where: { id: { in: lines.map(l => l.productId) } }, select: { id: true, dayRate: true, weekRate: true } })).map(p => [p.id, p]));
  return lines.map((l, i) => ({
    productId: l.productId, quantity: l.quantity, note: l.note, sortOrder: i,
    dayRate: l.dayRate !== undefined ? l.dayRate : rates.get(l.productId)?.dayRate ?? null,
    weekRate: l.weekRate !== undefined ? l.weekRate : rates.get(l.productId)?.weekRate ?? null,
    unitPrice: l.unitPrice ?? null, discountPct: l.discountPct ?? null,
  }));
}

type HireForTotals = Parameters<typeof hireTotals>[0];
/** A hire as the API sends it: with its money and what it's short of */
export async function hireOut<T extends HireForTotals & { id: number; entityId: number; outDate: Date; returnDate: Date; lines: { productId: number; quantity: number }[] }>(h: T) {
  return { ...h, totals: hireTotals(h), shortages: await shortFor(h.entityId, h) };
}

export { holdsKit };
