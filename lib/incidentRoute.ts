// Shared by the routes that act on one incident or action: who's asking, and may they manage it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { incidentAccess, isHsLead } from "@/lib/incidents";
import { auth } from "@/auth";
import { companyLimit, inScope } from "@/lib/companyScope";

/** A production's H&S tab, or an H&S lead (who follows up every show's reports, even ones they're not on). */
export async function hsProductionAccess(productionId: string | number) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.id && user.role === "member" && (await isHsLead(Number(user.id), "member"))) {
    const pid = Number(productionId);
    const p = Number.isInteger(pid) ? await prisma.production.findUnique({ where: { id: pid }, select: { entityId: true } }) : null;
    const limit = await companyLimit(Number(user.id));
    if (p && inScope(limit, p.entityId)) return { userId: Number(user.id), role: "member" };
  }
  return requireProductionAccess(productionId, "hs");
}

export async function incidentFor(rawId: string | number, need: "view" | "manage" | "lead") {
  const id = Number(rawId);
  if (!Number.isInteger(id)) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  const inc = await prisma.incident.findUnique({ where: { id }, select: { id: true, productionId: true, reportedById: true, occurredAt: true, status: true } });
  if (!inc) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const access = await hsProductionAccess(inc.productionId);
  if ("error" in access) return { error: access.error };
  const rights = await incidentAccess(access.userId, access.role, inc.productionId);
  const ok = need === "lead" ? rights.lead : need === "manage" ? rights.manage : rights.manage || inc.reportedById === access.userId;
  if (!ok) return { error: NextResponse.json({ error: need === "lead" ? "Only an H&S lead can do that" : "You can't see this report" }, { status: need === "view" ? 404 : 403 }) };
  return { inc, userId: access.userId, role: access.role, ...rights };
}
