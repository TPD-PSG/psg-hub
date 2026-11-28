// Crew rates (PSG Rentals & Crew, 28 Nov 2026): a space's standard rates for each crew role, what
// we pay each person and what the client is charged, by the day, the hour or the job. Picking one
// on a hire's crew job fills the job in. Pure rules here, so the tests can use them directly.

export const RATE_UNIT = { day: "a day", hour: "an hour", job: "for the job" } as const;
export type RateUnit = keyof typeof RATE_UNIT;

export type CrewRateLike = { role: string; unit: string; hours: number | null; payRate: number | null; chargeRate: number | null };

const words = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Check a crew rate's fields (creating needs a role). */
export function crewRateFields(b: Record<string, unknown>, creating: boolean): { data: Record<string, unknown> } | { error: string } {
  const d: Record<string, unknown> = {};
  if (creating || "role" in b) { const r = words(b.role, 80); if (!r) return { error: "Name the role, e.g. Lighting technician" }; d.role = r; }
  if (creating || "unit" in b) {
    const u = b.unit ?? "day";
    if (typeof u !== "string" || !(u in RATE_UNIT)) return { error: "A rate is by the day, the hour or the job" };
    d.unit = u;
  }
  for (const [k, max, msg] of [["payRate", 100_000, "Pay is a number of pounds"], ["chargeRate", 100_000, "The charge is a number of pounds"], ["hours", 24, "Hours are 0 to 24"]] as const) {
    if (!(k in b)) continue;
    if (b[k] == null || b[k] === "") { d[k] = null; continue; }
    const n = Number(b[k]);
    if (!isFinite(n) || n < 0 || n > max) return { error: msg };
    d[k] = round2(n);
  }
  if ("notes" in b) d.notes = words(b.notes, 300);
  if ("onRateCard" in b) d.onRateCard = !!b.onRateCard;
  if ("archived" in b) d.archived = !!b.archived;
  if ("sortOrder" in b) { const n = Number(b.sortOrder); if (!Number.isInteger(n) || n < 0 || n > 10_000) return { error: "Order is a whole number" }; d.sortOrder = n; }
  return { data: d };
}

/** "£250 a day", "£32 an hour (10 hours)", "£400 for the job"; null when there's no amount. */
export function rateLabel(amount: number | null, unit: string, hours?: number | null) {
  if (amount == null) return null;
  const money = `£${amount.toFixed(2).replace(/\.00$/, "")}`;
  return `${money} ${RATE_UNIT[unit as RateUnit] ?? ""}${unit === "hour" && hours ? ` (${hours} hours)` : ""}`.trim();
}

/**
 * A crew job's fields from a rate. A job's pay keeps the rate's unit, but its client charge is per
 * person for the job: by the hour that's the hourly charge × the hours (left blank when the hours
 * aren't known yet).
 */
export function jobFromRate(rate: CrewRateLike, hours?: number | null) {
  const h = hours ?? rate.hours ?? null;
  return {
    role: rate.role,
    payRate: rate.payRate,
    payUnit: rate.unit,
    hours: rate.unit === "hour" ? h : null,
    chargeRate: rate.chargeRate == null ? null : rate.unit === "hour" ? (h ? round2(rate.chargeRate * h) : null) : rate.chargeRate,
  };
}

/** What clients see on the rate card: roles with a charge, never the pay. */
export const forRateCard = <T extends CrewRateLike & { id: number; notes: string | null; onRateCard: boolean; archived: boolean }>(rates: T[]) =>
  rates.filter(r => r.onRateCard && !r.archived && r.chargeRate != null)
    .map(r => ({ id: r.id, role: r.role, unit: r.unit, hours: r.hours, chargeRate: r.chargeRate as number, notes: r.notes }));
