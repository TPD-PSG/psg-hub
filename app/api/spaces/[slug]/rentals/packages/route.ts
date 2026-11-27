// Packages: ready-made groups of products for quoting (e.g. "Small PA").
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, bad, text } from "@/lib/rentalAccess";
import { lineList } from "@/lib/rentalFields";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const b = await req.json().catch(() => ({}));
  const name = text(b.name, 120);
  if (!name) return bad("Give the package a name");
  const items = await lineList(b.items ?? [], s.space.id, 100);
  if ("error" in items) return bad(items.error);
  if (!items.list.length) return bad("Add at least one product to the package");
  const merged = merge(items.list);
  const pkg = await prisma.rentalPackage.create({
    data: { entityId: s.space.id, name, description: text(b.description, 500), items: { create: merged } },
    include: { items: { include: { product: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json(pkg, { status: 201 });
}

/** The same product twice in a package becomes one line with the quantities added */
const merge = (l: { productId: number; quantity: number }[]) => [...l.reduce((m, x) => m.set(x.productId, (m.get(x.productId) ?? 0) + x.quantity), new Map<number, number>())].map(([productId, quantity]) => ({ productId, quantity }));
