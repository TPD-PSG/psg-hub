// Home dashboard, one row per entity (PSG staff only). Each part is included only when the viewer
// may see that area: productions (and only their own shows unless they can see all), BD, the
// budget section (variations, PM fee stages) and finance (expenses to approve).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccess, parsePerms, hiddenSectionsFor } from "@/lib/permissions";
import { buildEntityOverview, type OverviewProduction } from "@/lib/entityOverview";
import { companyLimit, entityWhere } from "@/lib/companyScope";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  const role = user?.role ?? "member";
  if (!user?.id || (role !== "admin" && role !== "member")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const perms = parsePerms(user.permissions ?? null);
  const see = {
    productions: canAccess(perms, "productions", role),
    bd: canAccess(perms, "bd", role),
    budget: canAccess(perms, "productions", role) && !hiddenSectionsFor(role, user.permissions).has("budget"),
    finance: canAccess(perms, "finance", role),
  };

  const limit = role === "admin" ? null : await companyLimit(Number(user.id)); // companies they can see
  const where: Record<string, unknown> = { archived: false, ...entityWhere(limit) };
  if (role !== "admin" && !perms.allProductions) where.team = { some: { userId: Number(user.id) } };
  const range = { startDate: true, endDate: true } as const;

  const [entities, productions, deals] = await Promise.all([
    prisma.entity.findMany({ where: limit ? { id: { in: limit } } : {}, select: { id: true, name: true, archived: true, sortOrder: true, hasSpace: true, slug: true } }),
    see.productions || see.budget || see.finance
      ? prisma.production.findMany({
          where,
          select: {
            id: true, name: true, entityId: true, status: true, startDate: true, endDate: true, venue: true,
            tourStops: { select: { loadInDate: true, startDate: true, venue: { select: { name: true } } } },
            crew: { select: { crewId: true, ...range } },
            staffAssignments: { select: { userId: true, ...range } },
            feeStages: see.budget ? { select: { label: true, amount: true, dueDate: true, invoicedAt: true } } : false,
            _count: {
              select: {
                budgetVariations: see.budget ? { where: { status: "pending_approval" } } : false,
                expenses: see.finance ? { where: { status: "pending" } } : false,
              },
            },
          },
        })
      : Promise.resolve([]),
    see.bd
      ? prisma.opportunity.findMany({
          where: { stage: { notIn: ["won", "lost"] }, ...entityWhere(limit) },
          select: { entityId: true, stage: true, value: true, probability: true, followUpDate: true, createdAt: true, activities: { orderBy: { at: "desc" }, take: 1, select: { at: true } } },
        })
      : Promise.resolve([]),
  ]);

  const prods: OverviewProduction[] = productions.map(p => {
    const { _count, feeStages, ...rest } = p as typeof p & { _count: { budgetVariations?: number; expenses?: number }; feeStages?: OverviewProduction["feeStages"] };
    return { ...rest, feeStages: feeStages ?? [], pendingVariations: _count.budgetVariations ?? 0, pendingExpenses: _count.expenses ?? 0 };
  });
  const rows = buildEntityOverview(
    entities, prods,
    deals.map(d => ({ ...d, lastActivityAt: d.activities[0]?.at ?? null })),
    see,
  );
  // No "Space →" link to a space this person isn't allowed into
  if (limit) for (const r of rows) if (r.spaceSlug && (r.entityId == null || !limit.includes(r.entityId))) r.spaceSlug = null;
  return NextResponse.json({ see, rows });
}
