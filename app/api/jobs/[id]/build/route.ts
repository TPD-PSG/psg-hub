// A build's workshop details: stage, due-out date, collection or delivery, notes, and the show
// it's for. Any PSG staff can change these (no money involved).
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer, loadJob } from "@/lib/jobData";
import { isBuildStage } from "@/lib/buildStages";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const id = parseInt((await params).id);
  const job = await prisma.job.findUnique({ where: { id }, select: { stage: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const data: Record<string, unknown> = {};
  if (has("stage")) {
    if (body.stage !== null && !isBuildStage(body.stage)) return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
    if (body.stage !== job.stage) { data.stage = body.stage; data.stageChangedAt = new Date(); }
  }
  const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : null);
  if (has("dueOut")) data.endDate = date(body.dueOut);
  if (has("startDate")) data.startDate = date(body.startDate);
  if (has("deliveryMethod")) {
    if (body.deliveryMethod !== null && body.deliveryMethod !== "" && !["collection", "delivery"].includes(body.deliveryMethod)) return NextResponse.json({ error: "Collection or delivery" }, { status: 400 });
    data.deliveryMethod = body.deliveryMethod || null;
  }
  if (has("deliveryNotes")) data.deliveryNotes = typeof body.deliveryNotes === "string" && body.deliveryNotes.trim() ? body.deliveryNotes.trim().slice(0, 1000) : null;
  if (has("forProductionId")) {
    const pid = body.forProductionId === "" || body.forProductionId == null ? null : Number(body.forProductionId);
    if (pid !== null && !(await prisma.production.count({ where: { id: pid } }))) return NextResponse.json({ error: "Unknown production" }, { status: 400 });
    data.forProductionId = pid;
  }
  await prisma.job.update({ where: { id }, data });
  return NextResponse.json({ seeMoney: v.seeMoney, job: await loadJob(id, v) });
}
