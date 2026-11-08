import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const task = await prisma.bDTask.create({
    data: {
      opportunityId: parseInt(id),
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
