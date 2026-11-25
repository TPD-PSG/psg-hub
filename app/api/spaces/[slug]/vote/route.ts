// Build of the month: vote for one of this month's nominees (changeable until the month ends)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember, buildOfMonth, monthKey } from "@/lib/spaceBoard";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  const jobId = Number((await req.json()).jobId);
  const botm = await buildOfMonth(m.space.id, m.userId);
  if (!botm.nominees.some(n => n.job.id === jobId)) return NextResponse.json({ error: "That build isn't up for build of the month" }, { status: 400 });
  const month = monthKey();
  await prisma.buildVote.upsert({
    where: { entityId_monthYear_userId: { entityId: m.space.id, monthYear: month, userId: m.userId } },
    update: { jobId }, create: { entityId: m.space.id, monthYear: month, userId: m.userId, jobId },
  });
  return NextResponse.json(await buildOfMonth(m.space.id, m.userId));
}
