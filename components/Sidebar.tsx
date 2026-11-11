"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, createContext, useContext } from "react";

// ── Mobile sidebar context ────────────────────────────────────────────────────

type MobileSidebarCtx = { open: boolean; setOpen: (v: boolean) => void };
const MobileSidebarContext = createContext<MobileSidebarCtx>({ open: false, setOpen: () => {} });
export function useMobileSidebar() { return useContext(MobileSidebarContext); }

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

// ── Types & data ──────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; section?: string };
type SectionDef = { title: string; backHref?: string; items: NavItem[] };

const STATIC_SECTIONS: Record<string, SectionDef> = {
  "/productions": {
    title: "Productions",
    items: [
      { label: "All Productions", href: "/productions" },
      { label: "New Production", href: "/productions/new" },
    ],
  },
  "/calendar": {
    title: "Calendar",
    items: [{ label: "Calendar", href: "/calendar" }],
  },
  "/venues": {
    title: "Venues",
    items: [{ label: "All Venues", href: "/venues" }],
  },
  "/tasks": {
    title: "Tasks",
    items: [{ label: "All Tasks", href: "/tasks" }],
  },
  "/bd": {
    title: "Business Dev",
    items: [{ label: "Pipeline", href: "/bd" }],
  },
  "/finance": {
    title: "Finance",
    items: [
      { label: "Sales Invoices", href: "/finance" },
      { label: "Purchase Invoices", href: "/finance?tab=purchase" },
      { label: "Expenses", href: "/finance?tab=expenses" },
    ],
  },
  "/sales": {
    title: "Sales",
    items: [
      { label: "Brands", href: "/sales" },
      { label: "Tasks", href: "/sales?tab=tasks" },
    ],
  },
  "/roadmap": {
    title: "Roadmap",
    items: [{ label: "Roadmap", href: "/roadmap" }],
  },
  "/admin": {
    title: "Admin",
    items: [
      { label: "Users", href: "/admin/users" },
      { label: "Hub Settings", href: "/admin/settings" },
    ],
  },
  "/property": {
    title: "Cockshute Industrial Estate",
    items: [
      { label: "Overview", href: "/property", section: "Overview" },
      { label: "Maintenance", href: "/property?tab=Maintenance", section: "Maintenance" },
      { label: "Documents", href: "/property?tab=Documents", section: "Documents" },
      { label: "Contacts", href: "/property?tab=Contacts", section: "Contacts" },
      { label: "Keys & Alarms", href: "/property?tab=Keys+%26+Alarms", section: "Keys & Alarms" },
    ],
  },
};

const PRODUCTION_SECTIONS: NavItem[] = [
  { label: "Schedule", href: "", section: "schedule" },
  { label: "Tour Stops", href: "", section: "tour" },
  { label: "Budget", href: "", section: "budget" },
  { label: "Crew", href: "", section: "crew" },
  { label: "Accommodation", href: "", section: "accommodation" },
  { label: "Haulage", href: "", section: "haulage" },
  { label: "Call Sheets", href: "", section: "callsheets" },
  { label: "Tasks", href: "", section: "tasks" },
];

type CalProduction = { id: number; name: string; color: string };

const CAL_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

const EVENT_TYPE_FILTERS = [
  { key: "key_date", label: "Key Dates", color: "#a78bfa" },
  { key: "tour_stop", label: "Tour Stops", color: "#38bdf8" },
  { key: "task", label: "Tasks", color: "#6b7280" },
];

