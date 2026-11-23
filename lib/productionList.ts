// The list of productions the signed-in user may see. Used by GET /api/productions and the
// server-rendered productions pages, so both apply the same team restriction and budget hiding.
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parsePerms, hiddenSectionsFor } from "@/lib/permissions";

const include = {
  _count: { select: { events: true, budgetLines: true, crew: true } },
  budgetLines: { include: { expenses: true } },
  events: { orderBy: { startAt: "asc" as const } },
  team: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" as const } },
  venueRef: { select: { name: true, city: true } },
  bdClient: { select: { id: true, name: true, type: true, address: true, website: true, billingName: true, billingAddress: true, billingEmail: true } },
};

export async function loadProductionsForViewer(opts: { archived?: boolean } = {}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!user?.id) return [];
  const role = user.role ?? "member";
  const userId = Number(user.id);
  const perms = parsePerms(user.permissions ?? null);

  const where: Record<string, unknown> = { archived: !!opts.archived };
  // Clients, freelancers and staff without all-productions access only see their own teams
  if (role !== "admin" && (role === "client" || role === "freelancer" || !perms.allProductions)) {
    where.team = { some: { userId } };
  }
  const productions = await prisma.production.findMany({
    where,
    orderBy: opts.archived ? { archivedAt: "desc" } : { createdAt: "desc" },
    include,
  });
  // Budget figures only for people whose Budget tab isn't hidden (it was leaking to freelancers/clients)
  if (hiddenSectionsFor(role, user.permissions).has("budget")) {
    return productions.map(p => ({ ...p, budgetLines: [] as typeof p.budgetLines }));
  }
  return productions;
}
