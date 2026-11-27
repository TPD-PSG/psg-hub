// Check a unit in without picking its hire first: it goes back on whichever hire it's out on.
import { NextResponse } from "next/server";
import { staffInRentals } from "@/lib/rentalAccess";
import { scanIn } from "@/lib/rentalWarehouse";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const b = await req.json().catch(() => ({}));
  const r = await scanIn(s.space.id, b.barcode, s.user.userId);
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.status });
  return NextResponse.json({ message: r.message, barcodes: r.barcodes, hireId: r.hireId });
}
