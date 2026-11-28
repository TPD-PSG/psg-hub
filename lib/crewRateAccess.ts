// Server side of crew rates: the list for a space, and the one-role-name-per-space check.
import { prisma } from "@/lib/prisma";

export const crewRatesFor = (entityId: number, withArchived = true) =>
  prisma.crewRate.findMany({ where: { entityId, ...(withArchived ? {} : { archived: false }) }, orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { role: "asc" }] });

/** Is the role name already used in this space (any case)? */
export async function roleTaken(entityId: number, role: string, exceptId?: number) {
  const rows = await prisma.crewRate.findMany({ where: { entityId }, select: { id: true, role: true } });
  return rows.some(r => r.id !== exceptId && r.role.toLowerCase() === role.toLowerCase());
}
