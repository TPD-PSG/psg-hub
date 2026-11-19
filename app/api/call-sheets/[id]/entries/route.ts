import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const entry = await prisma.callSheetEntry.create({
    data: {
      callSheetId: Number(id),
      discipline: body.discipline,
      name: body.name || null,
      role: body.role || null,
      callTime: body.callTime || null,
      notes: body.notes || null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
