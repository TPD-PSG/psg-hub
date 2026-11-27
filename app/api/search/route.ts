// New look search (⌘K / Ctrl K, build brief stage 3): productions, venues, hotels, people and crew,
// suppliers, clients, deals, tasks and invoices, grouped by type. Each type only for people who can
// open that area, and productions, deals and clients only within the companies they can see.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, parsePerms } from "@/lib/permissions";
import { companyLimit } from "@/lib/companyScope";

export const dynamic = "force-dynamic";
const N = 6;

export type SearchHit = { type: string; label: string; line?: string | null; href: string };

export async function GET(req: Request) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const id = Number(u.id), role = u.role ?? "member", perms = parsePerms(u.permissions ?? null);
  const can = (m: string) => canAccess(perms, m, role);
  const staff = role === "admin" || role === "member";
  const limit = role === "admin" ? null : await companyLimit(id);
  const has = { contains: q };
  const prodWhere: Record<string, unknown> = { OR: [{ name: has }, { venue: has }] };
  if (role !== "admin" && (role === "client" || role === "freelancer" || !perms.allProductions)) prodWhere.team = { some: { userId: id } };
  if (limit) prodWhere.entityId = { in: limit };

  const none = Promise.resolve([] as never[]);
  const [productions, venues, hotels, crew, people, suppliers, clients, deals, tasks, invoices] = await Promise.all([
    can("productions") ? prisma.production.findMany({ where: prodWhere, select: { id: true, name: true, venue: true, archived: true }, orderBy: [{ archived: "asc" }, { startDate: "desc" }], take: N }) : none,
    can("venues") ? prisma.venue.findMany({ where: { OR: [{ name: has }, { city: has }] }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" }, take: N }) : none,
    can("productions") ? prisma.hotel.findMany({ where: { OR: [{ name: has }, { city: has }] }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" }, take: N }) : none,
    staff && can("productions") ? prisma.crew.findMany({ where: { name: has }, select: { id: true, name: true, discipline: true }, orderBy: { name: "asc" }, take: N }) : none,
    role === "admin" ? prisma.user.findMany({ where: { name: has, deactivatedAt: null, role: { in: ["admin", "member"] } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: N }) : none,
    can("suppliers") ? prisma.supplier.findMany({ where: { name: has }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: N }) : none,
    can("bd") ? prisma.client.findMany({ where: { name: has }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" }, take: N }) : none,
    can("bd") ? prisma.opportunity.findMany({ where: { title: has, ...(limit ? { entityId: { in: limit } } : {}) }, select: { id: true, title: true, stage: true }, orderBy: { updatedAt: "desc" }, take: N }) : none,
    can("tasks") ? prisma.task.findMany({ where: { title: has, OR: [{ assigneeUserId: id }, { createdByUserId: id }, ...(staff && perms.allProductions ? [{ productionId: { not: null } }] : [])] }, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: N }) : none,
    can("finance") ? prisma.companyInvoice.findMany({ where: { OR: [{ reference: has }, { party: has }, { description: has }] }, select: { id: true, type: true, reference: true, party: true, description: true }, orderBy: { dueDate: "desc" }, take: N }) : none,
  ]);
  const results: SearchHit[] = [
    ...productions.map(p => ({ type: "Productions", label: p.name, line: [p.venue, p.archived ? "archived" : null].filter(Boolean).join(" · ") || null, href: `/productions/${p.id}` })),
    ...venues.map(v => ({ type: "Venues", label: v.name, line: v.city, href: `/venues?venue=${v.id}` })),
    ...hotels.map(h => ({ type: "Hotels", label: h.name, line: h.city, href: `/hotels?hotel=${h.id}` })),
    ...people.map(p => ({ type: "People", label: p.name, line: "PSG", href: `/admin/users?user=${p.id}` })),
    ...crew.map(c => ({ type: "People", label: c.name, line: c.discipline, href: `/crew?crew=${c.id}` })),
    ...suppliers.map(s => ({ type: "Suppliers", label: s.name, href: `/suppliers?supplier=${s.id}` })),
    ...clients.map(c => ({ type: "Clients", label: c.name, line: c.type, href: `/bd?client=${c.id}` })),
    ...deals.map(d => ({ type: "Deals", label: d.title, line: d.stage, href: `/bd?deal=${d.id}` })),
    ...tasks.map(t => ({ type: "Tasks", label: t.title, line: t.status.replace("_", " "), href: `/tasks?highlight=${t.id}` })),
    ...invoices.map(i => ({ type: "Invoices", label: i.reference ?? i.description, line: `${i.type === "sales" ? "Sales" : "Purchase"} · ${i.party}`, href: `/finance${i.type === "purchase" ? "?tab=purchase" : ""}` })),
  ];
  return NextResponse.json({ results });
}
