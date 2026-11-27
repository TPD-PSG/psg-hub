// A build's checklists: list, add one, or add the standard ready-to-collect checks. PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { denyOutOfScope } from "@/lib/companyScope";
import { CHECK_KINDS, CHECK_SELECT, STANDARD_COLLECT_CHECKS } from "@/lib/buildChecks";

const list = (jobId: number) => prisma.buildCheck.findMany({ where: { jobId }, select: CHECK_SELECT, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  return NextResponse.json(await list(parseInt((await params).id)));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id);
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const jobId = parseInt((await params).id);
  if (!(await prisma.job.count({ where: { id: jobId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const max = (await prisma.buildCheck.aggregate({ where: { jobId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  if (body.standard === "collect") {
    const have = new Set((await prisma.buildCheck.findMany({ where: { jobId, kind: "collect" }, select: { text: true } })).map(c => c.text.toLowerCase()));
    const add = STANDARD_COLLECT_CHECKS.filter(t => !have.has(t.toLowerCase()));
    await prisma.buildCheck.createMany({ data: add.map((text, i) => ({ jobId, kind: "collect", text, sortOrder: max + i + 1 })) });
    return NextResponse.json(await list(jobId), { status: 201 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (!text) return NextResponse.json({ error: "Write the check" }, { status: 400 });
  const kind = (CHECK_KINDS as readonly string[]).includes(body.kind) ? body.kind : "snag";
  // The shared workshop tablet says who tapped it (it's signed in as one staff member)
  const raisedBy = Number(body.raisedById) && (await prisma.user.count({ where: { id: Number(body.raisedById) } })) ? Number(body.raisedById) : v.userId;
  await prisma.buildCheck.create({ data: { jobId, kind, text, sortOrder: max + 1, createdById: raisedBy } });
  return NextResponse.json(await list(jobId), { status: 201 });
}
