import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const movements = await prisma.haulageMovement.findMany({
    orderBy: { departureAt: "asc" },
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(movements);
}
