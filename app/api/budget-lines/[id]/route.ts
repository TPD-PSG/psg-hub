import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { money } from "@/lib/parse";
import { removeFile } from "@/lib/storage";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("budgetLine", id);

  if ("error" in rec) return rec.error;
  const body = await req.json();
  const line = await prisma.budgetLine.update({
    where: { id: Number(id) },
    data: {
      department: body.department,
      description: body.description,
      nominalCode: body.nominalCode || null,
      budgeted: (money(body.budgeted) ?? 0),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(line);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rec = await requireRecordAccess("budgetLine", id);

  if ("error" in rec) return rec.error;
  // Its expenses and their receipts go with it; note the R2 files first
  const docs = await prisma.spendDocument.findMany({ where: { expense: { budgetLineId: Number(id) } }, select: { fileKey: true } });
  await prisma.budgetLine.delete({ where: { id: Number(id) } });
  for (const d of docs) await removeFile(d.fileKey);
  return NextResponse.json({ ok: true });
}
