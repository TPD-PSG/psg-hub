// Set storage (27 Nov 2026): built pieces and where they've been put, per company space. Nothing
// is charged. Each move is logged (in, moved, out, back) so a piece's whereabouts can be traced.
import { prisma } from "@/lib/prisma";

export const PIECE_INCLUDE = {
  job: { select: { id: true, number: true, title: true, client: { select: { name: true } } } },
  location: { select: { id: true, name: true } },
  moves: { orderBy: { createdAt: "desc" as const }, take: 10, select: { id: true, kind: true, location: true, note: true, byName: true, createdAt: true } },
};

export async function storageFor(entityId: number, jobId?: number) {
  const [locations, pieces] = await Promise.all([
    prisma.storageLocation.findMany({ where: { entityId }, orderBy: [{ archived: "asc" }, { name: "asc" }], include: { _count: { select: { pieces: { where: { outAt: null } } } } } }),
    prisma.storedPiece.findMany({ where: { entityId, ...(jobId ? { jobId } : {}) }, include: PIECE_INCLUDE, orderBy: [{ outAt: { sort: "asc", nulls: "first" } }, { storedAt: "desc" }] }),
  ]);
  return { locations: locations.map(({ _count, ...l }) => ({ ...l, inStore: _count.pieces })), pieces };
}

export const nameOf = async (userId: number) => (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? null;

/** A location of this space that's still in use, or an error. null = no location yet. */
export async function locationIn(entityId: number, raw: unknown): Promise<{ id: number | null; name: string | null } | { error: string }> {
  if (raw === "" || raw == null) return { id: null, name: null };
  const l = await prisma.storageLocation.findFirst({ where: { id: Number(raw) || 0, entityId }, select: { id: true, name: true, archived: true } });
  if (!l) return { error: "Pick one of this workshop's locations" };
  if (l.archived) return { error: `${l.name} is no longer used` };
  return { id: l.id, name: l.name };
}
