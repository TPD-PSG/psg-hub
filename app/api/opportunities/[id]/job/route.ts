// Won deal → job, for work that isn't a production (a Workshop build, a Night Run move…). PM work
// gets its job when the deal becomes a production. Takes the deal's client, company and quotes.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newNumber } from "@/lib/quoteData";
import { requireJobViewer } from "@/lib/jobData";
import { JOB_TYPES } from "@/lib/quotes";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Only directors, BD and finance can open jobs" }, { status: 403 });
  const id = parseInt((await params).id);
  const deal = await prisma.opportunity.findUnique({ where: { id }, select: { stage: true, title: true, type: true, clientId: true, entityId: true, value: true, job: { select: { id: true } } } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (deal.stage !== "won") return NextResponse.json({ error: "Only a won deal can become a job" }, { status: 400 });
  if (deal.job) return NextResponse.json({ error: "This deal already has a job", jobId: deal.job.id }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const jobType = JOB_TYPES.some(t => t.key === body.jobType) ? body.jobType : deal.type === "scenic" ? "workshop" : "other";
  const job = await prisma.$transaction(async tx => {
    const j = await tx.job.create({
      // A won deal has been confirmed, so workshop builds start at Confirmation
      data: {
        number: await newNumber("J"), title: deal.title, jobType, entityId: deal.entityId, clientId: deal.clientId, opportunityId: id, price: deal.value,
        ...(jobType === "workshop" ? { stage: "confirmation", stageChangedAt: new Date() } : {}),
      },
    });
    await tx.quote.updateMany({ where: { opportunityId: id, jobId: null }, data: { jobId: j.id } });
    await tx.bDActivity.create({ data: { opportunityId: id, kind: "stage", text: `Became job ${j.number}`, userId: v.userId } });
    return j;
  });
  return NextResponse.json(job, { status: 201 });
}
