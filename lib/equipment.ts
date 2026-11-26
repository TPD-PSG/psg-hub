// Equipment and its checks in a workshop space (26 Nov 2026). Everyone in the space sees the kit and
// what's out of use; the workshop's staff add kit, set its checks and record results. A failed check
// puts the item out of use until a later pass; the planner and tablet warn about it.
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { notify } from "@/lib/clientPortal";
import type { Viewer } from "@/lib/inductions";
import { addMonths, checkState, itemState, unusable, KIND_LABEL, type ItemStatus } from "@/lib/equipmentCore";

const ITEM_SELECT = {
  id: true, name: true, category: true, assetTag: true, location: true, notes: true, archived: true, needsInduction: true, outOfUseAt: true, outOfUseNote: true,
  checks: { orderBy: { id: "asc" as const }, select: { id: true, kind: true, label: true, intervalMonths: true, firstDue: true, records: { orderBy: { doneAt: "desc" as const }, take: 10, select: { id: true, doneAt: true, passed: true, doneBy: true, notes: true, nextDue: true, fileName: true } } } },
} as const;

export async function equipmentList(v: Viewer) {
  const now = new Date();
  const items = await prisma.machine.findMany({ where: { entityId: v.space.id }, select: ITEM_SELECT, orderBy: [{ archived: "asc" }, { category: "asc" }, { name: "asc" }] });
  return {
    staff: v.staff,
    items: items.map(i => {
      const checks = i.checks.map(c => {
        const st = checkState(c, c.records, now);
        return { ...c, status: st.status, due: st.due };
      });
      return { ...i, checks, status: itemState(i, checks.map(c => c.status)) as ItemStatus };
    }),
  };
}

/** Machines that shouldn't be used right now (out of use, or a check overdue), with why. */
export async function unavailableMachines(entityId: number): Promise<Record<number, string>> {
  const now = new Date();
  const items = await prisma.machine.findMany({ where: { entityId, archived: false }, select: { id: true, outOfUseAt: true, outOfUseNote: true, checks: { select: { kind: true, firstDue: true, records: { orderBy: { doneAt: "desc" }, take: 1, select: { doneAt: true, passed: true, nextDue: true } } } } } });
  const out: Record<number, string> = {};
  for (const i of items) {
    const states = i.checks.map(c => ({ kind: c.kind, ...checkState(c, c.records, now) }));
    const s = itemState(i, states.map(x => x.status));
    if (!unusable(s)) continue;
    const failed = states.find(x => x.status === "failed"), late = states.find(x => x.status === "overdue");
    out[i.id] = i.outOfUseAt ? `out of use${i.outOfUseNote ? `: ${i.outOfUseNote}` : ""}` : failed ? `failed its ${KIND_LABEL[failed.kind] ?? "check"}` : `${KIND_LABEL[late!.kind] ?? "check"} overdue`;
  }
  return out;
}

/** Record a check's result; a certificate (PDF or picture, as a data URL) is optional. */
export async function recordCheck(check: { id: number; intervalMonths: number; kind: string; machine: { id: number; name: string; entityId: number } }, by: number, body: Record<string, unknown>) {
  const doneAt = typeof body.doneAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.doneAt) ? new Date(`${body.doneAt}T00:00:00Z`) : null;
  if (!doneAt || doneAt.getTime() > Date.now() + 86400e3) return { error: "Pick the date it was done (not in the future)" };
  if (typeof body.passed !== "boolean") return { error: "Did it pass?" };
  const doneBy = typeof body.doneBy === "string" ? body.doneBy.trim().slice(0, 120) : "";
  if (!doneBy) return { error: "Who did the check?" };
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
  let file: { fileName: string; fileMime: string; fileKey: string | null; fileData: string | null } | null = null;
  if (body.file && typeof body.file === "object") {
    const f = body.file as { name?: unknown; dataUrl?: unknown };
    const m = typeof f.dataUrl === "string" ? /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(f.dataUrl) : null;
    if (!m) return { error: "Certificates need to be a PDF or a picture" };
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 10 * 1024 * 1024) return { error: "That file is too big (10 MB at most)" };
    const name = (typeof f.name === "string" && f.name.trim() ? f.name.trim() : "certificate").slice(0, 120);
    const saved = await saveFile("equipment", name, buf, m[1]);
    file = { fileName: name, fileMime: m[1], fileKey: saved.key, fileData: saved.base64 };
  }
  const rec = await prisma.equipmentCheckRecord.create({
    data: { checkId: check.id, doneAt, passed: body.passed, doneBy, notes, nextDue: body.passed ? addMonths(doneAt, check.intervalMonths) : null, recordedById: by, ...(file ?? {}) },
  });
  if (!body.passed) {
    // A failure takes it out of use: tell the workshop's staff
    const staff = await prisma.user.findMany({ where: { homeEntityId: check.machine.entityId, role: "member" }, select: { id: true } });
    const e = await prisma.entity.findUnique({ where: { id: check.machine.entityId }, select: { slug: true } });
    await notify(staff.map(s => s.id).filter(id => id !== by), { title: `${check.machine.name} failed its ${KIND_LABEL[check.kind] ?? "check"}: out of use`, body: notes, link: `/spaces/${e?.slug}/safety#equipment` });
  }
  return { record: rec };
}
