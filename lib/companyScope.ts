// "Companies they can see" (Admin → Users, decided 25 Nov 2026). A person can be limited to some
// of the group's companies (entities); they then only see records tagged with those companies –
// productions, deals, quotes, jobs, company spaces – and records with no company are hidden from
// them. Admins are never limited. Read fresh from the database so a change applies at once.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parsePerms } from "@/lib/permissions";

/** The companies a person may see; null = all of them. */
export async function companyLimit(userId: number): Promise<number[] | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, permissions: true } });
  if (!u) return [];
  if (u.role === "admin") return null;
  const p = parsePerms(u.permissions);
  const ids = p.entityIds ?? p.spaceEntityIds; // spaceEntityIds: the first version (spaces only)
  return Array.isArray(ids) ? ids.map(Number) : null;
}

/** The signed-in person's limit (null = all, or not signed in – routes check sign-in themselves). */
export async function myCompanyLimit(): Promise<number[] | null> {
  const session = await auth();
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  return id ? companyLimit(id) : null;
}

export const inScope = (ids: number[] | null, entityId: number | null | undefined) => ids === null || (entityId != null && ids.includes(entityId));

/** Prisma filter for a model with an entityId. */
export const entityWhere = (ids: number[] | null) => (ids === null ? {} : { entityId: { in: ids } });

/** For new records: keep the company given if allowed; a person limited to one company gets that one. */
export function scopedEntityId(ids: number[] | null, given: number | null | undefined): { entityId: number | null } | { error: string } {
  if (ids === null) return { entityId: given ?? null };
  if (given != null) return ids.includes(given) ? { entityId: given } : { error: "You can't add records for that company" };
  if (ids.length === 1) return { entityId: ids[0] };
  return { error: "Pick which company this is for" };
}


/**
 * For a route that opens one deal, quote or job by id: "Not found" if it belongs to a company
 * the signed-in person can't see (or to none, when they're limited). null = carry on.
 */
export async function denyOutOfScope(kind: "opportunity" | "quote" | "job", rawId: string | number): Promise<NextResponse | null> {
  const id = Number(rawId);
  if (!Number.isInteger(id)) return null;
  const limit = await myCompanyLimit();
  if (limit === null) return null;
  const rec = kind === "opportunity" ? await prisma.opportunity.findUnique({ where: { id }, select: { entityId: true } })
    : kind === "quote" ? await prisma.quote.findUnique({ where: { id }, select: { entityId: true } })
      : await prisma.job.findUnique({ where: { id }, select: { entityId: true } });
  if (!rec) return null; // the route says "Not found" itself
  return inScope(limit, rec.entityId) ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** An update that moves a record to another company: only to one they can see (and not to none). */
export function entityChangeError(limit: number[] | null, data: Record<string, unknown>): string | null {
  if (limit === null || !("entityId" in data)) return null;
  return inScope(limit, data.entityId as number | null) ? null : "You can't move this to that company";
}
