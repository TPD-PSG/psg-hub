import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
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
