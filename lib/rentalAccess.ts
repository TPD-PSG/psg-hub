// Who may work with rental kit and hires: PSG staff who can open the rentals space it belongs to.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInSpace } from "@/lib/spaceAccess";
import { canSeeCompanyRecord } from "@/lib/spaces";
import { requirePoUser, type PoUser } from "@/lib/purchaseOrders";
import { inService, holdsKit, isPencil, ourShare, type HireForAvailability } from "@/lib/rentals";

const notRentals = () => NextResponse.json({ error: "This space doesn't hold rental kit" }, { status: 404 });

/** A request made inside a rentals space (by its web address). */
export async function staffInRentals(slug: string) {
  const s = await staffInSpace(slug);
  if ("error" in s) return s;
  if (s.space.kind !== "rentals") return { error: notRentals() };
  return s;
}

/** A request about one rental record, checked against the company it belongs to. */
export async function staffForEntity(entityId: number): Promise<{ user: PoUser } | { error: NextResponse }> {
  const user = await requirePoUser();
  if ("error" in user) return user;
  const e = await prisma.entity.findUnique({ where: { id: entityId }, select: { spaceKind: true, hasSpace: true } });
  if (!e || e.spaceKind !== "rentals") return { error: notRentals() };
  if (!(await canSeeCompanyRecord({ id: user.userId, role: user.role }, entityId))) return { error: NextResponse.json({ error: "This space isn't yours" }, { status: 403 }) };
  return { user };
}

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Units in service per product, for one company */
export async function ownedFor(entityId: number) {
  const rows = await prisma.rentalUnit.groupBy({ by: ["productId", "status"], where: { product: { entityId } }, _count: true });
  const owned = new Map<number, number>();
  for (const r of rows) if (inService(r.status)) owned.set(r.productId, (owned.get(r.productId) ?? 0) + r._count);
  return owned;
}

/** Hires that hold or pencil kit around a period (for availability and shortages) */
export async function hiresAround(entityId: number, from: Date, to: Date): Promise<HireForAvailability[]> {
  const hires = await prisma.rentalHire.findMany({
    where: { entityId, status: { in: ["quote", "confirmed", "out"] }, outDate: { lte: to }, returnDate: { gte: from } },
    select: { id: true, number: true, title: true, status: true, outDate: true, returnDate: true, lines: { select: { productId: true, quantity: true } }, subHires: { select: { productId: true, quantity: true } } },
  });
  // A hire holds only what our own kit covers: what's sub-hired for it comes from elsewhere
  return hires.filter(h => holdsKit(h.status) || isPencil(h.status)).map(({ subHires, ...h }) => ({ ...h, lines: ourShare(h.lines, subHires) }));
}

/** The date given as YYYY-MM-DD (or an ISO date), as midnight UTC; null if it isn't one. */
export function parseDay(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export const money = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : NaN;
};
export const text = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);
