// Won deal → production. Creates the production with the deal's client and entity, its PM fee
// and fee stages, puts the creator and the deal's owner on its team, and links deal ↔ production.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseStages } from "@/lib/feeStages";
import { newNumber, retryOnNumberClash } from "@/lib/quoteData";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("opportunity", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Only PSG staff can create productions" }, { status: 403 });
  const userId = Number((session!.user as any).id);
  const id = parseInt((await params).id);
  const deal = await prisma.opportunity.findUnique({ where: { id }, select: { id: true, stage: true, productionId: true, clientId: true, entityId: true, ownerUserId: true } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (deal.stage !== "won") return NextResponse.json({ error: "Only a won deal can become a production" }, { status: 400 });
  if (deal.productionId) return NextResponse.json({ error: "This deal already has a production", productionId: deal.productionId }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Production name required" }, { status: 400 });
  const pmFee = body.pmFee === "" || body.pmFee == null ? null : Number(body.pmFee);
  if (pmFee != null && (!Number.isFinite(pmFee) || pmFee < 0)) return NextResponse.json({ error: "PM fee must be an amount" }, { status: 400 });
  const parsed = parseStages(body.stages ?? []);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const day = (v: unknown) => (typeof v === "string" ? toDate(v) ?? null : null);

  const team = [...new Set([userId, deal.ownerUserId].filter((x): x is number => !!x))];
  const production = await retryOnNumberClash(() => prisma.$transaction(async tx => {
    const p = await tx.production.create({
      data: {
        name,
        type: typeof body.type === "string" && body.type ? body.type : "Other",
        venue: typeof body.venue === "string" && body.venue.trim() ? body.venue.trim() : null,
        startDate: day(body.startDate),
        endDate: day(body.endDate),
        bdClientId: deal.clientId,
        entityId: deal.entityId,
        pmFee,
        feeStages: { create: parsed.stages.map((s, i) => ({ label: s.label, amount: s.amount, dueDate: day(s.dueDate), sortOrder: i })) },
        team: { create: team.map(u => ({ userId: u })) },
      },
      select: { id: true, name: true },
    });
    // Linking inside the transaction: if another request linked this deal first, this fails and rolls back
    const linked = await tx.opportunity.updateMany({ where: { id, productionId: null }, data: { productionId: p.id } });
    if (!linked.count) throw new Error("already linked");
    // The PM job for costing: same client and company, linked to the deal, production and its quotes
    const existingJob = await tx.job.findUnique({ where: { opportunityId: id }, select: { id: true } });
    const job = existingJob
      ? await tx.job.update({ where: { id: existingJob.id }, data: { productionId: p.id } })
      : await tx.job.create({ data: { number: await newNumber("J"), title: p.name, jobType: "pm", entityId: deal.entityId, clientId: deal.clientId, opportunityId: id, productionId: p.id, startDate: day(body.startDate), endDate: day(body.endDate) } });
    await tx.quote.updateMany({ where: { opportunityId: id, jobId: null }, data: { jobId: job.id } });
    await tx.bDActivity.create({ data: { opportunityId: id, kind: "stage", text: `Became the production "${p.name}"`, userId } });
    return p;
  })).catch((err: Error) => (err.message === "already linked" ? null : Promise.reject(err)));
  if (!production) return NextResponse.json({ error: "This deal already has a production" }, { status: 409 });
  return NextResponse.json(production, { status: 201 });
}
