// While building a quote: find stock items (level, unit, cost) and what we last paid suppliers
// for something similar (from purchase orders), so cost comes from real numbers.
// ?q= text (2+ characters), &entityId= the quote's company (its stock first). Staff only;
// limited to the companies the person can see.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/quoteData";
import { myCompanyLimit } from "@/lib/companyScope";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ stock: [], recent: [] });
  const entityId = Number(url.searchParams.get("entityId")) || null;
  const limit = await myCompanyLimit();
  const entityIn = limit ? { in: limit } : undefined;
  // Each word must appear (so "3x1 pine" finds "Pine PSE 3x1 (69x21mm)")
  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const [stock, lines] = await Promise.all([
    prisma.stockItem.findMany({
      where: { archived: false, ...(entityIn ? { entityId: entityIn } : {}), AND: words.map(w => ({ name: { contains: w } })) },
      select: { id: true, name: true, unit: true, quantity: true, unitCost: true, section: true, entityId: true, supplier: { select: { name: true } } },
      take: 40,
    }),
    prisma.purchaseOrderLine.findMany({
      where: {
        unitCost: { gt: 0 }, AND: words.map(w => ({ description: { contains: w } })),
        po: { status: { not: "cancelled" }, createdAt: { gte: new Date(Date.now() - 400 * 86400e3) }, ...(entityIn ? { entityId: entityIn } : {}) },
      },
      select: { description: true, unit: true, unitCost: true, stockItemId: true, po: { select: { number: true, createdAt: true, entityId: true, supplierName: true, supplier: { select: { name: true } } } } },
      orderBy: { po: { createdAt: "desc" } },
      take: 80,
    }),
  ]);
  // The quote's own company first, then by name
  stock.sort((a, b) => Number(b.entityId === entityId) - Number(a.entityId === entityId) || a.name.localeCompare(b.name));
  // Latest price per description (case-insensitive)
  const seen = new Set<string>();
  const recent = [];
  for (const l of lines) {
    const k = l.description.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    recent.push({ description: l.description, unit: l.unit, unitCost: l.unitCost, supplier: l.po.supplier?.name ?? l.po.supplierName ?? null, poNumber: l.po.number, date: l.po.createdAt, stockItemId: l.stockItemId });
    if (recent.length >= 10) break;
  }
  return NextResponse.json({
    stock: stock.slice(0, 10).map(s => ({ id: s.id, name: s.name, unit: s.unit, quantity: s.quantity, unitCost: s.unitCost, section: s.section, supplier: s.supplier?.name ?? null })),
    recent,
  });
}
