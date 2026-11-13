import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sigs = await prisma.toolboxTalkSignature.findMany({
    where: { productionId: Number(id) },
    orderBy: { createdAt: "desc" },
    select: { id: true, tourStopId: true, venueName: true, signeeName: true, signeeDate: true, employer: true, position: true, agreedBriefing: true, agreedSafety: true, createdAt: true },
  });
  return NextResponse.json(sigs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sig = await prisma.toolboxTalkSignature.create({
    data: {
      productionId: Number(id),
      tourStopId: body.tourStopId ? Number(body.tourStopId) : null,
      venueName: body.venueName || null,
      signeeName: body.signeeName,
      signeeDate: body.signeeDate,
      employer: body.employer || null,
      position: body.position || null,
      signature: body.signature,
      agreedBriefing: !!body.agreedBriefing,
      agreedSafety: !!body.agreedSafety,
    },
  });
  return NextResponse.json(sig, { status: 201 });
}
