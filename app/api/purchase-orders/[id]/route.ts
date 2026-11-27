// Move a purchase order on: submit, approve, send back, mark ordered, mark delivered (stock goes
// up), cancel, tick "in Sage", or edit/delete while it's a draft.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePoUser, PO_INCLUDE, poLines, poTotal, poApprovalLimit } from "@/lib/purchaseOrders";
import { canSeeCompanyRecord } from "@/lib/spaces";

const load = (id: number) => prisma.purchaseOrder.findUnique({ where: { id }, include: PO_INCLUDE });
const done = async (id: number) => { const po = await load(id); return NextResponse.json({ ...po, total: poTotal(po!.lines) }); };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const id = parseInt((await params).id);
  const po = await load(id);
  if (!po) return bad("Not found", 404);
  if (!(await canSeeCompanyRecord({ id: u.userId, role: u.role }, po.entityId))) return bad("This space isn't yours", 403);
  const body = await req.json();
  const action = body.action as string;
  const now = new Date();

  if (action === "edit") {
    if (po.status !== "draft") return bad("Only a draft can be edited");
    const data: Record<string, unknown> = {};
    if ("lines" in body) {
      const l = await poLines(body.lines, po.entityId);
      if ("error" in l) return bad(l.error);
      await prisma.purchaseOrderLine.deleteMany({ where: { poId: id } });
      data.lines = { create: l.lines };
    }
    if ("supplierId" in body) data.supplierId = body.supplierId ? Number(body.supplierId) : null;
    if ("supplierName" in body) data.supplierName = typeof body.supplierName === "string" && body.supplierName.trim() ? body.supplierName.trim() : null;
    if ("jobId" in body) {
      const jobId = body.jobId ? Number(body.jobId) : null;
      if (jobId && !(await prisma.job.count({ where: { id: jobId, entityId: po.entityId ?? -1 } }))) return bad("Pick one of this company's jobs");
      data.jobId = jobId;
    }
    if ("notes" in body) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    await prisma.purchaseOrder.update({ where: { id }, data });
    return done(id);
  }
  if (action === "submit") {
    if (po.status !== "draft") return bad("This PO has already been submitted");
    if (!po.supplierId && !po.supplierName) return bad("Who is it from? Pick or type the supplier");
    if (!po.lines.length) return bad("Add at least one line");
    const ok = poTotal(po.lines) <= (await poApprovalLimit());
    await prisma.purchaseOrder.update({ where: { id }, data: ok ? { status: "approved", approvedAt: now } : { status: "awaiting_approval" } });
    return done(id);
  }
  if (action === "approve" || action === "send_back") {
    if (!u.canApprove) return bad("Only admins or Finance can approve purchase orders", 403);
    if (po.status !== "awaiting_approval") return bad("This PO isn't waiting for approval");
    if (action === "approve") await prisma.purchaseOrder.update({ where: { id }, data: { status: "approved", approvedAt: now, approvedById: u.userId } });
    else {
      const why = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Sent back";
      await prisma.purchaseOrder.update({ where: { id }, data: { status: "draft", notes: [po.notes, `Sent back: ${why}`].filter(Boolean).join("\n") } });
    }
    return done(id);
  }
  if (action === "order") {
    if (po.status !== "approved") return bad("Only an approved PO can be marked as ordered");
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "ordered", orderedAt: now } });
    return done(id);
  }
  if (action === "deliver") {
    if (po.status !== "approved" && po.status !== "ordered") return bad("Only an approved or ordered PO can be marked as delivered");
    // Delivered lines linked to stock items top the stock up (and set the item's latest cost).
    // Only the request that actually moves it to "delivered" adds the stock, so a double-click
    // or retry can't deliver twice (audit round 2).
    const moved = await prisma.$transaction(async tx => {
      const r = await tx.purchaseOrder.updateMany({ where: { id, status: { in: ["approved", "ordered"] } }, data: { status: "delivered", deliveredAt: now, orderedAt: po.orderedAt ?? now } });
      if (!r.count) return false;
      for (const l of po.lines.filter(x => x.stockItemId)) {
        await tx.stockMove.create({ data: { itemId: l.stockItemId!, change: l.quantity, kind: "delivery", poId: id, unitCost: l.unitCost, note: po.number, userId: u.userId } });
        await tx.stockItem.update({ where: { id: l.stockItemId! }, data: { quantity: { increment: l.quantity }, ...(l.unitCost > 0 ? { unitCost: l.unitCost } : {}) } });
      }
      return true;
    });
    if (!moved) return bad("This PO has already been marked as delivered", 409);
    return done(id);
  }
  if (action === "cancel") {
    if (po.status === "delivered" || po.status === "cancelled") return bad("This PO can't be cancelled now");
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
    return done(id);
  }
  if (action === "sage") {
    if (!u.canApprove) return bad("Only admins or Finance can mark POs as in Sage", 403);
    if (po.status !== "delivered") return bad("Mark it delivered first");
    await prisma.purchaseOrder.update({ where: { id }, data: { inSage: !!body.inSage } });
    return done(id);
  }
  return bad("Unknown action");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const id = parseInt((await params).id);
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true, entityId: true } });
  if (!po) return bad("Not found", 404);
  if (!(await canSeeCompanyRecord({ id: u.userId, role: u.role }, po.entityId))) return bad("This space isn't yours", 403);
  if (po.status !== "draft") return bad("Only a draft can be deleted (cancel it instead)");
  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
