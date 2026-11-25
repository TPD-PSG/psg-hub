// Labour types (28 Nov 2026): the kinds of work a workshop prices, each with what a day costs us
// (an hour is a day ÷ 8). Searched like stock when quoting; a part of a build can be a labour type
// and is costed at its rate until a person is planned (then their own rate).
import { prisma } from "@/lib/prisma";

export const USUAL_LABOUR = ["Carpenter", "Metalworker / welder", "Scenic artist", "Prop maker", "CAD / drawing office", "Workshop labourer", "Driver", "Project manager"];

export const labourFor = (entityId: number) =>
  prisma.labourType.findMany({ where: { entityId }, orderBy: [{ archived: "asc" }, { name: "asc" }], select: { id: true, name: true, dayRate: true, notes: true, archived: true, _count: { select: { parts: true } } } });

/** Cleaned fields; returns an error message instead when something's wrong. */
export function labourFields(body: Record<string, unknown>, creating: boolean): { data: Record<string, unknown> } | { error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const data: Record<string, unknown> = {};
  if (creating || has("name")) {
    const n = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
    if (!n) return { error: "Name the labour type" };
    data.name = n;
  }
  if (has("dayRate")) {
    const r = body.dayRate === "" || body.dayRate == null ? null : Number(body.dayRate);
    if (r !== null && !(r >= 0 && r < 100000)) return { error: "The day rate should be an amount, e.g. 220" };
    data.dayRate = r;
  }
  if (has("notes")) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;
  if (has("archived")) data.archived = !!body.archived;
  return { data };
}
