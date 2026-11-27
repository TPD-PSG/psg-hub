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
