// Jobs list and create (PSG staff). Money fields only for those who may see them (lib/jobData).
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
  const job = await prisma.job.create({ data: { ...fields, title: fields.title as string, number: await newNumber("J") } });
  return NextResponse.json(job, { status: 201 });
}
