// Raise a purchase order for a space (saved as a draft, or submitted straight away)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInSpace } from "@/lib/spaceAccess";
import { poLines, createPurchaseOrder } from "@/lib/purchaseOrders";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInSpace((await params).slug);
  if ("error" in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const l = await poLines(body.lines, s.space.id);
  if ("error" in l) return NextResponse.json({ error: l.error }, { status: 400 });
  const supplierId = body.supplierId ? Number(body.supplierId) : null;
  if (supplierId && !(await prisma.supplier.count({ where: { id: supplierId } }))) return NextResponse.json({ error: "Unknown supplier" }, { status: 400 });
  const supplierName = !supplierId && typeof body.supplierName === "string" && body.supplierName.trim() ? body.supplierName.trim().slice(0, 120) : null;
  if (body.submit && !supplierId && !supplierName) return NextResponse.json({ error: "Who is it from? Pick or type the supplier" }, { status: 400 });
  const jobId = body.jobId ? Number(body.jobId) : null;
  if (jobId && !(await prisma.job.count({ where: { id: jobId, entityId: s.space.id } }))) return NextResponse.json({ error: "Pick one of this company's jobs" }, { status: 400 });
  const po = await createPurchaseOrder({
    entityId: s.space.id, userId: s.user.userId, jobId, supplierId, supplierName, submit: !!body.submit, lines: l.lines,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null,
  });
  return NextResponse.json(po, { status: 201 });
}
