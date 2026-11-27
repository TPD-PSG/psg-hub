import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { afterBudgetChange } from "@/lib/budgetAlerts";
import { requireProductionAccess } from "@/lib/access";
import { money } from "@/lib/parse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "budget");
  if ("error" in access) return access.error;
  if (access.role !== "admin" && access.role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { department: "Pick a department", description: "Add a description" });
  if (bad) return bad;
  const line = await prisma.budgetLine.create({
    data: {
      productionId: Number(id),
      department: body.department,
      description: body.description,
      nominalCode: body.nominalCode || null,
      budgeted: (money(body.budgeted) ?? 0),
      notes: body.notes || null,
    },
  });
  await afterBudgetChange(line.productionId); // the whole budget grows: may drop back under
  return NextResponse.json(line, { status: 201 });
}
