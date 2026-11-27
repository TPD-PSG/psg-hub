// Look a barcode up (scanned by phone camera or a handheld scanner, or typed).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, notFound } from "@/lib/rentalAccess";
import { cleanBarcode } from "@/lib/rentals";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const code = cleanBarcode(new URL(req.url).searchParams.get("barcode"));
  if (!code) return notFound();
  const unit = await prisma.rentalUnit.findFirst({
    where: { barcode: code, product: { entityId: s.space.id } },
    include: { product: { select: { id: true, name: true, category: true, isCase: true } }, container: { select: { barcode: true } }, contents: { select: { barcode: true, product: { select: { name: true } } } } },
  });
  return unit ? NextResponse.json(unit) : NextResponse.json({ error: `Nothing here has the barcode ${code}` }, { status: 404 });
}
