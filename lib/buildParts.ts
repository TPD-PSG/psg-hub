// Parts of a build (TWS planner): validation shared by the create and update routes.
import { prisma } from "@/lib/prisma";

export const PART_SELECT = { id: true, jobId: true, label: true, userId: true, startDate: true, days: true, hours: true, done: true, pencilled: true, user: { select: { id: true, name: true } } } as const;

/** Midnight UTC of a YYYY-MM-DD day, or null. */
export const dayUtc = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${s.slice(0, 10)}T00:00:00.000Z`) : null);

/**
 * Pencilled dates (27 Nov 2026): parts added while a build is at the Quote stage are pencilled in
 * (tentative). Once the build moves past Quote (e.g. its quote is accepted) they're confirmed.
 */
export const confirmPencils = (jobId: number) => prisma.buildPart.updateMany({ where: { jobId, pencilled: true }, data: { pencilled: false } });

export async function partFields(body: Record<string, unknown>, creating: boolean): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const data: Record<string, unknown> = {};
  if (creating || has("label")) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return { error: "Name the part" };
    data.label = label.slice(0, 120);
  }
  if (has("days")) {
    const d = Number(body.days);
    if (!Number.isInteger(d) || d < 1 || d > 60) return { error: "Days must be a whole number from 1 to 60" };
    data.days = d;
  }
  if (has("hours")) {
    const h = body.hours === "" || body.hours == null ? null : Number(body.hours);
    if (h !== null && (!isFinite(h) || h < 0 || h > 1000)) return { error: "Planned hours don't look right" };
    data.hours = h;
  }
  if (has("done")) data.done = !!body.done;
  if (has("pencilled")) data.pencilled = !!body.pencilled;
  if (has("startDate")) data.startDate = dayUtc(body.startDate);
  if (has("userId")) {
    const uid = body.userId === "" || body.userId == null ? null : Number(body.userId);
    if (uid !== null && !(await prisma.user.count({ where: { id: uid } }))) return { error: "Unknown person" };
    data.userId = uid;
  }
  return { data };
}
