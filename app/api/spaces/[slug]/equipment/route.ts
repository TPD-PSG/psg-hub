// A workshop's equipment and its checks (GET, anyone in the space); add an item (POST, its staff),
// with the checks its category usually needs.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workshopViewer } from "@/lib/inductions";
import { equipmentList } from "@/lib/equipment";
import { isCategory, isKind, USUAL_CHECKS } from "@/lib/equipmentCore";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const v = await workshopViewer((await params).slug);
  if ("error" in v) return v.error;
  return NextResponse.json(await equipmentList(v));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const v = await workshopViewer((await params).slug);
  if ("error" in v) return v.error;
  if (!v.staff) return NextResponse.json({ error: "Only the workshop's staff can add equipment" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Name the item" }, { status: 400 });
  const category = isCategory(b.category) ? b.category : "other";
  const checks = Array.isArray(b.checks) ? b.checks : USUAL_CHECKS[category];
  const clean: { kind: string; intervalMonths: number }[] = [];
  for (const c of checks) {
    const n = Number(c?.intervalMonths);
    if (!isKind(c?.kind) || !Number.isInteger(n) || n < 0 || n > 120) return NextResponse.json({ error: "A check needs a kind and an interval in months" }, { status: 400 });
    clean.push({ kind: c.kind, intervalMonths: n });
  }
  const t = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) || null : null);
  await prisma.machine.create({
    data: {
      entityId: v.space.id, name, category, assetTag: t(b.assetTag, 40), location: t(b.location, 80),
      needsInduction: category === "machine" ? b.needsInduction !== false : !!b.needsInduction,
      checks: { create: clean },
    },
  });
  return NextResponse.json(await equipmentList(v), { status: 201 });
}
