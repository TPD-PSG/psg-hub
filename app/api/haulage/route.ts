import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const movements = await prisma.haulageMovement.findMany({
    orderBy: { departureAt: "asc" },
    include: { production: { select: { id: true, name: true } } },
  });
  return NextResponse.json(movements);
}
