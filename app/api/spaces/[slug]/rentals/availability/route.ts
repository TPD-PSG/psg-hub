// What's free on which dates: each product, day by day, across a period (up to 62 days).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, ownedFor, hiresAround, parseDay, bad } from "@/lib/rentalAccess";
import { availability, holdsKit } from "@/lib/rentals";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const q = new URL(req.url).searchParams;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const from = parseDay(q.get("from")) ?? today;
  const to = parseDay(q.get("to")) ?? new Date(from.getTime() + 13 * 86_400_000);
  if (to < from) return bad("The end date is before the start");
  if (to.getTime() - from.getTime() > 61 * 86_400_000) return bad("Look at up to 62 days at a time");
  const exclude = q.get("exclude") ? Number(q.get("exclude")) : undefined;
  const [owned, hires, products] = await Promise.all([
    ownedFor(s.space.id), hiresAround(s.space.id, from, to),
    prisma.rentalProduct.findMany({ where: { entityId: s.space.id, archived: false }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
  ]);
  const av = availability(owned, hires, from, to, { excludeHireId: exclude });
  return NextResponse.json({
    from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
    products: products.map(p => ({ ...p, ...(av.get(p.id) ?? { owned: 0, held: 0, pencilled: 0, free: 0, byDay: [] }) })),
    hires: hires.filter(h => h.id !== exclude).map(h => ({ id: h.id, number: h.number, title: h.title, status: h.status, holds: holdsKit(h.status), outDate: h.outDate, returnDate: h.returnDate, productIds: [...new Set(h.lines.map(l => l.productId))] })),
  });
}
