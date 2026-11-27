// A deal's activity log: notes, calls, emails and meetings people add, plus stage changes the
// API logs itself. Adding an activity can set the next follow-up date in the same step.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ACTIVITY_KINDS } from "@/lib/bdPipeline";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const opportunityId = parseInt((await params).id);
  const activities = await prisma.bDActivity.findMany({
    where: { opportunityId },
    orderBy: { at: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return NextResponse.json(activities);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const opportunityId = parseInt((await params).id);
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Say what happened" }, { status: 400 });
  const kind = ACTIVITY_KINDS.some(k => k.key === body.kind) ? body.kind : "note";
  if (!(await prisma.opportunity.count({ where: { id: opportunityId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [activity] = await prisma.$transaction([
    prisma.bDActivity.create({
      data: { opportunityId, kind, text: text.slice(0, 4000), userId: Number((session.user as any).id) || null },
      include: { user: { select: { id: true, name: true } } },
    }),
    // "followUpDate" in the body (even empty) replaces the deal's next follow-up
    ...("followUpDate" in body
      ? [prisma.opportunity.update({ where: { id: opportunityId }, data: { followUpDate: (toDate(body.followUpDate) ?? null) } })]
      : []),
  ]);
  return NextResponse.json(activity, { status: 201 });
}
