// Shared by routes acting on one equipment check: the check, its item, and who's asking.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workshopViewer } from "@/lib/inductions";

export async function checkFor(rawId: string | number) {
  const id = Number(rawId);
  const c = Number.isInteger(id) ? await prisma.equipmentCheck.findUnique({ where: { id }, select: { id: true, kind: true, intervalMonths: true, machine: { select: { id: true, name: true, entityId: true, entity: { select: { slug: true } } } } } }) : null;
  if (!c?.machine.entity.slug) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const v = await workshopViewer(c.machine.entity.slug);
  if ("error" in v) return v;
  return { c, v };
}
