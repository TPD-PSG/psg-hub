import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const crew = await prisma.crew.findMany({
    orderBy: { name: "asc" },
    include: { productions: { include: { production: true } } },
  });
  return NextResponse.json(crew);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const member = await prisma.crew.create({
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
  return NextResponse.json(member, { status: 201 });
}
