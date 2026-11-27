// The new look's sidebar counts: my open tasks, live productions, open deals, expenses waiting.
// Each only for people who can use that area.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, parsePerms } from "@/lib/permissions";
import { companyLimit } from "@/lib/companyScope";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(u.id), role = u.role ?? "member", perms = parsePerms(u.permissions ?? null);
  const can = (m: string) => canAccess(perms, m, role);
  const limit = role === "admin" ? null : await companyLimit(id);
  const prodWhere: Record<string, unknown> = { archived: false, status: "in-production" };
  if (role !== "admin" && (role === "client" || role === "freelancer" || !perms.allProductions)) prodWhere.team = { some: { userId: id } };
  if (limit) prodWhere.entityId = { in: limit };
  const [tasks, productions, deals, finance] = await Promise.all([
    can("tasks") ? prisma.task.count({ where: { assigneeUserId: id, status: { not: "done" } } }) : null,
    can("productions") ? prisma.production.count({ where: prodWhere }) : null,
    can("bd") ? prisma.opportunity.count({ where: { stage: { notIn: ["won", "lost"] }, ...(limit ? { entityId: { in: limit } } : {}) } }) : null,
    can("finance") ? prisma.productionExpense.count({ where: { status: "pending" } }) : null,
  ]);
  return NextResponse.json({ tasks, productions, deals, finance });
}
