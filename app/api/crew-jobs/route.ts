// Crew jobs on a hire or a production: list them (with who's been asked and booked) or add one.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, jobFields, JOB_INCLUDE, jobSummary } from "@/lib/crewOffers";

export const dynamic = "force-dynamic";
const scope = (q: URLSearchParams | Record<string, unknown>) => {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : q[k]);
  const hireId = Number(get("hireId")) || null, productionId = Number(get("productionId")) || null;
  return hireId && productionId ? null : { hireId, productionId };
};

export async function GET(req: Request) {
  const where = scope(new URL(req.url).searchParams);
  if (!where) return NextResponse.json({ error: "A hire or a production, not both" }, { status: 400 });
  const a = await jobAccess(where);
  if ("error" in a) return a.error;
  const jobs = await prisma.crewJob.findMany({ where: where.hireId ? { hireId: where.hireId } : { productionId: where.productionId! }, include: JOB_INCLUDE, orderBy: [{ date: "asc" }, { callTime: "asc" }] });
  return NextResponse.json({ jobs: jobs.map(j => ({ ...j, summary: jobSummary(j) })) });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const where = scope(b);
  if (!where) return NextResponse.json({ error: "A hire or a production, not both" }, { status: 400 });
  const a = await jobAccess(where);
  if ("error" in a) return a.error;
  const f = jobFields(b, true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const job = await prisma.crewJob.create({ data: { ...(f.data as { role: string; date: Date }), hireId: where.hireId, productionId: where.productionId, createdById: a.userId }, include: JOB_INCLUDE });
  return NextResponse.json({ ...job, summary: jobSummary(job) }, { status: 201 });
}
