// PSG Rentals & Crew (replacing Flex, 27 Nov 2026): the rules for rental kit, kept free of the
// database so tests can check them directly. Every unit is serialised, cables included.

export const RENTAL_CATEGORIES = ["Lighting", "Sound", "Video", "Rigging", "Power", "Cable", "Staging", "Comms", "Cases", "Consumables"] as const;
export const NO_CATEGORY = "Other";

export const UNIT_STATUS = {
  available: "Available",
  repair: "In repair",
  lost: "Lost",
  retired: "Retired",
} as const;
export type UnitStatus = keyof typeof UNIT_STATUS;
/** Units that count towards what can go out on a hire */
export const inService = (status: string) => status === "available";

export const HIRE_STATUS = {
  quote: "Quote",
  confirmed: "Confirmed",
  out: "Out",
  returned: "Returned",
  cancelled: "Cancelled",
} as const;
export type HireStatus = keyof typeof HIRE_STATUS;
/** Hires that hold their kit for their dates. Quotes are pencilled: shown, but hold nothing. */
export const holdsKit = (status: string) => status === "confirmed" || status === "out";
export const isPencil = (status: string) => status === "quote";

/** Tidy a barcode as typed or scanned (handheld scanners often add spaces or a newline). */
export const cleanBarcode = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/g, "").toUpperCase().slice(0, 40) : "");
export const validBarcode = (s: string) => /^[A-Z0-9._\-/]{3,40}$/.test(s);

/** Next free barcodes with a prefix: RC000001, RC000002… skipping any already used. */
export function nextBarcodes(prefix: string, used: Iterable<string>, count: number): string[] {
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "RC";
  const re = new RegExp(`^${p}(\\d+)$`);
  let max = 0;
  const taken = new Set<string>();
  for (const b of used) {
    taken.add(b);
    const m = re.exec(b);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const out: string[] = [];
  for (let n = max + 1; out.length < count; n++) {
    const b = `${p}${String(n).padStart(6, "0")}`;
    if (!taken.has(b)) out.push(b);
  }
  return out;
}

const DAY = 86_400_000;
/** Midnight UTC of the date part, so a hire's days are whole calendar days. */
export const dayOf = (d: Date | string) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};
/** Days a hire is away, counting both the out day and the return day. */
export const hireDays = (outDate: Date | string, returnDate: Date | string) => Math.max(1, Math.round((dayOf(returnDate) - dayOf(outDate)) / DAY) + 1);
/** Two hires clash when their days overlap (going out the day another comes back counts). */
export const overlaps = (aOut: Date | string, aIn: Date | string, bOut: Date | string, bIn: Date | string) =>
  dayOf(aOut) <= dayOf(bIn) && dayOf(bOut) <= dayOf(aIn);

export type HireForAvailability = { id: number; number?: string; title?: string; status: string; outDate: Date | string; returnDate: Date | string; lines: { productId: number; quantity: number }[] };

/**
 * For each product, what's free across a period: in-service units minus the most any one day of
 * the period has held on other hires. Pencilled (quote) hires are counted separately, never held.
 */
export function availability(
  owned: Map<number, number>, // productId → units in service
  hires: HireForAvailability[],
  from: Date | string, to: Date | string,
  opts: { excludeHireId?: number } = {},
) {
  const days: number[] = [];
  for (let d = dayOf(from); d <= dayOf(to); d += DAY) days.push(d);
  const held = new Map<number, number[]>(), pencil = new Map<number, number[]>();
  const add = (m: Map<number, number[]>, pid: number, i: number, q: number) => {
    if (!m.has(pid)) m.set(pid, days.map(() => 0));
    m.get(pid)![i] += q;
  };
  for (const h of hires) {
    if (h.id === opts.excludeHireId || !(holdsKit(h.status) || isPencil(h.status))) continue;
    const a = dayOf(h.outDate), b = dayOf(h.returnDate);
    days.forEach((d, i) => {
      if (d < a || d > b) return;
      for (const l of h.lines) add(holdsKit(h.status) ? held : pencil, l.productId, i, l.quantity);
    });
  }
  const ids = new Set([...owned.keys(), ...held.keys(), ...pencil.keys()]);
  const out = new Map<number, { owned: number; held: number; pencilled: number; free: number; byDay: { day: string; held: number; pencilled: number; free: number }[] }>();
  for (const pid of ids) {
    const own = owned.get(pid) ?? 0;
    const h = held.get(pid) ?? days.map(() => 0), p = pencil.get(pid) ?? days.map(() => 0);
    const byDay = days.map((d, i) => ({ day: new Date(d).toISOString().slice(0, 10), held: h[i], pencilled: p[i], free: own - h[i] }));
    out.set(pid, { owned: own, held: Math.max(0, ...h), pencilled: Math.max(0, ...p), free: own - Math.max(0, ...h), byDay });
  }
  return out;
}

