// Log a cost against a job (net of VAT). Directors, BD and finance only.
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  if (!v.seeMoney) return NextResponse.json({ error: "Only directors, BD and finance can log costs" }, { status: 403 });
  const jobId = parseInt((await params).id);
  const body = await req.json();
  const amount = Number(body.amount);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "What was it for?" }, { status: 400 });
  if (!Number.isFinite(amount)) return NextResponse.json({ error: "Amount needed" }, { status: 400 });
  if (!(await prisma.job.count({ where: { id: jobId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const t = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 120) : null);
  const cost = await prisma.jobCost.create({
    data: { jobId, amount, description: description.slice(0, 300), supplier: t(body.supplier), category: t(body.category), date: body.date ? new Date(body.date) : new Date(), createdById: v.userId },
  });
  return NextResponse.json(cost, { status: 201 });
}
