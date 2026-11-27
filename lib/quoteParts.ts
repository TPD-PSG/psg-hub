// A quote's items are the build's parts (28 Nov 2026). On a quote linked to a build, each item
// (section) is one of the build's parts, kept in step whenever the quote is saved:
//   label      the item's name (renaming the item renames the part)
//   hours/days from the item's labour lines (days count as 8 hours, weeks as 5 days)
//   labour type the first labour line whose description is one of the workshop's labour types
//   materials  the item's material lines, at our cost (refreshed each save; ones already ordered
//              on a PO or booked out of stock are never touched or doubled)
// Parts are pencilled until the quote is accepted. Once accepted the quote is locked, so from then
// on the planner owns them. An item removed or left out takes its part off the build, but only
// if nobody has dated, staffed, finished or ordered for it yet.
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { HOURS_PER_DAY } from "./buildQuote";

type QLine = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; kind: string | null; leaveOut: boolean };
const key = (s: string) => s.trim().toLowerCase();
const ADJUSTMENT = "item price adjustment";

/** Hours of labour in an item's lines (null when it has none). */
export function labourHours(lines: Pick<QLine, "kind" | "quantity" | "unit">[]): number | null {
  let hours = 0, any = false;
  for (const l of lines) {
    if (l.kind !== "labour") continue;
    const u = (l.unit ?? "").trim().toLowerCase();
    if (/^(hours?|hrs?|h)$/.test(u)) hours += l.quantity;
    else if (/^days?$/.test(u)) hours += l.quantity * HOURS_PER_DAY;
    else if (/^weeks?$/.test(u)) hours += l.quantity * 5 * HOURS_PER_DAY;
    else continue;
    any = true;
  }
  return any ? Math.round(hours * 100) / 100 : null;
}

/** A part nobody has started on: no date, person, tick or anything ordered/booked out for it. */
const untouched: Prisma.BuildPartWhereInput = { userId: null, startDate: null, done: false, materials: { none: { OR: [{ poId: { not: null } }, { stockMoveId: { not: null } }] } } };

export async function syncQuoteParts(quoteId: number, renames: Record<string, string> = {}) {
  const q = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, jobId: true, entityId: true, job: { select: { stage: true, entityId: true } }, lines: { orderBy: { sortOrder: "asc" }, select: { section: true, description: true, quantity: true, unit: true, unitCost: true, kind: true, leaveOut: true } } },
  });
  if (!q) return;
  // Not linked to a build, or set aside: its untouched parts go
  if (!q.jobId || q.status === "declined") {
    await prisma.buildPart.deleteMany({ where: { quoteId, ...untouched } });
    await prisma.buildPart.updateMany({ where: { quoteId }, data: { quoteId: null, quoteItem: null } }); // the rest stay, unlinked
    return;
  }
  // Accepted: locked, and the planner owns its parts (accepting firms up the pencils elsewhere)
  if (q.status === "accepted") return;

  // Items renamed in the editor: the parts follow before matching
  for (const [from, to] of Object.entries(renames)) {
    if (!from.trim() || !to.trim() || key(from) === key(to)) continue;
    await prisma.buildPart.updateMany({ where: { quoteId, quoteItem: key(from) }, data: { quoteItem: key(to), label: to.trim().slice(0, 120) } });
  }

  const items = new Map<string, { name: string; lines: QLine[] }>();
  for (const l of q.lines) {
    if (!l.section?.trim() || l.leaveOut) continue;
    const k = key(l.section);
    if (!items.has(k)) items.set(k, { name: l.section.trim(), lines: [] });
    items.get(k)!.lines.push(l);
  }
  const entityId = q.job?.entityId ?? q.entityId;
  const types = entityId ? await prisma.labourType.findMany({ where: { entityId }, select: { id: true, name: true } }) : [];
  const parts = await prisma.buildPart.findMany({ where: { quoteId }, select: { id: true, quoteItem: true, label: true, materials: { select: { id: true, description: true, quantity: true, fromQuote: true, poId: true, stockMoveId: true } } } });
  const pencilled = true; // not accepted yet

  for (const [k, item] of items) {
    const hours = labourHours(item.lines);
    const days = hours ? Math.max(1, Math.ceil(hours / HOURS_PER_DAY)) : 1;
    const lt = item.lines.filter(l => l.kind === "labour").map(l => types.find(t => key(t.name) === key(l.description))).find(Boolean);
    const mats = item.lines.filter(l => l.kind === "material" && key(l.description) !== ADJUSTMENT);
    let part = parts.find(p => p.quoteItem === k);
    if (!part) {
      const made = await prisma.buildPart.create({ data: { jobId: q.jobId, label: item.name.slice(0, 120), quoteId, quoteItem: k, pencilled, days, hours, labourTypeId: lt?.id ?? null }, select: { id: true } });
      part = { id: made.id, quoteItem: k, label: item.name, materials: [] };
    } else {
      await prisma.buildPart.update({ where: { id: part.id }, data: { label: item.name.slice(0, 120), days, hours, ...(lt ? { labourTypeId: lt.id } : {}) } });
    }
    // Materials: refresh the ones that came from the quote and haven't been ordered or booked out
    await prisma.buildPartMaterial.deleteMany({ where: { partId: part.id, fromQuote: true, poId: null, stockMoveId: null } });
    const kept = part.materials.filter(m => m.poId != null || m.stockMoveId != null || !m.fromQuote);
    const fresh = mats.filter(l => !kept.some(m => key(m.description) === key(l.description) && m.quantity === l.quantity));
    if (fresh.length) await prisma.buildPartMaterial.createMany({ data: fresh.map((l, i) => ({ partId: part!.id, description: l.description.slice(0, 300), quantity: l.quantity, unit: l.unit, unitCost: l.unitCost, fromQuote: true, sortOrder: 100 + i })) });
  }
  // Items gone (or left out): their untouched parts go; parts someone has started on stay, unlinked
  const gone = parts.filter(p => !items.has(p.quoteItem ?? "")).map(p => p.id);
  if (gone.length) {
    await prisma.buildPart.deleteMany({ where: { id: { in: gone }, ...untouched } });
    await prisma.buildPart.updateMany({ where: { id: { in: gone } }, data: { quoteId: null, quoteItem: null } });
  }
}

/** A quote going away: its parts nobody has started on go too; the rest stay, unlinked. */
export async function dropQuoteParts(quoteId: number) {
  await prisma.buildPart.deleteMany({ where: { quoteId, ...untouched } });
  await prisma.buildPart.updateMany({ where: { quoteId }, data: { quoteId: null, quoteItem: null } });
}
