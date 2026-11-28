// The crew rates to pick from when adding a crew job to this hire (its space's, not archived).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound } from "@/lib/rentalAccess";
import { crewRatesFor } from "@/lib/crewRateAccess";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id);
  const h = Number.isInteger(id) ? await prisma.rentalHire.findUnique({ where: { id }, select: { entityId: true } }) : null;
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  return NextResponse.json({ rates: await crewRatesFor(h.entityId, false) });
}
