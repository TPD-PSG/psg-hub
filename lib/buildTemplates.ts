// Build templates (28 Nov 2026): a typical piece of work with its parts and materials for ONE unit
// ("Standard flat", "Truck", "per m²"). Saved from a real build (divided by how many units it was)
// and added to a build scaled by how many units are needed. People aren't kept: plan them after.
import { prisma } from "@/lib/prisma";
import { PART_SELECT } from "@/lib/buildParts";

type TMaterial = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; stockItemId: number | null };
export type TPart = { label: string; days: number; hours: number | null; labourTypeId?: number | null; materials: TMaterial[] };

/** Units that only come whole: scaled quantities round up. */
const WHOLE = new Set(["sheets", "sheet", "lengths", "length", "each", "rolls", "roll", "tins", "tin", "boxes", "box", "packs", "pack", "pairs", "pair"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function readParts(json: string): TPart[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** One unit's worth of a build's parts and materials. */
export async function perUnitFromJob(jobId: number, units: number): Promise<TPart[]> {
  const parts = await prisma.buildPart.findMany({ where: { jobId }, orderBy: [{ startDate: "asc" }, { id: "asc" }], select: { label: true, days: true, hours: true, labourTypeId: true, materials: { orderBy: { sortOrder: "asc" }, select: { section: true, description: true, quantity: true, unit: true, unitCost: true, stockItemId: true } } } });
  return parts.map(p => ({
    label: p.label, days: r2(p.days / units), hours: p.hours != null ? r2(p.hours / units) : null, labourTypeId: p.labourTypeId,
    materials: p.materials.map(m => ({ ...m, quantity: r2(m.quantity / units) })),
  }));
}

/** Add a template to a build for `units` units: new parts (pencilled while quoting) with materials. */
export async function applyTemplate(jobId: number, t: { name: string; unitName: string; parts: string }, units: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { stage: true } });
  const pencilled = job?.stage === "quote";
  const many = units !== 1 ? ` (${units} ${t.unitName})` : "";
  for (const p of readParts(t.parts)) {
    await prisma.buildPart.create({
      data: {
        jobId, label: `${p.label}${many}`.slice(0, 120), pencilled,
        labourTypeId: p.labourTypeId && (await prisma.labourType.count({ where: { id: p.labourTypeId } })) ? p.labourTypeId : null,
        days: Math.max(1, Math.min(60, Math.ceil(p.days * units - 1e-9))),
        hours: p.hours != null ? Math.round(p.hours * units * 2) / 2 : null,
        materials: { create: p.materials.map((m, i) => ({
          section: m.section, description: m.description, unit: m.unit, unitCost: m.unitCost, stockItemId: m.stockItemId, sortOrder: i,
          quantity: WHOLE.has((m.unit ?? "").toLowerCase()) ? Math.ceil(m.quantity * units - 1e-9) : r2(m.quantity * units),
        })) },
      },
    });
  }
  return prisma.buildPart.findMany({ where: { jobId }, select: PART_SELECT, orderBy: [{ startDate: "asc" }, { id: "asc" }] });
}

/** A template's cost per unit (materials only; labour depends on who does it). */
export const materialsPerUnit = (parts: TPart[]) => r2(parts.reduce((s, p) => s + p.materials.reduce((a, m) => a + m.quantity * m.unitCost, 0), 0));
export const daysPerUnit = (parts: TPart[]) => r2(parts.reduce((s, p) => s + (p.hours != null ? p.hours / 8 : p.days), 0));
