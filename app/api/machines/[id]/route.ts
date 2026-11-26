// Change a machine: name, where it is, refresher period, notes, its trainers, or retire it. Workshop staff.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matrix } from "@/lib/inductions";
import { machineFor } from "@/lib/machineRoute";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await machineFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can change machines" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if ("location" in body) data.location = typeof body.location === "string" ? body.location.trim().slice(0, 80) || null : null;
  if ("notes" in body) data.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
  if ("archived" in body) data.archived = !!body.archived;
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
  return NextResponse.json(await matrix(x.v));
}
