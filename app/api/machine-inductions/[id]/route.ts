// One induction record, with its signatures: the workshop's staff, the machine's trainers, or the
// person themselves. PATCH { revoke: note } withdraws it (staff or trainers), e.g. after unsafe use.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canInduct, matrix, workshopViewer } from "@/lib/inductions";

async function load(rawId: string) {
  const id = Number(rawId);
  const i = Number.isInteger(id) ? await prisma.machineInduction.findUnique({ where: { id }, include: { machine: { select: { id: true, name: true, entity: { select: { slug: true } } } } } }) : null;
  if (!i?.machine.entity.slug) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const v = await workshopViewer(i.machine.entity.slug);
  if ("error" in v) return v;
  const trainer = await canInduct(v.userId, v.role, i.machineId);
  if (!v.staff && !trainer && i.userId !== v.userId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { i, v, manage: v.staff || trainer };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await load((await params).id);
  if ("error" in x) return x.error;
  return NextResponse.json({ ...x.i, manage: x.manage });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await load((await params).id);
  if ("error" in x) return x.error;
  if (!x.manage) return NextResponse.json({ error: "Only the workshop's staff or the machine's trainers can do that" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body.revoke === "string" ? body.revoke.trim().slice(0, 500) : "";
  if (!note) return NextResponse.json({ error: "Say why it's being withdrawn" }, { status: 400 });
  await prisma.machineInduction.update({ where: { id: x.i.id }, data: { revokedAt: new Date(), revokeNote: note } });
  return NextResponse.json(await matrix(x.v));
}
