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
  const userId = Number((session.user as any)?.id);
  const body = await req.json();

  const existing = await prisma.budgetVariation.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Handle status transitions
  const newStatus = body.status ?? existing.status;
  const wasApproved = existing.status !== "approved" && newStatus === "approved";

  const updated = await prisma.budgetVariation.update({
    where: { id: Number(id) },
    data: {
      title: body.title ?? existing.title,
      type: body.type ?? existing.type,
      justification: body.justification ?? existing.justification,
      clientRef: body.clientRef ?? existing.clientRef,
      notes: body.notes ?? existing.notes,
      status: newStatus,
      rejectionReason: body.rejectionReason ?? existing.rejectionReason,
      approvedById: newStatus === "approved" ? (userId || existing.approvedById) : existing.approvedById,
      approvedAt: newStatus === "approved" && !existing.approvedAt ? new Date() : existing.approvedAt,
    },
    include: {
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: { include: { budgetLine: { select: { id: true, department: true, description: true } } } },
    },
  });

  // When approved, apply the budget adjustments to the actual budget lines
  if (wasApproved) {
    for (const item of updated.items) {
      await prisma.budgetLine.update({
        where: { id: item.budgetLineId },
        data: { budgeted: { increment: item.amount } },
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("budgetVariation", id);
  if ("error" in rec) return rec.error;
  await prisma.budgetVariation.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
