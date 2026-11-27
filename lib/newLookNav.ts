// The new look's navigation map (build brief, "Navigation map"): today's 30 home tiles as 11 sidebar
// items in four groups. Nothing is removed; pages with siblings are sub-items under one entry.
// Every route is unchanged. Items a person can't use are hidden, not greyed out.
// Browser-safe (used by the shell, the phone menu and search).
import { canAccess, parsePerms } from "./permissions.ts";

export type NavLink = { label: string; href: string; keywords?: string[] };
export type NavEntry = NavLink & { key: string; icon: string; count?: "tasks" | "productions" | "deals" | "finance"; subs?: NavLink[]; match?: string[] };
export type NavGroup = { label: string | null; items: NavEntry[] };
type Viewer = { role: string; permissions?: string | null };

const staff = (v: Viewer) => v.role === "admin" || v.role === "member";

/** The full map, before anything is hidden. Icons are Lucide names. */
const MAP: { label: string | null; items: (NavEntry & { show: (v: Viewer, can: (m: string) => boolean) => boolean; subShow?: Record<string, (v: Viewer, can: (m: string) => boolean) => boolean> })[] }[] = [
  { label: null, items: [
    { key: "home", label: "Home", href: "/", icon: "Home", match: ["/"], show: () => true },
    { key: "tasks", label: "My tasks", href: "/tasks", icon: "CheckSquare", count: "tasks", keywords: ["tasks", "operations"], show: (v, can) => can("tasks") },
    { key: "mine", label: "My productions", href: "/productions?mine=1", icon: "Star", match: [], show: (v, can) => can("productions") },
  ] },
  { label: "Work", items: [
    { key: "productions", label: "Productions", href: "/productions", icon: "Clapperboard", count: "productions", match: ["/productions", "/venues", "/hotels", "/haulage"],
      subs: [{ label: "Productions", href: "/productions", keywords: ["new production", "archived"] }, { label: "Venues", href: "/venues" }, { label: "Hotels", href: "/hotels" }, { label: "Haulage", href: "/haulage", keywords: ["trucks", "movements"] }],
      show: (v, can) => can("productions") || can("venues"),
      subShow: { "/productions": (v, can) => can("productions"), "/venues": (v, can) => can("venues"), "/hotels": (v, can) => can("productions"), "/haulage": (v, can) => staff(v) && can("productions") } },
    { key: "calendar", label: "Calendar and schedule", href: "/calendar", icon: "CalendarDays", match: ["/calendar", "/schedule"],
      subs: [{ label: "Calendar", href: "/calendar" }, { label: "Schedule", href: "/schedule" }], show: (v, can) => can("productions") },
    { key: "jobs", label: "Jobs and quotes", href: "/jobs", icon: "BriefcaseBusiness", match: ["/jobs", "/bd/quotes"],
      subs: [{ label: "Jobs", href: "/jobs" }, { label: "Quotes", href: "/bd/quotes" }], show: v => staff(v),
      subShow: { "/bd/quotes": (v, can) => staff(v) && can("bd") } },
    { key: "bd", label: "BD pipeline", href: "/bd", icon: "Megaphone", count: "deals", match: ["/bd", "/sales"],
      subs: [{ label: "Pipeline", href: "/bd", keywords: ["deals", "clients"] }, { label: "Brands", href: "/sales" }, { label: "Sales tasks", href: "/sales?tab=tasks" }],
      show: (v, can) => can("bd") || can("sales"), subShow: { "/bd": (v, can) => can("bd"), "/sales": (v, can) => can("sales"), "/sales?tab=tasks": (v, can) => can("sales") } },
  ] },
  { label: "Money", items: [
    { key: "finance", label: "Finance", href: "/finance", icon: "PoundSterling", count: "finance", match: ["/finance"],
      subs: [{ label: "Sales invoices", href: "/finance", keywords: ["invoices"] }, { label: "Purchase invoices", href: "/finance?tab=purchase" }, { label: "Expenses", href: "/finance?tab=expenses", keywords: ["receipts", "claims"] }, { label: "Invoice to-do", href: "/finance?tab=todo" }],
      show: (v, can) => can("finance") },
  ] },
  { label: "Company", items: [
    { key: "operations", label: "Operations", href: "/property", icon: "Wrench", match: ["/property", "/suppliers", "/health-safety", "/compliance"],
      subs: [{ label: "Cockshute Industrial Estate", href: "/property", keywords: ["property", "estate"] }, { label: "Health and safety", href: "/health-safety", keywords: ["incidents", "riddor"] }, { label: "Compliance register", href: "/compliance", keywords: ["insurance", "accreditations"] }, { label: "Supplier register", href: "/suppliers", keywords: ["suppliers"] }],
      show: (v, can) => can("property") || can("suppliers") || staff(v),
      subShow: { "/property": (v, can) => can("property"), "/suppliers": (v, can) => can("suppliers"), "/health-safety": v => staff(v), "/compliance": v => staff(v) } },
    { key: "marketing", label: "Marketing", href: "/marketing", icon: "Share2", match: ["/marketing"],
      subs: [{ label: "Content calendar", href: "/marketing" }, { label: "Post list", href: "/marketing?view=list" }], show: (v, can) => can("marketing") },
    { key: "help", label: "Help and ideas", href: "/helpdesk", icon: "LifeBuoy", match: ["/roadmap", "/helpdesk", "/ask", "/fun"],
      subs: [{ label: "Ideas and roadmap", href: "/roadmap" }, { label: "Help desk", href: "/helpdesk" }, { label: "Ask me anything", href: "/ask" }, { label: "Fun Corner", href: "/fun" }],
      show: () => true, subShow: { "/roadmap": (v, can) => can("roadmap"), "/ask": (v, can) => can("ask"), "/fun": (v, can) => can("fun") } },
    { key: "admin", label: "Admin", href: "/director", icon: "Settings", match: ["/director", "/admin"],
      subs: [{ label: "Director dashboard", href: "/director" }, { label: "Users", href: "/admin/users" }, { label: "Hub settings", href: "/admin/settings" }], show: v => v.role === "admin" },
  ] },
];

