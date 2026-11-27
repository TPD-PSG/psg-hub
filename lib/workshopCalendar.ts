// Workshop calendar (28 Nov 2026): each build part goes through discipline stages (Pre-production,
// Technical drawing, CNC, Carpentry, Fabrication, Scenic…), each with its own dates. A workshop
// edits its own list of disciplines; it starts with these.
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { spaceMember, type SpaceMember } from "./spaceBoard";
import { DEFAULT_DISCIPLINES } from "./workshopDisciplines.ts";
export { DEFAULT_DISCIPLINES, disciplineFor } from "./workshopDisciplines.ts";

/** A workshop's disciplines in order (the defaults are added the first time it's asked for). */
export async function disciplinesFor(entityId: number, withArchived = false) {
  if (!(await prisma.workshopDiscipline.count({ where: { entityId } }))) {
    await prisma.workshopDiscipline.createMany({ data: DEFAULT_DISCIPLINES.map((d, i) => ({ entityId, name: d.name, color: d.color, sortOrder: i })) });
  }
  return prisma.workshopDiscipline.findMany({ where: { entityId, ...(withArchived ? {} : { archived: false }) }, select: { id: true, name: true, color: true, sortOrder: true, archived: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

/** Staff in the space (freelancers see their own stages in My work). */
export async function calendarStaff(slug: string): Promise<SpaceMember | { error: NextResponse }> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const m = await spaceMember(slug);
  if ("error" in m) return m;
  if (!m.staff) return { error: NextResponse.json({ error: "Staff only" }, { status: 403 }) };
  return m;
}

export const STAGE_STATUSES = ["todo", "on", "done"] as const;
export const STAGE_SELECT = {
  id: true, partId: true, disciplineId: true, startDate: true, days: true, hours: true, userId: true, status: true, fromQuote: true, sortOrder: true,
  user: { select: { id: true, name: true } }, lateUntil: true,
  // Waiting reschedule requests, and the latest late report (for the bar's flag and the editor)
  requests: { where: { status: { in: ["open", "noted"] as string[] } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, kind: true, reason: true, newStart: true, newDays: true, newEnd: true, status: true, createdAt: true, by: { select: { id: true, name: true } } } },
} as const;

/** Stage fields from a request body (only keys sent are changed). */
export function stageFields(body: Record<string, unknown>): { data: Record<string, unknown> } | { error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const data: Record<string, unknown> = {};
  if (has("startDate")) {
    if (body.startDate == null || body.startDate === "") data.startDate = null;
    else if (typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.startDate)) data.startDate = new Date(`${body.startDate.slice(0, 10)}T00:00:00Z`);
    else return { error: "Dates look like 2026-12-01" };
  }
  if (has("days")) { const n = Number(body.days); if (!Number.isInteger(n) || n < 1 || n > 365) return { error: "Days must be a whole number from 1 to 365" }; data.days = n; }
  if (has("hours")) { const n = body.hours === "" || body.hours == null ? null : Number(body.hours); if (n != null && !(n >= 0 && n < 10000)) return { error: "Hours must be a number" }; data.hours = n; }
  if (has("userId")) data.userId = Number(body.userId) || null;
  if (has("status")) { if (!(STAGE_STATUSES as readonly string[]).includes(body.status as string)) return { error: "Status is todo, on or done" }; data.status = body.status; }
  if (has("disciplineId")) { const n = Number(body.disciplineId); if (!Number.isInteger(n) || n < 1) return { error: "Pick a discipline" }; data.disciplineId = n; }
  return { data };
}

// ── Running late and reschedule requests (part 2) ────────────────────────────

/** Who handles a workshop's requests: people ticked as its workshop managers (its own team, or
 *  admins), else every admin. */
export async function workshopManagers(entityId: number): Promise<number[]> {
  const ticked = await prisma.user.findMany({ where: { workshopManager: true, deactivatedAt: null, OR: [{ homeEntityId: entityId }, { role: "admin" }] }, select: { id: true } });
  if (ticked.length) return ticked.map(u => u.id);
  return (await prisma.user.findMany({ where: { role: "admin", deactivatedAt: null }, select: { id: true } })).map(u => u.id);
}
export async function isWorkshopManager(userId: number, role: string, entityId: number) {
  if (role === "admin") return true;
  return (await workshopManagers(entityId)).includes(userId);
}

export const REQUEST_SELECT = {
  id: true, stageId: true, kind: true, reason: true, newStart: true, newDays: true, newEnd: true, status: true, createdAt: true, decidedAt: true, decisionNote: true,
  by: { select: { id: true, name: true } }, decidedBy: { select: { name: true } },
} as const;

/** "CNC · Palace flats 1–4 (J-2026-080)" for messages */
export async function stageName(stageId: number) {
  const s = await prisma.partStage.findUnique({ where: { id: stageId }, select: { discipline: { select: { name: true } }, part: { select: { label: true, job: { select: { number: true, title: true } } } } } });
  return s ? `${s.discipline.name} · ${s.part.label} (${s.part.job.number} ${s.part.job.title})` : "a stage";
}
export const dayText = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
