// Order a build's estimated materials (27 Nov 2026): the ticked part materials become one purchase
// order for this build (draft or submitted, same approval limit as any PO), and each line
// remembers it so it isn't ordered twice. A cancelled or deleted PO frees its lines again.
// Staff of the build's company space.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { staffInSpace } from "@/lib/spaceAccess";
import { createPurchaseOrder } from "@/lib/purchaseOrders";
import { PART_SELECT } from "@/lib/buildParts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const out = await denyOutOfScope("job", raw);
  if (out) return out;
  const job = await prisma.job.findUnique({ where: { id: parseInt(raw) || 0 }, select: { id: true, title: true, entity: { select: { slug: true } } } });
  if (!job?.entity?.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await staffInSpace(job.entity.slug);
  if ("error" in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body.materialIds) ? [...new Set<number>(body.materialIds.map(Number).filter((n: number) => n > 0))] : [];
  if (!ids.length) return NextResponse.json({ error: "Tick the materials to order" }, { status: 400 });
  const mats = await prisma.buildPartMaterial.findMany({
    where: { id: { in: ids }, part: { jobId: job.id } },
    select: { id: true, description: true, quantity: true, unit: true, unitCost: true, part: { select: { label: true } }, po: { select: { number: true, status: true } } },
    orderBy: [{ partId: "asc" }, { sortOrder: "asc" }],
  });
  if (mats.length !== ids.length) return NextResponse.json({ error: "Some of those aren't on this build" }, { status: 400 });
  const already = mats.find(m => m.po && m.po.status !== "cancelled");
  if (already) return NextResponse.json({ error: `${already.description} is already on ${already.po!.number}` }, { status: 409 });
  const supplierId = body.supplierId ? Number(body.supplierId) : null;
  if (supplierId && !(await prisma.supplier.count({ where: { id: supplierId } }))) return NextResponse.json({ error: "Unknown supplier" }, { status: 400 });
  const supplierName = !supplierId && typeof body.supplierName === "string" && body.supplierName.trim() ? body.supplierName.trim().slice(0, 120) : null;
  if (body.submit && !supplierId && !supplierName) return NextResponse.json({ error: "Who is it from? Pick or type the supplier" }, { status: 400 });
  const po = await createPurchaseOrder({
    entityId: s.space.id, userId: s.user.userId, jobId: job.id, supplierId, supplierName, submit: !!body.submit,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null,
    lines: mats.map((m, i) => ({ description: m.description, quantity: m.quantity, unit: m.unit, unitCost: m.unitCost, stockItemId: null, sortOrder: i })),
  });
  await prisma.buildPartMaterial.updateMany({ where: { id: { in: ids } }, data: { poId: po.id } });
  const parts = await prisma.buildPart.findMany({ where: { jobId: job.id }, select: PART_SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }] });
  return NextResponse.json({ po: { id: po.id, number: po.number, status: po.status, total: po.total }, parts }, { status: 201 });
}
