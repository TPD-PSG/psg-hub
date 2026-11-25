// Jobs list and create (PSG staff). Money fields only for those who may see them (lib/jobData).
import { myCompanyLimit, scopedEntityId } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newNumber } from "@/lib/quoteData";
import { jobFields, listJobs, requireJobViewer } from "@/lib/jobData";

export async function GET() {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  return NextResponse.json({ seeMoney: v.seeMoney, jobs: await listJobs(v) });
}

export async function POST(req: Request) {
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Only directors, BD and finance can open jobs" }, { status: 403 });
  const body = await req.json();
  const fields = jobFields(body);
  if (!fields.title) return NextResponse.json({ error: "Give the job a title" }, { status: 400 });
  const ent = scopedEntityId(await myCompanyLimit(), (fields.entityId as number | null | undefined) ?? null);
  if ("error" in ent) return NextResponse.json({ error: ent.error }, { status: 400 });
  if (ent.entityId != null) fields.entityId = ent.entityId;
  // Workshop builds opened by hand start at the Quote stage
  const stage = fields.jobType === "workshop" ? { stage: "quote", stageChangedAt: new Date() } : {};
  const job = await prisma.job.create({ data: { ...fields, ...stage, title: fields.title as string, number: await newNumber("J") } });
  return NextResponse.json(job, { status: 201 });
}
