// Shared by the routes that act on incident reports: may this person reach the show or workshop the
// report belongs to, and may they manage it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { incidentAccess, isHsLead, type Owner } from "@/lib/incidents";
import { auth } from "@/auth";
import { companyLimit, inScope } from "@/lib/companyScope";
import { canSeeSpace } from "@/lib/spaces";

type Who = { userId: number; role: string };
const err = (error: string, status: number) => ({ error: NextResponse.json({ error }, { status }) });

async function me(): Promise<Who | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  return u?.id ? { userId: Number(u.id), role: u.role ?? "member" } : null;
}

/** A production's H&S tab, or an H&S lead (who follows up every show's reports, even ones they're not on). */
export async function hsProductionAccess(productionId: string | number): Promise<Who | { error: NextResponse }> {
  const user = await me();
  if (user && user.role === "member" && (await isHsLead(user.userId, "member"))) {
    const pid = Number(productionId);
    const p = Number.isInteger(pid) ? await prisma.production.findUnique({ where: { id: pid }, select: { entityId: true } }) : null;
    if (p && inScope(await companyLimit(user.userId), p.entityId)) return user;
  }
  const a = await requireProductionAccess(productionId, "hs");
  return "error" in a ? { error: a.error } : { userId: a.userId, role: a.role };
}

/** A company space's floor: anyone who can open the space (H&S leads always, within their companies). */
export async function hsSpaceAccess(entityId: number): Promise<Who | { error: NextResponse }> {
  const user = await me();
  if (!user) return err("Unauthorized", 401);
  const e = await prisma.entity.findUnique({ where: { id: entityId }, select: { hasSpace: true, archived: true } });
  if (!e?.hasSpace || e.archived) return err("Not found", 404);
  if (user.role === "member" && (await isHsLead(user.userId, "member")) && inScope(await companyLimit(user.userId), entityId)) return user;
  if (!(await canSeeSpace({ id: user.userId, role: user.role }, entityId))) return err("This space isn't yours", 403);
  return user;
}

export async function ownerAccess(owner: Owner) {
  return owner.productionId ? hsProductionAccess(owner.productionId) : owner.entityId ? hsSpaceAccess(owner.entityId) : err("Not found", 404);
}

export async function incidentFor(rawId: string | number, need: "view" | "manage" | "lead") {
  const id = Number(rawId);
  if (!Number.isInteger(id)) return err("Invalid id", 400);
  const inc = await prisma.incident.findUnique({ where: { id }, select: { id: true, productionId: true, entityId: true, reportedById: true, occurredAt: true, status: true } });
  if (!inc) return err("Not found", 404);
  const access = await ownerAccess(inc);
  if ("error" in access) return { error: access.error };
  const rights = await incidentAccess(access.userId, access.role, inc);
  const ok = need === "lead" ? rights.lead : need === "manage" ? rights.manage : rights.manage || inc.reportedById === access.userId;
  if (!ok) return err(need === "lead" ? "Only an H&S lead can do that" : "You can't see this report", need === "view" ? 404 : 403);
  return { inc, userId: access.userId, role: access.role, ...rights };
}
