import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "links");
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  const link = await prisma.productionLink.create({
    data: { productionId: Number(id), title: body.title, url: body.url, description: body.description || null },
  });
  return NextResponse.json(link, { status: 201 });
}
