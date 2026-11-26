// Shared by routes that act on one machine or induction: the machine's workshop and who's asking.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workshopViewer } from "@/lib/inductions";

export async function machineFor(rawId: string | number) {
  const id = Number(rawId);
  const m = Number.isInteger(id) ? await prisma.machine.findUnique({ where: { id }, select: { id: true, name: true, refresherMonths: true, archived: true, entity: { select: { slug: true } } } }) : null;
  if (!m?.entity.slug) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const v = await workshopViewer(m.entity.slug);
  if ("error" in v) return v;
  return { m, v };
}