/** What a hire is short of: lines asking for more than is free over its dates (other hires only). */
export function shortages(
  hire: { id?: number; outDate: Date | string; returnDate: Date | string; lines: { productId: number; quantity: number }[] },
  owned: Map<number, number>, others: HireForAvailability[],
) {
  const need = new Map<number, number>();
  for (const l of hire.lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.quantity);
  const av = availability(owned, others, hire.outDate, hire.returnDate, { excludeHireId: hire.id });
  const short: { productId: number; wanted: number; free: number; short: number }[] = [];
  for (const [pid, wanted] of need) {
    const free = Math.max(0, av.get(pid)?.free ?? owned.get(pid) ?? 0);
    if (wanted > free) short.push({ productId: pid, wanted, free, short: wanted - free });
  }
  return short;
}

/** Hire numbers run per year: H-2026-001, H-2026-002… */
export function nextHireNumber(year: number, existing: string[]) {
  const re = new RegExp(`^H-${year}-(\\d+)$`);
  const max = existing.reduce((m, n) => { const x = re.exec(n); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `H-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Group products by category: the usual order first, then the team's own, then Other. */
export function groupByCategory<T extends { category: string | null; name: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const i of items) {
    const k = i.category || NO_CATEGORY;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  const order = (k: string) => { const i = (RENTAL_CATEGORIES as readonly string[]).indexOf(k); return k === NO_CATEGORY ? 1e6 : i < 0 ? 1e3 : i; };
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, list]) => ({ category, items: list.sort((a, b) => a.name.localeCompare(b.name)) }));
}

// ── Pricing (stage 2) ─────────────────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What one unit costs for a number of charged days. With a week rate, each full week costs the
 * week rate, and the days left over cost their day rates but never more than another week.
 */
export function rateFor(days: number, dayRate: number | null, weekRate: number | null) {
  const d = Math.max(0, days);
  const day = dayRate ?? 0;
  if (weekRate == null || weekRate <= 0) return r2(d * day);
  const weeks = Math.floor(d / 7), rest = d - weeks * 7;
  return r2(weeks * weekRate + Math.min(rest * day, weekRate));
}

export type PricedLine = { quantity: number; dayRate: number | null; weekRate?: number | null; unitPrice?: number | null; discountPct?: number | null };
/** A kit line: its price per unit for the hire (our own price, else the rates) and its amount after its discount. */
export function linePrice(l: PricedLine, chargeDays: number) {
  const each = l.unitPrice != null ? r2(l.unitPrice) : rateFor(chargeDays, l.dayRate, l.weekRate ?? null);
  const gross = r2(each * l.quantity);
  const off = l.discountPct ? r2((gross * Math.min(100, Math.max(0, l.discountPct))) / 100) : 0;
  return { each, gross, off, amount: r2(gross - off) };
}

/** Days charged: as set on the hire, else every day it's away. */
export const chargedDays = (h: { chargeDays?: number | null; outDate: Date | string; returnDate: Date | string }) =>
  h.chargeDays != null && h.chargeDays >= 0 ? h.chargeDays : hireDays(h.outDate, h.returnDate);

/** A hire's money: kit (after line discounts, then the hire's discount), other charges, VAT. */
export function hireTotals(h: {
  chargeDays?: number | null; outDate: Date | string; returnDate: Date | string; discountPct?: number | null; vatRate: number;
  lines: PricedLine[]; charges: { quantity: number; unitPrice: number }[];
}) {
  const days = chargedDays(h);
  const priced = h.lines.map(l => linePrice(l, days));
  const kit = r2(priced.reduce((a, p) => a + p.amount, 0));
  const lineDiscounts = r2(priced.reduce((a, p) => a + p.off, 0));
  const hireDiscount = h.discountPct ? r2((kit * Math.min(100, Math.max(0, h.discountPct))) / 100) : 0;
  const charges = r2(h.charges.reduce((a, c) => a + c.quantity * c.unitPrice, 0));
  const net = r2(kit - hireDiscount + charges);
  const vat = r2((net * h.vatRate) / 100);
  return { days, priced, kit, lineDiscounts, hireDiscount, charges, net, vat, gross: r2(net + vat) };
}

/** When the invoice is due, from the payment terms: "30 days" → 30 days after issue; "In advance" → the day it goes out. */
export function invoiceDue(terms: string | null | undefined, issued: Date, outDate: Date) {
  const t = (terms ?? "").toLowerCase();
  const m = /(\d{1,3})\s*days?/.exec(t);
  if (m) return new Date(issued.getTime() + Number(m[1]) * DAY);
  if (/advance|on order|before/.test(t)) return outDate < issued ? issued : outDate;
  return new Date(issued.getTime() + 30 * DAY);
}

// ── Warehouse (stage 3) ───────────────────────────────────────────────────────────────────────
export const SUBHIRE_STATUS = { needed: "Needed", ordered: "Ordered", received: "Received", returned: "Sent back" } as const;
export const CONDITION = { ok: "Back OK", damaged: "Damaged", missing: "Missing" } as const;

/**
 * Prep progress for a hire: for each product, how many it wants, how many are covered by
 * sub-hires, how many of our units are scanned out, and how many are still to scan.
 * Units of products that aren't on the hire (cases, or things packed in them) are "extra".
 */
export function prepProgress(
  lines: { productId: number; quantity: number }[],
  subHires: { productId: number | null; quantity: number }[],
  scanned: { productId: number; back: boolean }[],
) {
  const want = new Map<number, number>(), sub = new Map<number, number>(), out = new Map<number, number>(), back = new Map<number, number>();
  for (const l of lines) want.set(l.productId, (want.get(l.productId) ?? 0) + l.quantity);
  for (const s of subHires) if (s.productId != null) sub.set(s.productId, (sub.get(s.productId) ?? 0) + s.quantity);
  for (const u of scanned) { out.set(u.productId, (out.get(u.productId) ?? 0) + 1); if (u.back) back.set(u.productId, (back.get(u.productId) ?? 0) + 1); }
  const rows = [...want].map(([productId, wanted]) => {
    const fromUs = Math.max(0, wanted - (sub.get(productId) ?? 0));
    const sc = out.get(productId) ?? 0;
    return { productId, wanted, subHired: Math.min(wanted, sub.get(productId) ?? 0), fromUs, scanned: sc, toScan: Math.max(0, fromUs - sc), back: back.get(productId) ?? 0 };
  });
  const extra = [...out].filter(([pid]) => !want.has(pid)).map(([productId, n]) => ({ productId, scanned: n, back: back.get(productId) ?? 0 }));
  const toScan = rows.reduce((a, r) => a + r.toScan, 0);
  const outNow = scanned.filter(u => !u.back).length;
  return { rows, extra, toScan, ready: toScan === 0, outNow, allBack: scanned.length > 0 && outNow === 0 };
}

/** A hire's lines less what's sub-hired for it: what our own kit has to cover. */
export function ourShare(lines: { productId: number; quantity: number }[], subHires: { productId: number | null; quantity: number }[]) {
  const sub = new Map<number, number>();
  for (const s of subHires) if (s.productId != null) sub.set(s.productId, (sub.get(s.productId) ?? 0) + s.quantity);
  return lines.map(l => {
    const take = Math.min(l.quantity, sub.get(l.productId) ?? 0);
    sub.set(l.productId, (sub.get(l.productId) ?? 0) - take);
    return { productId: l.productId, quantity: l.quantity - take };
  }).filter(l => l.quantity > 0);
}
