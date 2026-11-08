import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.crew.findUnique({
    where: { id: Number(id) },
    include: { productions: { include: { production: true } } },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const member = await prisma.crew.update({
    where: { id: Number(id) },
    data: {
      name:                body.name,
      discipline:          body.discipline,
      phone:               body.phone || null,
      email:               body.email || null,
      company:             body.company || null,
      isFreelance:         body.isFreelance ?? true,
      insuranceProvider:   body.insuranceProvider || null,
      insurancePolicyNo:   body.insurancePolicyNo || null,
      insuranceExpiry:     body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      insuranceCoverType:  body.insuranceCoverType || null,
      notes:               body.notes || null,
    },
  });
  return NextResponse.json(member);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.crew.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
