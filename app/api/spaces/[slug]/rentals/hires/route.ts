// Start a hire. It starts as a quote (pencilled: shown on availability, holds nothing).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, bad } from "@/lib/rentalAccess";
import { hireFields, withRates, HIRE_INCLUDE, shortFor } from "@/lib/rentalHires";
import { nextHireNumber } from "@/lib/rentals";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const b = await req.json().catch(() => ({}));
  const f = await hireFields({ ...b, status: "quote" }, s.space.id, true);
  if ("error" in f) return bad(f.error!);
  const lines = await withRates(f.lines ?? []);
  const year = f.outDate.getUTCFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = (await prisma.rentalHire.findMany({ where: { number: { startsWith: `H-${year}-` } }, select: { number: true } })).map(h => h.number);
    try {
      const hire = await prisma.rentalHire.create({
        data: { ...(f.data as { title: string; outDate: Date; returnDate: Date }), entityId: s.space.id, number: nextHireNumber(year, existing), createdById: s.user.userId, lines: { create: lines } },
        include: HIRE_INCLUDE,
      });
      return NextResponse.json({ ...hire, shortages: await shortFor(s.space.id, hire) }, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // number taken at the same moment: try the next
    }
  }
  return bad("Couldn't number the hire; try again", 409);
}
