import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: the toolbox-talk sign-off page only needs the show name and venue names.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const production = await prisma.production.findUnique({
    where: { id: Number(id) },
    select: {
      name: true,
      isTour: true,
      tourStops: { select: { id: true, venue: { select: { name: true } } }, orderBy: { stopNumber: "asc" } },
    },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(production);
}
