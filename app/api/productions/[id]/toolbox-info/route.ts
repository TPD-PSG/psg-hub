// Public: the name and venues the toolbox-talk form shows. [id] is the private toolbox token
// (or an old numeric link, see lib/toolbox.ts); anything else gets "not found".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toolboxTarget } from "@/lib/toolbox";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productionId = await toolboxTarget(id);
  const production = productionId ? await prisma.production.findUnique({ where: { id: productionId }, select: { name: true, isTour: true, tourStops: { select: { id: true, venue: { select: { name: true } } }, orderBy: { stopNumber: "asc" } } } }) : null;
  if (!production) return NextResponse.json({ error: "This sign-off form is no longer active" }, { status: 404 });
  return NextResponse.json(production);
}
