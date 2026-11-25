// "Quote this build" (TWS, 25 Nov 2026): a quote's lines drafted from the build's own plan.
//   Labour   one line per part. Planned hours → hours at (day rate ÷ 8); else the part's days at
//            the day rate. Day rate = the person's cost per day, else the standard workshop day
//            rate (Settings, workshopDayRate), else £0 and the line says so.
//   Materials the build's purchase orders (not cancelled) and stock booked out to it, at cost.
//   Price    each line's cost plus the markup chosen when starting the quote; adjust after.
import { prisma } from "@/lib/prisma";

export const HOURS_PER_DAY = 8;

export async function workshopDayRate(): Promise<number | null> {
  const s = await prisma.setting.findUnique({ where: { key: "workshopDayRate" } });
  const n = Number(s?.value);
  return s && isFinite(n) && n > 0 ? n : null;
}

type Line = { section: string; description: string; quantity: number; unit: string; unitCost: number; unitPrice: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function draftBuildLines(jobId: number, markupPct: number): Promise<{ lines: Line[]; notes: string[] }> {
  const up = (c: number) => r2(c * (1 + markupPct / 100));
  const std = await workshopDayRate();
  const notes: string[] = [];
  const [parts, pos, moves] = await Promise.all([
    prisma.buildPart.findMany({ where: { jobId }, select: { label: true, days: true, hours: true, user: { select: { name: true, costDayRate: true } } }, orderBy: [{ startDate: "asc" }, { id: "asc" }] }),
    prisma.purchaseOrder.findMany({ where: { jobId, status: { not: "cancelled" } }, select: { number: true, supplierName: true, supplier: { select: { name: true } }, lines: { select: { description: true, quantity: true, unit: true, unitCost: true } } } }),
    prisma.stockMove.findMany({ where: { jobId, kind: { in: ["book_out", "return"] } }, select: { itemId: true, change: true, unitCost: true, item: { select: { name: true, unit: true } } } }),
  ]);
  const lines: Line[] = [];
  for (const p of parts) {
    const rate = p.user?.costDayRate ?? std;
    if (rate == null) notes.push(`No day rate for "${p.label}"${p.user ? ` (${p.user.name})` : ""}: costed at £0`);
    const day = rate ?? 0;
    if (p.hours) lines.push({ section: "Labour", description: `${p.label}${p.user ? ` (${p.user.name})` : ""}`, quantity: p.hours, unit: "hrs", unitCost: r2(day / HOURS_PER_DAY), unitPrice: up(day / HOURS_PER_DAY) });
    else lines.push({ section: "Labour", description: `${p.label}${p.user ? ` (${p.user.name})` : ""}`, quantity: p.days, unit: "days", unitCost: r2(day), unitPrice: up(day) });
  }
  for (const po of pos) for (const l of po.lines) {
    lines.push({ section: "Materials", description: `${l.description} (${po.supplier?.name ?? po.supplierName ?? po.number})`, quantity: l.quantity, unit: l.unit ?? "", unitCost: r2(l.unitCost), unitPrice: up(l.unitCost) });
  }
  // Stock: net quantity per item (book-outs less returns), at the cost when it moved
  const byItem = new Map<number, { name: string; unit: string; qty: number; value: number }>();
  for (const m of moves) {
    const e = byItem.get(m.itemId) ?? { name: m.item.name, unit: m.item.unit, qty: 0, value: 0 };
    e.qty += -m.change; e.value += -m.change * (m.unitCost ?? 0);
    byItem.set(m.itemId, e);
  }
  for (const s of byItem.values()) if (s.qty > 0) {
    const unitCost = r2(s.value / s.qty);
    lines.push({ section: "Materials", description: `${s.name} (from stock)`, quantity: r2(s.qty), unit: s.unit, unitCost, unitPrice: up(unitCost) });
  }
  return { lines, notes };
}
