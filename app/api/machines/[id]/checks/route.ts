// Add a check an item needs on a cycle (workshop staff).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { equipmentList } from "@/lib/equipment";
import { isKind } from "@/lib/equipmentCore";
import { machineFor } from "@/lib/machineRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await machineFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can set checks" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const n = Number(b.intervalMonths);
  if (!isKind(b.kind) || !Number.isInteger(n) || n < 0 || n > 120) return NextResponse.json({ error: "A check needs a kind and an interval in months" }, { status: 400 });
  const firstDue = typeof b.firstDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.firstDue) ? new Date(`${b.firstDue}T00:00:00Z`) : null;
  await prisma.equipmentCheck.create({ data: { machineId: x.m.id, kind: b.kind, intervalMonths: n, firstDue, label: typeof b.label === "string" ? b.label.trim().slice(0, 80) || null : null } });
  return NextResponse.json(await equipmentList(x.v), { status: 201 });
}
