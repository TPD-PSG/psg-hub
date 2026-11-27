// The warehouse's list: confirmed hires to prep (going out in the next 14 days, or late), and hires
// that are out (to check in), each with how much is scanned.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals } from "@/lib/rentalAccess";
import { prepProgress } from "@/lib/rentals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const soon = new Date(Date.now() + 14 * 86_400_000);
  const hires = await prisma.rentalHire.findMany({
    where: { entityId: s.space.id, OR: [{ status: "confirmed", outDate: { lte: soon } }, { status: "out" }] },
    select: {
      id: true, number: true, title: true, status: true, clientName: true, outDate: true, returnDate: true,
      lines: { select: { productId: true, quantity: true } }, subHires: { select: { productId: true, quantity: true, status: true } },
      units: { select: { backAt: true, unit: { select: { productId: true } } } },
    },
    orderBy: { outDate: "asc" },
  });
  return NextResponse.json({
    space: s.space,
    hires: hires.map(h => {
      const p = prepProgress(h.lines, h.subHires, h.units.map(u => ({ productId: u.unit.productId, back: !!u.backAt })));
      return { id: h.id, number: h.number, title: h.title, status: h.status, clientName: h.clientName, outDate: h.outDate, returnDate: h.returnDate,
        toScan: p.toScan, scanned: h.units.length, outNow: p.outNow, wanted: p.rows.reduce((a, r) => a + r.fromUs, 0), subHiresWaiting: h.subHires.filter(x => x.status === "needed" || x.status === "ordered").length };
    }),
  });
}
