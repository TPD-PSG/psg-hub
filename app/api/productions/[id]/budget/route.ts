import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const line = await prisma.budgetLine.create({
    data: {
      productionId: Number(id),
      department: body.department,
      description: body.description,
      budgeted: Number(body.budgeted),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(line, { status: 201 });
}
