// The new look's Home (build brief stage 4): what needs me, what's happening now, where next.
// Everything here is scoped to what the person may see (their modules, teams and companies).
// No cash or bank figures for any role.
import { prisma } from "./prisma";
import { canAccess, parsePerms, hiddenSectionsFor } from "./permissions";
import { companyLimit } from "./companyScope";
import { readAttention } from "./importAttention";
import { visibleWhere } from "./incidents";
import { homeRoleOf, pinsFor, PIN_DEFAULTS, hiddenNeedsFor, setHiddenNeeds, type HomeRole } from "./newLook";
import { createHash } from "crypto";
import type { EntityOverviewRow } from "./entityOverview";

const DAY = 86_400_000;
export type CalEvent = { id: string; type: string; kdType?: string; title: string; production: string | null; productionId: number | null; startDate: string; endDate?: string | null; color: string; href?: string; venue?: string };
/** key: what it is (e.g. expense:12); version: changes when the thing does, so a hidden item comes back */
export type NeedsItem = { key: string; version: string; href: string; text: string; when: string; at: string };
export type HomeData = Awaited<ReturnType<typeof newHomeData>>;

const ago = (d: Date, now: Date) => {
  const days = Math.floor((now.getTime() - d.getTime()) / DAY);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

export async function newHomeData(viewer: { id: number; name: string; role: string; permissions: string | null }, got: { calEvents: CalEvent[]; entityOverview: { rows: EntityOverviewRow[] } | null }) {
  const now = new Date();
  const perms = parsePerms(viewer.permissions);
  const can = (m: string) => canAccess(perms, m, viewer.role);
  const staff = viewer.role === "admin" || viewer.role === "member";
  const me = await prisma.user.findUnique({ where: { id: viewer.id }, select: { homeRole: true } });
  const homeRole: HomeRole = homeRoleOf({ role: viewer.role, homeRole: me?.homeRole });
  const limit = viewer.role === "admin" ? null : await companyLimit(viewer.id);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  // Productions this person may see (same rule as the productions list)
  const prodWhere: Record<string, unknown> = { archived: false };
  if (viewer.role !== "admin" && (viewer.role === "client" || viewer.role === "freelancer" || !perms.allProductions)) prodWhere.team = { some: { userId: viewer.id } };
  if (limit) prodWhere.entityId = { in: limit };
  const seeBudget = !hiddenSectionsFor(viewer.role, viewer.permissions).has("budget");

  const [productions, myTasks, expenses, purchases, salesTasks, overBudget, attention] = await Promise.all([
    can("productions") ? prisma.production.findMany({ where: prodWhere, select: { id: true, name: true, status: true, color: true, venue: true, venueRef: { select: { name: true, city: true } }, team: { select: { userId: true } } }, orderBy: { startDate: "asc" } }) : [],
    can("tasks") ? prisma.task.findMany({ where: { assigneeUserId: viewer.id, status: { not: "done" } }, select: { id: true, title: true, dueDate: true, status: true, production: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 50 }) : [],
    can("finance") ? prisma.productionExpense.findMany({ where: { status: "pending" }, select: { id: true, description: true, netAmount: true, createdAt: true, submittedByUser: { select: { name: true } }, productionLink: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }) : [],
    can("finance") ? prisma.companyInvoice.findMany({ where: { type: "purchase", status: "received" }, select: { id: true, party: true, reference: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }) : [],
    can("sales") ? prisma.salesTask.findMany({ where: { completedAt: null, dueDate: { lte: endOfToday } }, select: { id: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 10 }) : [],
    can("productions") && seeBudget ? prisma.budgetLine.findMany({ where: { alertLevel: 100, production: { archived: false, team: { some: { userId: viewer.id } }, ...(limit ? { entityId: { in: limit } } : {}) } }, select: { id: true, department: true, description: true, updatedAt: true, production: { select: { id: true, name: true } } }, take: 10 }) : [],
    viewer.role === "admin" ? readAttention(prisma).catch(() => null) : null,
  ]);

  // ── Needs you: one line each, newest first, each linking to where it's done ─────────────
  const short = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);
  const all: NeedsItem[] = [
    ...expenses.map(e => ({ key: `expense:${e.id}`, version: e.createdAt.toISOString(), href: "/finance?tab=expenses", text: `Approve expense: ${e.description}${e.submittedByUser ? ` (${e.submittedByUser.name})` : ""}${e.productionLink ? ` · ${e.productionLink.name}` : ""}`, at: e.createdAt.toISOString(), when: ago(e.createdAt, now) })),
    ...purchases.map(p => ({ key: `purchase:${p.id}`, version: p.createdAt.toISOString(), href: "/finance?tab=purchase", text: `Approve purchase invoice: ${p.party}${p.reference ? ` ${p.reference}` : ""}`, at: p.createdAt.toISOString(), when: ago(p.createdAt, now) })),
    ...myTasks.filter(t => t.dueDate && t.dueDate <= endOfToday).map(t => {
      const overdue = t.dueDate! < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { key: `task:${t.id}`, version: `${t.dueDate!.toISOString()}${overdue ? ":late" : ""}`, href: `/tasks?highlight=${t.id}`, text: `${overdue ? "Task overdue" : "Task due today"}: ${t.title}${t.production ? ` · ${t.production.name}` : ""}`, at: t.dueDate!.toISOString(), when: ago(t.dueDate!, now) };
    }),
    ...salesTasks.map(t => ({ key: `sales:${t.id}`, version: (t.dueDate ?? now).toISOString(), href: "/sales?tab=tasks", text: `Sales task: ${t.title}`, at: (t.dueDate ?? now).toISOString(), when: t.dueDate ? ago(t.dueDate, now) : "" })),
    ...overBudget.map(b => ({ key: `budget:${b.id}`, version: b.updatedAt.toISOString(), href: `/productions/${b.production.id}?section=budget`, text: `Over budget: ${b.department}: ${b.description} · ${b.production.name}`, at: b.updatedAt.toISOString(), when: ago(b.updatedAt, now) })),
    ...(attention?.items ?? []).map(i => ({ key: `import:${short(`${i.subject}|${i.receivedAt ?? ""}`)}`, version: attention!.at, href: "/admin/settings", text: `Show report didn't import: ${i.subject}`, at: i.receivedAt ?? attention!.at, when: ago(new Date(i.receivedAt ?? attention!.at), now) })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  // What the person has hidden stays hidden until it changes. Hidden things that have gone are forgotten.
  const hidden = await hiddenNeedsFor(viewer.id);
  const needs = all.filter(n => hidden[n.key] !== n.version);
  const hiddenNeeds = all.length - needs.length;
  const current = new Set(all.map(n => n.key));
  if (Object.keys(hidden).some(k => !current.has(k))) await setHiddenNeeds(viewer.id, {}, current).catch(() => null);

  // ── On today and coming up (schedule and key dates) ──────────────────────────────────────
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const dated = got.calEvents.filter(e => e.type === "key_date" || e.type === "tour_stop");
  const today = dated.filter(e => new Date(e.startDate) <= endOfToday && new Date(e.endDate ?? e.startDate) >= start);
  const comingUp = dated.filter(e => new Date(e.startDate) > endOfToday && new Date(e.startDate) <= new Date(now.getTime() + 30 * DAY)).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).slice(0, 8);
  const showsToday = new Set(today.filter(e => e.productionId).map(e => e.productionId)).size;

  // ── Role panel ────────────────────────────────────────────────────────────────────────────
  const live = productions.filter(p => p.status === "in-production");
  const weekOut = new Date(now.getTime() + 7 * DAY);
  const outThisWeek = dated.filter(e => (e.kdType === "get_out" || e.kdType === "closing_night") && new Date(e.startDate) >= start && new Date(e.startDate) <= weekOut);
  const nextKey = dated.filter(e => e.type === "key_date" && new Date(e.startDate) > endOfToday).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ?? null;
  const pipeline = got.entityOverview?.rows.reduce((s, r) => s + (r.pipeline?.weighted ?? 0), 0) ?? null;
  const openDeals = got.entityOverview?.rows.reduce((s, r) => s + (r.pipeline?.open ?? 0), 0) ?? 0;
  const director = {
    live: live.length,
    pipeline: can("bd") ? pipeline : null, openDeals,
    outThisWeek: outThisWeek.length, outNames: [...new Set(outThisWeek.map(e => e.production).filter(Boolean))].slice(0, 3) as string[],
    nextKey: nextKey && { title: nextKey.title, production: nextKey.production, at: nextKey.startDate, href: nextKey.productionId ? `/productions/${nextKey.productionId}?section=schedule` : "/calendar" },
  };
  const mine = productions.filter(p => p.team.some(t => t.userId === viewer.id) && p.status !== "closed").map(p => {
    const next = dated.filter(e => e.productionId === p.id && new Date(e.endDate ?? e.startDate) >= start).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ?? null;
    return { id: p.id, name: p.name, color: p.color, venue: p.venueRef ? [p.venueRef.name, p.venueRef.city].filter(Boolean).join(", ") : p.venue, next: next && { title: next.title, at: next.startDate } };
  });
  let office: { expenses: number; invoicesToChase: number; cockshute: number; hs: number } | null = null;
  if (homeRole === "office") {
    const hsWhere = staff ? await visibleWhere(viewer.id, viewer.role) : null;
    const [chase, cockshute, hs] = await Promise.all([
      can("finance") ? prisma.companyInvoice.count({ where: { type: "sales", status: { not: "paid" }, dueDate: { lt: now } } }) : 0,
      can("property") ? prisma.propertyMaintenance.count({ where: { status: { not: "resolved" } } }) : 0,
      hsWhere ? prisma.incident.count({ where: { AND: [hsWhere, { status: { not: "closed" } }] } }) : 0,
    ]);
    office = { expenses: can("finance") ? await prisma.productionExpense.count({ where: { status: "pending" } }) : 0, invoicesToChase: chase, cockshute, hs };
  }

  // ── Companies (directors): one row each, live, pipeline, next 14 days ───────────────────
  const in14 = new Date(now.getTime() + 14 * DAY);
  const companies = homeRole === "director" && got.entityOverview ? got.entityOverview.rows.map(r => ({
    name: r.name, spaceSlug: r.spaceSlug,
    live: r.live?.count ?? 0,
    pipeline: r.pipeline ? { open: r.pipeline.open, weighted: r.pipeline.weighted } : null,
    next14: (r.dates ?? []).filter(d => new Date(d.at) <= in14).length,
  })) : null;

  // ── Spaces: PSG, the person's company spaces, and Rentals & Crew (coming) ───────────────
  const spaceRows = staff ? await prisma.entity.findMany({ where: { hasSpace: true, archived: false, slug: { not: null }, ...(limit ? { id: { in: limit } } : {}) }, select: { id: true, name: true, slug: true, color: true, logoMime: true, updatedAt: true, spaceKind: true } }) : [];
  const builds = spaceRows.length ? await prisma.job.groupBy({ by: ["entityId"], where: { entityId: { in: spaceRows.map(s => s.id) }, status: "active", stage: { in: ["build", "finish"] } }, _count: true }) : [];
  // Rentals spaces: hires confirmed or out (PSG Rentals & Crew)
  const rentalIds = spaceRows.filter(s => s.spaceKind === "rentals").map(s => s.id);
  const hiresLive = rentalIds.length ? await prisma.rentalHire.groupBy({ by: ["entityId"], where: { entityId: { in: rentalIds }, status: { in: ["confirmed", "out"] } }, _count: true }) : [];
  const spaces = spaceRows.map(s => ({
    slug: s.slug!, name: s.name, color: s.color, kind: s.spaceKind,
    hires: hiresLive.find(h => h.entityId === s.id)?._count ?? 0,
    logoUrl: s.logoMime ? `/api/spaces/${s.slug}/logo?v=${s.updatedAt.getTime()}` : null,
    builds: builds.find(b => b.entityId === s.id)?._count ?? 0,
  }));

  return {
    homeRole, needs, hiddenNeeds, today, comingUp, showsToday, director, mine, office, companies, spaces,
    tasks: myTasks.slice(0, 8).map(t => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null })),
    pins: (await pinsFor(viewer.id)) ?? PIN_DEFAULTS[homeRole],
    seeFinance: can("finance"), seeBd: can("bd"),
  };
}
