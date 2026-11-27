// The sidebar's quick look-up: a production's name and whether it tours (signed-in, with access).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const p = await prisma.production.findUnique({ where: { id: Number(id) }, select: { name: true, isTour: true, color: true } }); // color: the new look marks the active section in it
  return p ? NextResponse.json(p) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
