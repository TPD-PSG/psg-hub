// Server side of the dashboard: loads everything through the app's own API as the signed-in user
// (same access checks as the browser), so the page arrives complete instead of filling in tile by tile.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import { prisma } from "@/lib/prisma";
import DashboardView, { type DashboardData } from "./DashboardView";
import type { EntityOverviewRow, Visibility } from "@/lib/entityOverview";
import { homeSpaceFor, spacesFor } from "@/lib/spaces";
import { visibleWhere } from "@/lib/incidents";
import { companyLimit } from "@/lib/companyScope";
import { complianceStatus } from "@/lib/complianceCore";
import { newLookFor } from "@/lib/newLook";
import { newHomeData, type CalEvent } from "@/lib/newHome";
import NewHome from "./NewHome";

const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

export default async function HomePage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; role?: string; permissions?: string | null } | undefined;
  if (!user?.id) redirect("/login");
  // People whose company has its own space (e.g. The Workshop Stoke) land there; ?all=1 shows this page
  if (!(await searchParams).all) {
    const space = await homeSpaceFor(Number(user.id));
    if (space) redirect(user.role === "admin" || user.role === "member" ? `/spaces/${space.slug}` : `/spaces/${space.slug}/my-work`);
    // Client logins linked to a client company land on their builds
    if (user.role === "client") {
      const me = await prisma.user.findUnique({ where: { id: Number(user.id) }, select: { clientId: true } });
      // Client logins land on their builds, or on their hires if they only hire kit from us
      if (me?.clientId) {
        const [builds, hires] = await Promise.all([prisma.job.count({ where: { clientId: me.clientId } }), prisma.rentalHire.count({ where: { clientId: me.clientId } })]);
        redirect(!builds && hires ? "/my-hires" : "/my-builds");
      }
    }
  }
  const viewer = { id: Number(user.id), name: user.name ?? "", role: user.role ?? "member", permissions: user.permissions ?? null };

  const staff = viewer.role === "admin" || viewer.role === "member";

  // New look (beta): the new Home (build brief stage 4), from the same data, scoped the same way
  if (await newLookFor(viewer.id)) {
    const [calEvents, entityOverview] = await Promise.all([
      serverApi("/api/calendar"),
      staff ? serverApi<{ rows: EntityOverviewRow[] }>("/api/dashboard/entities") : Promise.resolve(null),
    ]);
    const data = await newHomeData(viewer, { calEvents: list<CalEvent>(calEvents), entityOverview: entityOverview && Array.isArray(entityOverview.rows) ? entityOverview : null });
    return <NewHome viewer={viewer} data={data} />;
  }
  const [tasks, allTasks, productions, property, quickLinks, settings, opportunities, invoices, expenses, salesBrands, salesTasks, calEvents, entityOverview] = await Promise.all([
    serverApi(`/api/tasks?assigneeId=${viewer.id}`),
    viewer.role === "admin" ? serverApi("/api/tasks") : Promise.resolve([]),
    serverApi("/api/productions"),
    serverApi<{ maintenance?: unknown[] }>("/api/property"),
    serverApi("/api/quicklinks"),
    serverApi<{ news?: string }>("/api/settings"),
    serverApi("/api/opportunities"),
    serverApi("/api/invoices"),
    serverApi("/api/expenses"),
    serverApi("/api/sales/brands"),
    serverApi("/api/sales/tasks"),
    serverApi("/api/calendar"),
    staff ? serverApi<{ see: Visibility; rows: EntityOverviewRow[] }>("/api/dashboard/entities") : Promise.resolve(null),
  ]);

  const initial: DashboardData = {
    tasks: list(tasks), allTasks: list(allTasks), productions: list(productions),
    maintenance: list(property?.maintenance), quickLinks: list(quickLinks), news: settings?.news ?? null,
    opportunities: list(opportunities), invoices: list(invoices), expenses: list(expenses),
    salesBrands: list(salesBrands),
    salesTasksCount: list<{ completedAt: string | null }>(salesTasks).filter(t => !t.completedAt).length,
    calEvents: list(calEvents),
    entityOverview: entityOverview && Array.isArray(entityOverview.rows) ? entityOverview : null,
    hs: staff ? await hsSummary(viewer.id, viewer.role).catch(() => null) : null,
    compliance: staff ? await complianceSummary(viewer.id, viewer.role).catch(() => null) : null,
    spaces: await spacesFor({ id: viewer.id, role: viewer.role }).catch(() => []),
    // Sources a user's modules block (e.g. finance for a freelancer) come back null too; only treat
    // the always-available ones as a sign the server couldn't reach its own API
    complete: tasks !== null && productions !== null && quickLinks !== null && settings !== null && calEvents !== null,
  };
  return <DashboardView viewer={viewer} initial={initial} />;
}

// The Health & Safety tile: open reports, RIDDOR reports not yet made, overdue actions (what this person may see)
async function hsSummary(userId: number, role: string) {
  const where = await visibleWhere(userId, role);
  const [open, riddor, overdueActions] = await Promise.all([
    prisma.incident.count({ where: { AND: [where, { status: { not: "closed" } }] } }),
    prisma.incident.count({ where: { AND: [where, { riddor: { notIn: ["no"] }, riddorReportedAt: null }, { NOT: { riddor: null } }] } }),
    prisma.incidentAction.count({ where: { doneAt: null, dueDate: { lt: new Date() }, incident: { AND: [where, { status: { not: "closed" } }] } } }),
  ]);
  return { open, riddor, overdueActions };
}

// The Compliance register tile: expired, and due within 60 days (what this person may see)
async function complianceSummary(userId: number, role: string) {
  const limit = role === "admin" ? null : await companyLimit(userId);
  const scope = limit ? { OR: [{ entityId: null }, { entityId: { in: limit } }] } : {};
  const items = await prisma.complianceItem.findMany({ where: { ...scope, archived: false }, select: { expiresAt: true, reviewAt: true } });
  const now = new Date();
  return { expired: items.filter(i => complianceStatus(i, now) === "expired").length, due: items.filter(i => complianceStatus(i, now) === "due").length };
}
