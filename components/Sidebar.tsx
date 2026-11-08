"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

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

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [prodName, setProdName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed(c => {
      try { localStorage.setItem("sidebar-collapsed", String(!c)); } catch {}
      return !c;
    });
  }

  // Detect production detail: /productions/123
  const prodMatch = pathname.match(/^\/productions\/(\d+)/);
  const prodId = prodMatch?.[1] ?? null;

  // Fetch production name for the sidebar title
  useEffect(() => {
    if (!prodId) { setProdName(null); return; }
    fetch(`/api/productions/${prodId}`)
      .then(r => r.json())
      .then(d => setProdName(d?.name ?? null))
      .catch(() => setProdName(null));
  }, [prodId]);

  // Determine which section definition to use
  let section: SectionDef | null = null;

  if (prodId) {
    const currentSection = searchParams.get("section") ?? "schedule";
    section = {
      title: prodName ?? "Production",
      backHref: "/productions",
      items: PRODUCTION_SECTIONS.map(s => ({
        ...s,
        href: `/productions/${prodId}?section=${s.section}`,
      })),
    };
    // mark active based on current section param
    section = {
      ...section,
      items: section.items.map(item => ({
        ...item,
        active: item.section === currentSection,
      } as NavItem & { active: boolean })),
    };
  } else {
    const key = Object.keys(STATIC_SECTIONS).find(k => pathname.startsWith(k));
    section = key ? STATIC_SECTIONS[key] : null;
  }

  if (!section) return null;

  const currentSection = searchParams.get("section") ?? searchParams.get("tab") ?? null;

  function isActive(item: NavItem) {
    if (prodId) return item.section === (searchParams.get("section") ?? "schedule");
    if (item.section) return (currentSection ?? "Overview") === item.section;
    // For items without section, match exact pathname
    const itemPath = item.href.split("?")[0];
    return pathname === itemPath && !currentSection;
  }

  return (
    <aside
      className="shrink-0 flex flex-col border-r transition-[width] duration-200"
      style={{
        width: collapsed ? 44 : 220,
        backgroundColor: "var(--psg-card-bg)",
        borderColor: "var(--psg-card-border)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3.5 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        {!collapsed && (
          <span className="text-sm font-semibold text-white truncate pr-2">{section.title}</span>
        )}
        <button
          onClick={toggle}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors shrink-0 text-lg leading-none"
          style={{ color: "var(--psg-muted)", marginLeft: collapsed ? "auto" : undefined }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 overflow-hidden">
        {section.items.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
              style={{ color: active ? "white" : "var(--psg-muted)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: active ? "var(--psg-blue)" : "transparent", border: active ? "none" : "1px solid currentColor", opacity: active ? 1 : 0.4 }}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Back link */}
      <div className="p-3 border-t" style={{ borderColor: "var(--psg-card-border)" }}>
        {!collapsed ? (
          <Link href={section.backHref ?? "/"} className="flex items-center gap-1.5 text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>
            ← {section.backHref ? "Back" : "Home"}
          </Link>
        ) : (
          <Link href={section.backHref ?? "/"} title={section.backHref ? "Back" : "Home"} className="flex items-center justify-center hover:text-white transition-colors text-sm" style={{ color: "var(--psg-muted)" }}>←</Link>
        )}
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense>
      <SidebarInner />
    </Suspense>
  );
}
