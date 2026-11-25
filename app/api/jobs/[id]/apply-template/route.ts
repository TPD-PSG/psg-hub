// Add a build template to a build for a number of units: new parts with materials, scaled.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { staffInSpace } from "@/lib/spaceAccess";
import { applyTemplate } from "@/lib/buildTemplates";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const out = await denyOutOfScope("job", raw);
  if (out) return out;
  const job = await prisma.job.findUnique({ where: { id: parseInt(raw) || 0 }, select: { id: true, entityId: true, entity: { select: { slug: true } } } });
  if (!job?.entity?.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await staffInSpace(job.entity.slug);
  if ("error" in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const t = await prisma.buildTemplate.findFirst({ where: { id: Number(body.templateId) || 0, entityId: job.entityId ?? -1 } });
  if (!t) return NextResponse.json({ error: "Pick one of this workshop's templates" }, { status: 400 });
  const units = Number(body.units ?? 1);
  if (!(units > 0 && units <= 10000)) return NextResponse.json({ error: `How many ${t.unitName}? (more than 0)` }, { status: 400 });
  return NextResponse.json(await applyTemplate(job.id, t, units), { status: 201 });
}
