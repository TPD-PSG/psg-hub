import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetVariation", id);
  if ("error" in rec) return rec.error;
  const userId = Number((session.user as { id?: string })?.id);
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.budgetVariation.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Status changes move money on the budget lines, so each happens once, inside one transaction:
  // approving adds the amounts, moving an approved variation away from approved (or deleting it)
  // takes them back off. A double-click or a race can't apply it twice (audit round 2).
  const newStatus = body.status ?? existing.status;
  const include = {
    requestedBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
    items: { include: { budgetLine: { select: { id: true, department: true, description: true } } } },
  };
  const updated = await prisma.$transaction(async tx => {
    const approving = existing.status !== "approved" && newStatus === "approved";
    const unapproving = existing.status === "approved" && newStatus !== "approved";
    let moved = 0;
    if (approving || unapproving) {
      // Only the request that actually changes the status moves the money
      const r = await tx.budgetVariation.updateMany({ where: { id: existing.id, status: existing.status }, data: { status: newStatus } });
      moved = r.count ? (approving ? 1 : -1) : 0;
    }
    const v = await tx.budgetVariation.update({
      where: { id: existing.id },
      data: {
        title: body.title ?? existing.title,
        type: body.type ?? existing.type,
        justification: body.justification ?? existing.justification,
        clientRef: body.clientRef ?? existing.clientRef,
        notes: body.notes ?? existing.notes,
        ...(approving || unapproving ? {} : { status: newStatus }),
        rejectionReason: body.rejectionReason ?? existing.rejectionReason,
        approvedById: newStatus === "approved" ? (userId || existing.approvedById) : existing.approvedById,
        approvedAt: newStatus === "approved" && !existing.approvedAt ? new Date() : existing.approvedAt,
      },
      include,
    });
    if (moved) {
      for (const item of v.items) {
        await tx.budgetLine.update({ where: { id: item.budgetLineId }, data: { budgeted: { increment: moved * item.amount } } });
      }
    }
    return v;
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetVariation", id);
  if ("error" in rec) return rec.error;
  // Deleting an approved variation takes its amounts back off the budget lines (audit round 2)
  await prisma.$transaction(async tx => {
    const v = await tx.budgetVariation.findUnique({ where: { id: Number(id) }, select: { id: true, status: true, items: { select: { budgetLineId: true, amount: true } } } });
    if (!v) return;
    await tx.budgetVariation.delete({ where: { id: v.id } });
    if (v.status === "approved") {
      for (const item of v.items) await tx.budgetLine.update({ where: { id: item.budgetLineId }, data: { budgeted: { decrement: item.amount } } });
    }
  });
  return NextResponse.json({ ok: true });
}
