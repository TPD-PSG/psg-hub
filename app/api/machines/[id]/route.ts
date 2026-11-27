// Change a machine or other item of kit: name, where it is, refresher period, notes, trainers,
// category, asset tag, out of use, or retire it. Workshop staff.
import { NextRequest, NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { matrix } from "@/lib/inductions";
import { equipmentList } from "@/lib/equipment";
import { isCategory } from "@/lib/equipmentCore";
import { machineFor } from "@/lib/machineRoute";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await machineFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can change machines" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { name: "The name can't be blank" });
  if (blank) return blank;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if ("location" in body) data.location = typeof body.location === "string" ? body.location.trim().slice(0, 80) || null : null;
  if ("notes" in body) data.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
  if ("archived" in body) data.archived = !!body.archived;
  if ("category" in body && isCategory(body.category)) data.category = body.category;
  if ("assetTag" in body) data.assetTag = typeof body.assetTag === "string" ? body.assetTag.trim().slice(0, 40) || null : null;
  if ("needsInduction" in body) data.needsInduction = !!body.needsInduction;
  if ("outOfUse" in body) {
    // { outOfUse: "why" } takes it out of use by hand; { outOfUse: false } puts it back
    const why = typeof body.outOfUse === "string" ? body.outOfUse.trim().slice(0, 300) : "";
    if (body.outOfUse !== false && !why) return NextResponse.json({ error: "Say why it's out of use" }, { status: 400 });
    Object.assign(data, body.outOfUse === false ? { outOfUseAt: null, outOfUseNote: null } : { outOfUseAt: new Date(), outOfUseNote: why });
  }
  if ("refresherMonths" in body) {
    const n = Number(body.refresherMonths);
    if (!Number.isInteger(n) || n < 0 || n > 120) return NextResponse.json({ error: "Refresher is a number of months (0 for none)" }, { status: 400 });
    data.refresherMonths = n; // applies to inductions recorded from now on
  }
  if (Array.isArray(body.trainerIds)) {
    // Trainers: the workshop's own staff or admins
    const ids = [...new Set(body.trainerIds.map(Number).filter(Number.isInteger))] as number[];
    const ok = await prisma.user.count({ where: { id: { in: ids }, OR: [{ role: "admin" }, { role: "member", homeEntityId: x.v.space.id }] } });
    if (ok !== ids.length) return NextResponse.json({ error: "Trainers must be the workshop's own staff" }, { status: 400 });
    data.trainers = { deleteMany: {}, create: ids.map(userId => ({ userId })) };
  }
  await prisma.machine.update({ where: { id: x.m.id }, data });
  // The equipment list asks for itself back (?view=equipment); the inductions matrix is the default
  return NextResponse.json(new URL(req.url).searchParams.get("view") === "equipment" ? await equipmentList(x.v) : await matrix(x.v));
}
