import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  if (access.role !== "admin" && access.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const line = await prisma.budgetLine.create({
    data: {
      productionId: Number(id),
      department: body.department,
      description: body.description,
      nominalCode: body.nominalCode || null,
      budgeted: Number(body.budgeted),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(line, { status: 201 });
}
