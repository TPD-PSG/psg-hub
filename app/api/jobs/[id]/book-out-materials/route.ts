// Book a build's estimated stock materials out of stock to the build (27 Nov 2026): each ticked
// line picked from stock is booked out in full (if there's enough), marked as sorted, and costs
// the build at the stock item's cost. Staff of the build's company space.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { staffInSpace } from "@/lib/spaceAccess";
import { PART_SELECT } from "@/lib/buildParts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const out = await denyOutOfScope("job", raw);
  if (out) return out;
  const job = await prisma.job.findUnique({ where: { id: parseInt(raw) || 0 }, select: { id: true, entityId: true, entity: { select: { slug: true } } } });
  if (!job?.entity?.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await staffInSpace(job.entity.slug);
  if ("error" in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body.materialIds) ? [...new Set<number>(body.materialIds.map(Number).filter((n: number) => n > 0))] : [];
  if (!ids.length) return NextResponse.json({ error: "Tick the stock materials to book out" }, { status: 400 });
  const mats = await prisma.buildPartMaterial.findMany({ where: { id: { in: ids }, part: { jobId: job.id } }, select: { id: true, description: true, quantity: true, stockItemId: true, stockMoveId: true, part: { select: { label: true } }, po: { select: { status: true, number: true } } } });
  if (mats.length !== ids.length) return NextResponse.json({ error: "Some of those aren't on this build" }, { status: 400 });
  for (const m of mats) {
    if (!m.stockItemId) return NextResponse.json({ error: `${m.description} wasn't picked from stock` }, { status: 400 });
    if (m.stockMoveId) return NextResponse.json({ error: `${m.description} is already booked out` }, { status: 409 });
    if (m.po && m.po.status !== "cancelled") return NextResponse.json({ error: `${m.description} is on ${m.po.number}` }, { status: 409 });
  }
  // Enough of each item for everything ticked?
  const need = new Map<number, number>();
  for (const m of mats) need.set(m.stockItemId!, (need.get(m.stockItemId!) ?? 0) + m.quantity);
  const items = await prisma.stockItem.findMany({ where: { id: { in: [...need.keys()] }, entityId: job.entityId ?? -1 }, select: { id: true, name: true, quantity: true, unit: true, unitCost: true } });
  for (const [id, q] of need) {
    const it = items.find(i => i.id === id);
    if (!it) return NextResponse.json({ error: "That stock item isn't this workshop's" }, { status: 400 });
    if (q > it.quantity) return NextResponse.json({ error: `Only ${it.quantity} ${it.unit} of ${it.name} in stock (${q} needed). Order the rest instead.` }, { status: 400 });
  }
  // Each material is claimed inside the transaction (only if it isn't booked out yet) and the stock
  // re-checked there, so two quick taps can't book it out twice or take stock below zero (audit round 2)
  const clash = await prisma.$transaction(async tx => {
    for (const m of mats) {
      const it = items.find(i => i.id === m.stockItemId)!;
      const move = await tx.stockMove.create({ data: { itemId: it.id, change: -m.quantity, kind: "book_out", jobId: job.id, unitCost: it.unitCost, note: `For ${m.part.label}`, userId: s.user.userId } });
      const claimed = await tx.buildPartMaterial.updateMany({ where: { id: m.id, stockMoveId: null }, data: { stockMoveId: move.id } });
      const left = await tx.stockItem.updateMany({ where: { id: it.id, quantity: { gte: m.quantity } }, data: { quantity: { decrement: m.quantity } } });
      if (!claimed.count || !left.count) throw new Error(claimed.count ? `Not enough ${it.name} in stock now` : `${m.description} is already booked out`);
    }
    return null;
  }).catch((e: Error) => e.message);
  if (clash) return NextResponse.json({ error: clash }, { status: 409 });
  const parts = await prisma.buildPart.findMany({ where: { jobId: job.id }, select: PART_SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }] });
  return NextResponse.json({ booked: mats.length, parts }, { status: 201 });
}
