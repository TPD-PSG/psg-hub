// A rentals space's kit, packages and hires (PSG Rentals & Crew, replacing Flex).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, ownedFor } from "@/lib/rentalAccess";
import { holdsKit, hireTotals } from "@/lib/rentals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const { space, user } = s;
  const now = new Date();
  const [products, unitRows, packages, hires, productions] = await Promise.all([
    prisma.rentalProduct.findMany({ where: { entityId: space.id, archived: false }, orderBy: { name: "asc" } }),
    prisma.rentalUnit.groupBy({ by: ["productId", "status"], where: { product: { entityId: space.id } }, _count: true }),
    prisma.rentalPackage.findMany({ where: { entityId: space.id, archived: false }, include: { items: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { name: "asc" } }),
    prisma.rentalHire.findMany({
      where: { entityId: space.id, OR: [{ status: { in: ["quote", "confirmed", "out"] } }, { returnDate: { gte: new Date(now.getTime() - 30 * 86_400_000) } }] },
      include: { lines: { select: { productId: true, quantity: true, dayRate: true, weekRate: true, unitPrice: true, discountPct: true } }, charges: { select: { quantity: true, unitPrice: true } }, production: { select: { id: true, name: true } }, invoice: { select: { id: true, status: true } } },
      orderBy: { outDate: "asc" }, take: 300,
    }),
    prisma.production.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingEmail: true }, orderBy: { name: "asc" } });
  const owned = await ownedFor(space.id);
  const counts = new Map<number, Record<string, number>>();
  for (const r of unitRows) counts.set(r.productId, { ...(counts.get(r.productId) ?? {}), [r.status]: r._count });
  // Held right now by hires out today
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const heldToday = new Map<number, number>();
  for (const h of hires) if (holdsKit(h.status) && h.outDate.getTime() <= today && h.returnDate.getTime() >= today) for (const l of h.lines) heldToday.set(l.productId, (heldToday.get(l.productId) ?? 0) + l.quantity);
  return NextResponse.json({
    space, isAdmin: user.role === "admin",
    products: products.map(p => {
      const c = counts.get(p.id) ?? {};
      const total = Object.values(c).reduce((a, b) => a + b, 0);
      return { ...p, units: { total, available: owned.get(p.id) ?? 0, repair: c.repair ?? 0, lost: c.lost ?? 0, retired: c.retired ?? 0 }, outToday: heldToday.get(p.id) ?? 0 };
    }),
    packages,
    hires: hires.map(({ lines, charges, ...h }) => ({ ...h, items: lines.reduce((a, l) => a + l.quantity, 0), net: hireTotals({ ...h, lines, charges }).net })),
    productions, clients,
  });
}
