// "Quote this build": start a quote attached to this job, its lines drafted from the build's
// parts: labour and each part's estimated materials (or, without estimates, its POs and stock),
// each priced at cost plus the chosen markup, grouped by part or by Labour / Materials.
// For people who see money (directors, BD, finance), like the rest of quoting and pricing.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { denyOutOfScope } from "@/lib/companyScope";
import { newNumber } from "@/lib/quoteData";
import { draftBuildLines } from "@/lib/buildQuote";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Quoting is for directors, BD and finance" }, { status: 403 });
  const id = parseInt((await params).id);
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, title: true, jobType: true, entityId: true, clientId: true, opportunityId: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const markup = Number(body.markupPct ?? 30);
  if (!isFinite(markup) || markup < 0 || markup > 1000) return NextResponse.json({ error: "Markup should be a percentage, e.g. 30" }, { status: 400 });
  const group = body.group === "part" ? "part" : "type"; // the build page asks for "part" by default
  const { lines, notes } = body.fromPlan === false ? { lines: [], notes: [] } : await draftBuildLines(id, markup, group);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const q = await prisma.quote.create({
        data: {
          number: await newNumber("Q"), title: job.title, jobType: job.jobType, entityId: job.entityId, clientId: job.clientId,
          opportunityId: job.opportunityId, jobId: job.id, createdById: v.userId,
          internalNotes: [`Drafted from the build's plan at cost + ${markup}%.`, ...notes].join("\n"),
          lines: { create: lines.map((l, i) => ({ ...l, sortOrder: i })) },
        },
        select: { id: true, number: true },
      });
      return NextResponse.json({ ...q, lines: lines.length, notes }, { status: 201 });
    } catch (e) {
      if (!(e instanceof Error) || !/Unique constraint/i.test(e.message) || attempt === 2) throw e;
    }
  }
}
