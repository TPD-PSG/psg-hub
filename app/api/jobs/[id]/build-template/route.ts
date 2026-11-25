// Save a build's parts and materials as a template, divided by how many units the build was.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyOutOfScope } from "@/lib/companyScope";
import { staffInSpace } from "@/lib/spaceAccess";
import { perUnitFromJob } from "@/lib/buildTemplates";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const out = await denyOutOfScope("job", raw);
  if (out) return out;
  const job = await prisma.job.findUnique({ where: { id: parseInt(raw) || 0 }, select: { id: true, entityId: true, entity: { select: { slug: true } }, _count: { select: { parts: true } } } });
  if (!job?.entity?.slug || !job.entityId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await staffInSpace(job.entity.slug);
  if ("error" in s) return s.error;
  if (!job._count.parts) return NextResponse.json({ error: "Add the build's parts (and their materials) first" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Name the template" }, { status: 400 });
  const units = Number(body.units ?? 1);
  if (!(units > 0 && units <= 10000)) return NextResponse.json({ error: "How many units was this build? (more than 0)" }, { status: 400 });
  const unitName = typeof body.unitName === "string" && body.unitName.trim() ? body.unitName.trim().slice(0, 30) : "each";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;
  const existing = await prisma.buildTemplate.findUnique({ where: { entityId_name: { entityId: job.entityId, name } } });
  if (existing && !body.replace) return NextResponse.json({ error: `There's already a template called ${name}`, exists: true }, { status: 409 });
  const parts = JSON.stringify(await perUnitFromJob(job.id, units));
  const t = existing
    ? await prisma.buildTemplate.update({ where: { id: existing.id }, data: { unitName, notes, parts } })
    : await prisma.buildTemplate.create({ data: { entityId: job.entityId, name, unitName, notes, parts, createdById: s.user.userId } });
  return NextResponse.json({ id: t.id, name: t.name }, { status: existing ? 200 : 201 });
}
