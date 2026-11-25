// Update a repair (staff of its space): status (open | scheduled | done), when it's booked in,
// what was done, urgency. The client hears when their report is scheduled or done. DELETE: admins.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { notify } from "@/lib/clientPortal";
import { REPAIR_SELECT, REPAIR_STATUSES, URGENCIES } from "@/lib/repairs";

type P = { params: Promise<{ id: string }> };
async function load(p: P) {
  const r = await prisma.repair.findUnique({ where: { id: parseInt((await p.params).id) || 0 }, include: { job: { select: { title: true, entityId: true, clientId: true } } } });
  if (!r?.job.entityId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const m = await memberOfEntity(r.job.entityId);
  if ("error" in m) return m;
  if (!m.staff) return { error: NextResponse.json({ error: "Staff only" }, { status: 403 }) };
  return { m, r };
}

export async function PATCH(req: Request, p: P) {
  const x = await load(p);
  if ("error" in x) return x.error;
  const { r } = x;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!REPAIR_STATUSES.includes(body.status)) return NextResponse.json({ error: "Open, scheduled or done" }, { status: 400 });
    data.status = body.status;
    data.doneAt = body.status === "done" ? new Date() : null;
  }
  if (body.urgency !== undefined) { if (!URGENCIES.includes(body.urgency)) return NextResponse.json({ error: "Urgent, soon or routine" }, { status: 400 }); data.urgency = body.urgency; }
  if ("scheduledFor" in body) data.scheduledFor = typeof body.scheduledFor === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.scheduledFor) ? new Date(`${body.scheduledFor.slice(0, 10)}T00:00:00Z`) : null;
  // An empty box never wipes an earlier note (e.g. the plan becomes what was done)
  if (typeof body.resolution === "string" && body.resolution.trim()) data.resolution = body.resolution.trim().slice(0, 2000);
  if (data.status === "scheduled" && !data.scheduledFor && !r.scheduledFor) return NextResponse.json({ error: "When is it booked in?" }, { status: 400 });
  if (data.status === "done" && !data.resolution && !r.resolution) return NextResponse.json({ error: "Say what was done" }, { status: 400 });
  const updated = await prisma.repair.update({ where: { id: r.id }, data, select: REPAIR_SELECT });
  // Tell the client when their report moves on
  if (r.fromClient && r.job.clientId && data.status && data.status !== r.status && data.status !== "open") {
    const clients = await prisma.user.findMany({ where: { clientId: r.job.clientId, role: "client" }, select: { id: true } });
    const when = updated.scheduledFor ? ` for ${updated.scheduledFor.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}` : "";
    await notify(clients.map(c => c.id), { title: data.status === "done" ? `Repair done on ${r.job.title}` : `Repair booked in${when} on ${r.job.title}`, body: `${r.title}${updated.resolution && data.status === "done" ? `: ${updated.resolution}` : ""}`, link: "/my-builds" }).catch(() => {});
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, p: P) {
  const x = await load(p);
  if ("error" in x) return x.error;
  if (x.m.role !== "admin") return NextResponse.json({ error: "Only admins can delete a repair" }, { status: 403 });
  await prisma.repair.delete({ where: { id: x.r.id } });
  if (x.r.photoFileId) await prisma.jobFile.delete({ where: { id: x.r.photoFileId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