/** The map for this person: only what they can use (a group with nothing left is dropped). */
export function navFor(viewer: Viewer): NavGroup[] {
  const perms = parsePerms(viewer.permissions ?? null);
  const can = (m: string) => canAccess(perms, m, viewer.role);
  return MAP.map(g => ({
    label: g.label,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- show is used by the filter above
    items: g.items.filter(i => i.show(viewer, can)).map(({ show, subShow, ...i }) => {
      const subs = i.subs?.filter(s => !subShow?.[s.href] || subShow[s.href](viewer, can));
      // The item opens its first sub-page this person can use
      return { ...i, href: subs?.length ? (subs.some(s => s.href === i.href) ? i.href : subs[0].href) : i.href, subs };
    }),
  })).filter(g => g.items.length);
}

/** Which item a page belongs to: an item whose link has a query ("?mine=1") when that query is
 *  on the page, else the longest path match ("/" only matches home). */
export function activeKey(groups: NavGroup[], pathname: string, search = ""): string | null {
  const here = new URLSearchParams(search);
  for (const g of groups) for (const i of g.items) {
    const [p, qs] = i.href.split("?");
    if (qs && p === pathname && [...new URLSearchParams(qs)].every(([k, v]) => here.get(k) === v)) return i.key;
  }
  let best: { key: string; len: number } | null = null;
  for (const g of groups) for (const i of g.items) for (const m of i.match ?? [i.href.split("?")[0]]) {
    const hit = m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`);
    if (hit && (!best || m.length > best.len)) best = { key: i.key, len: m.length };
  }
  return best?.key ?? null;
}

/** Every page in the map as searchable entries ("expenses" → Finance › Expenses). */
export function navPages(groups: NavGroup[]): { label: string; href: string; words: string }[] {
  return groups.flatMap(g => g.items.flatMap(i => [
    { label: i.label, href: i.href, words: [i.label, ...(i.keywords ?? [])].join(" ").toLowerCase() },
    ...(i.subs ?? []).filter(s => s.label !== i.label).map(s => ({ label: `${i.label} › ${s.label}`, href: s.href, words: [s.label, ...(s.keywords ?? [])].join(" ").toLowerCase() })),
  ]));
}
