// Parts of a build: list and add. Any PSG staff.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { partFields, PART_SELECT, partsForViewer } from "@/lib/buildParts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const jobId = parseInt((await params).id);
  return NextResponse.json(partsForViewer(v.seeMoney, await prisma.buildPart.findMany({ where: { jobId }, select: PART_SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }] })));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const jobId = parseInt((await params).id);
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { stage: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const f = await partFields(await req.json(), true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (f.data.pencilled === undefined && job.stage === "quote") f.data.pencilled = true; // still being quoted
  const part = await prisma.buildPart.create({ data: { ...f.data, label: f.data.label as string, jobId }, select: PART_SELECT });
  return NextResponse.json(partsForViewer(v.seeMoney, part), { status: 201 });
}
