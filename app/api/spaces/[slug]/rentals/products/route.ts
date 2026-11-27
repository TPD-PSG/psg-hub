// Add a rental product, optionally with its units: a number to barcode automatically, or the
// barcodes already on the stickers (scanned or typed, one per line).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, bad } from "@/lib/rentalAccess";
import { productFields, unitBarcodes } from "@/lib/rentalFields";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const b = await req.json().catch(() => ({}));
  const f = productFields(b, true);
  if ("error" in f) return bad(f.error);
  const codes = await unitBarcodes(b, s.space.shortName ?? s.space.name);
  if ("error" in codes) return bad(codes.error, codes.status);
  const product = await prisma.rentalProduct.create({
    data: { ...(f.data as { name: string }), entityId: s.space.id, units: { create: codes.list.map(barcode => ({ barcode })) } },
    include: { units: true },
  });
  return NextResponse.json(product, { status: 201 });
}
