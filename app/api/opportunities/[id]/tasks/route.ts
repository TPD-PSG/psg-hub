import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await req.json().catch(() => ({}));
  const bad = missing(data, { description: "Say what needs doing" });
  if (bad) return bad;
  const task = await prisma.bDTask.create({
    data: {
      opportunityId: parseInt(id),
      description: data.description,
      dueDate: (toDate(data.dueDate) ?? null),
    },
  });
  return NextResponse.json(task, { status: 201 });
}