// ── Main sidebar inner ────────────────────────────────────────────────────────

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [prodName, setProdName] = useState<string | null>(null);
  const [calProductions, setCalProductions] = useState<CalProduction[]>([]);
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileSidebar();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      setCollapsed(saved === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchParams, setMobileOpen]);

  function toggle() {
    setCollapsed(c => {
      try { localStorage.setItem("sidebar-collapsed", String(!c)); } catch {}
      return !c;
    });
  }

  const prodMatch = pathname.match(/^\/productions\/(\d+)/);
  const prodId = prodMatch?.[1] ?? null;

  useEffect(() => {
    if (!prodId) { setProdName(null); return; }
    fetch(`/api/productions/${prodId}`)
      .then(r => r.json())
      .then(d => setProdName(d?.name ?? null))
      .catch(() => setProdName(null));
  }, [prodId]);

  useEffect(() => {
    if (pathname !== "/calendar") { setCalProductions([]); return; }
    fetch("/api/productions")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setCalProductions(d.map((p: { id: number; name: string }, i: number) => ({
            id: p.id,
            name: p.name,
            color: CAL_COLORS[i % CAL_COLORS.length],
          })));
        }
      })
      .catch(() => {});
  }, [pathname]);

  const hiddenProdsParam = searchParams.get("hideProds") ?? "";
  const hiddenTypesParam = searchParams.get("hideTypes") ?? "";
  const hiddenProdIds = new Set(hiddenProdsParam ? hiddenProdsParam.split(",").map(Number) : []);
  const hiddenTypeKeys = new Set(hiddenTypesParam ? hiddenTypesParam.split(",") : []);

  function toggleCalProd(id: number) {
    const next = new Set(hiddenProdIds);
    next.has(id) ? next.delete(id) : next.add(id);
    const params = new URLSearchParams(searchParams.toString());
    if (next.size) params.set("hideProds", [...next].join(","));
    else params.delete("hideProds");
    router.replace(`/calendar?${params.toString()}`);
  }

  function toggleCalType(key: string) {
    const next = new Set(hiddenTypeKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    const params = new URLSearchParams(searchParams.toString());
    if (next.size) params.set("hideTypes", [...next].join(","));
    else params.delete("hideTypes");
    router.replace(`/calendar?${params.toString()}`);
  }

  function showAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("hideProds");
    params.delete("hideTypes");
    router.replace(`/calendar?${params.toString()}`);
  }

  let section: SectionDef | null = null;

  if (prodId) {
    section = {
      title: prodName ?? "Production",
      backHref: "/productions",
      items: PRODUCTION_SECTIONS.map(s => ({
        ...s,
        href: `/productions/${prodId}?section=${s.section}`,
      })),
    };
    section = {
      ...section,
      items: section.items.map(item => ({
        ...item,
        active: item.section === (searchParams.get("section") ?? "schedule"),
      } as NavItem & { active: boolean })),
    };
  } else {
    const key = Object.keys(STATIC_SECTIONS).find(k => pathname.startsWith(k));
    section = key ? STATIC_SECTIONS[key] : null;
  }

  if (!section) return null;
  if (collapsed === null) return null;

  const currentSection = searchParams.get("section") ?? searchParams.get("tab") ?? null;

  function isActive(item: NavItem) {
    if (prodId) return item.section === (searchParams.get("section") ?? "schedule");
    if (item.section) return (currentSection ?? "Overview") === item.section;
    const itemPath = item.href.split("?")[0];
    return pathname === itemPath && !currentSection;
  }

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3.5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        {(!collapsed || isMobile) && (
          <span className="text-sm font-semibold text-white truncate pr-2">{section!.title}</span>
        )}
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors shrink-0 text-lg"
            style={{ color: "var(--psg-muted)", marginLeft: collapsed ? "auto" : undefined }}
            title="Close"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={toggle}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors shrink-0 text-lg leading-none"
            style={{ color: "var(--psg-muted)", marginLeft: collapsed ? "auto" : undefined }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {section!.items.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed && !isMobile ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
              style={{ color: active ? "white" : "var(--psg-muted)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: active ? "var(--psg-blue)" : "transparent", border: active ? "none" : "1px solid currentColor", opacity: active ? 1 : 0.4 }}
              />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {/* Calendar production filters */}
        {pathname === "/calendar" && (!collapsed || isMobile) && calProductions.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Productions</div>
            {calProductions.map(p => {
              const on = !hiddenProdIds.has(p.id);
              return (
                <button key={p.id} onClick={() => toggleCalProd(p.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: on ? "white" : "var(--psg-muted)" }}>
                  <span className="w-1.5 h-1.5 rounded-sm shrink-0 transition-opacity" style={{ backgroundColor: p.color, opacity: on ? 1 : 0.3 }} />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}

            <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Show</div>
            {EVENT_TYPE_FILTERS.map(t => {
              const on = !hiddenTypeKeys.has(t.key);
              return (
                <button key={t.key} onClick={() => toggleCalType(t.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: on ? "white" : "var(--psg-muted)" }}>
                  <span className="w-1.5 h-1.5 rounded-sm shrink-0 transition-opacity" style={{ backgroundColor: t.color, opacity: on ? 1 : 0.3 }} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}

            {(hiddenProdIds.size > 0 || hiddenTypeKeys.size > 0) && (
              <button onClick={showAll} className="w-full px-3 py-2 text-xs text-left transition-colors hover:text-white" style={{ color: "var(--psg-muted)" }}>
                Show all
              </button>
            )}
          </>
        )}
      </nav>

      {/* Back link */}
      <div className="p-3 border-t" style={{ borderColor: "var(--psg-card-border)" }}>
        {(!collapsed || isMobile) ? (
          <Link href={section!.backHref ?? "/"} className="flex items-center gap-1.5 text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>
            ← {section!.backHref ? "Back" : "Home"}
          </Link>
        ) : (
          <Link href={section!.backHref ?? "/"} title={section!.backHref ? "Back" : "Home"} className="flex items-center justify-center hover:text-white transition-colors text-sm" style={{ color: "var(--psg-muted)" }}>←</Link>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 flex-col border-r transition-[width] duration-200"
        style={{
          width: collapsed ? 44 : 220,
          backgroundColor: "var(--psg-card-bg)",
          borderColor: "var(--psg-card-border)",
          minHeight: "calc(100vh - 56px)",
        }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 flex flex-col border-r transition-transform duration-250 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          width: 260,
          height: "100dvh",
          backgroundColor: "var(--psg-card-bg)",
          borderColor: "var(--psg-card-border)",
        }}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}

export default function Sidebar() {
  return (
    <Suspense>
      <SidebarInner />
    </Suspense>
  );
}
