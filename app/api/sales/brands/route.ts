import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await prisma.salesBrand.findMany({
    orderBy: { name: "asc" },
    include: { tasks: { where: { completedAt: null }, orderBy: { dueDate: "asc" } } },
  });
  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const brand = await prisma.salesBrand.create({
    data: {
      name: body.name,
      category: body.category ?? "other",
      stage: body.stage ?? "prospect",
      website: body.website || null,
      rep: body.rep || null,
      repEmail: body.repEmail || null,
      repPhone: body.repPhone || null,
      notes: body.notes || null,
      priority: body.priority ?? "medium",
    },
    include: { tasks: true },
  });
  return NextResponse.json(brand);
}
