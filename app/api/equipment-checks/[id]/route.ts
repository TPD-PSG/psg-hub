// Change or remove a check an item needs (workshop staff). Removing it keeps nothing of its records.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { equipmentList } from "@/lib/equipment";
import { checkFor } from "@/lib/checkRoute";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await checkFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can change checks" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("intervalMonths" in b) {
    const n = Number(b.intervalMonths);
    if (!Number.isInteger(n) || n < 0 || n > 120) return NextResponse.json({ error: "Interval is a number of months (0 for one-off)" }, { status: 400 });
    data.intervalMonths = n; // applies from the next record
  }
  if ("firstDue" in b) data.firstDue = typeof b.firstDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.firstDue) ? new Date(`${b.firstDue}T00:00:00Z`) : null;
  await prisma.equipmentCheck.update({ where: { id: x.c.id }, data });
  return NextResponse.json(await equipmentList(x.v));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await checkFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can remove checks" }, { status: 403 });
  await prisma.equipmentCheck.delete({ where: { id: x.c.id } });
  return NextResponse.json(await equipmentList(x.v));
}
