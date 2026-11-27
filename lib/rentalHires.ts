// Hires: checking dates and lines, and what a hire is short of over its dates.
import { prisma } from "@/lib/prisma";
import { ownedFor, hiresAround, parseDay, text } from "@/lib/rentalAccess";
import { lineList } from "@/lib/rentalFields";
import { shortages, HIRE_STATUS, holdsKit } from "@/lib/rentals";

export const HIRE_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" as const }, include: { product: { select: { id: true, name: true, category: true, dayRate: true } } } },
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
  let lines: Awaited<ReturnType<typeof lineList>> | null = null;
  if ("lines" in b) {
    lines = await lineList(b.lines, entityId);
    if ("error" in lines) return { error: lines.error };
  }
  return { data, lines: lines && "list" in lines ? lines.list : null, outDate: outDate!, returnDate: returnDate! };
}

/** Day rates copied from the products for lines that don't give their own */
export async function withRates(lines: { productId: number; quantity: number; note: string | null; dayRate?: number | null }[]) {
  const rates = new Map((await prisma.rentalProduct.findMany({ where: { id: { in: lines.map(l => l.productId) } }, select: { id: true, dayRate: true } })).map(p => [p.id, p.dayRate]));
  return lines.map((l, i) => ({ productId: l.productId, quantity: l.quantity, note: l.note, dayRate: l.dayRate !== undefined ? l.dayRate : rates.get(l.productId) ?? null, sortOrder: i }));
}

export { holdsKit };
