// A Rentals space's crew rates: the standard pay and client charge for each crew role.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInRentals, bad } from "@/lib/rentalAccess";
import { crewRateFields } from "@/lib/crewRates";
import { crewRatesFor, roleTaken } from "@/lib/crewRateAccess";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  return NextResponse.json({ rates: await crewRatesFor(s.space.id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInRentals((await params).slug);
  if ("error" in s) return s.error;
  const f = crewRateFields(await req.json().catch(() => ({})), true);
  if ("error" in f) return bad(f.error);
  if (await roleTaken(s.space.id, f.data.role as string)) return bad(`There's already a rate for ${f.data.role}`, 409);
  const rate = await prisma.crewRate.create({ data: { ...(f.data as { role: string }), entityId: s.space.id } });
  return NextResponse.json(rate, { status: 201 });
}
