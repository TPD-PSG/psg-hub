// A space's build templates (staff): name, unit, and a per-unit summary.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { readParts, materialsPerUnit, daysPerUnit } from "@/lib/buildTemplates";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const rows = await prisma.buildTemplate.findMany({ where: { entityId: m.space.id }, orderBy: { name: "asc" } });
  return NextResponse.json(rows.map(t => {
    const parts = readParts(t.parts);
    return { id: t.id, name: t.name, unitName: t.unitName, notes: t.notes, createdById: t.createdById, parts: parts.map(p => p.label), materials: parts.reduce((s, p) => s + p.materials.length, 0), materialsCost: materialsPerUnit(parts), days: daysPerUnit(parts) };
  }));
}
