"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { parsePerms, canAccess } from "@/lib/permissions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Production = { id: number; name: string; status: string; startDate: string | null; endDate: string | null; announcementStatus?: string };
type CalEvent = { id: string; type: string; title: string; production: string | null; productionId: number | null; startDate: string; color: string; href?: string };
type Task = { id: number; title: string; status: string; dueDate: string | null; assigneeUserId: number | null; production?: { name: string } | null };
type Maintenance = { id: number; status: string; priority: string; title: string };
type QuickLink = { id: number; label: string; url: string; icon: string };
type Opportunity = { id: number; stage: string };
type Invoice = { id: number; type: string; status: string; netAmount: number; vatAmount: number; dueDate: string | null };
type SalesBrand = { id: number; stage: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const ANN_COLORS: Record<string, string> = {
  not_announced: "bg-gray-800 text-gray-400",
  nda: "bg-purple-900/60 text-purple-300",
  on_sale: "bg-green-900/60 text-green-300",
  open: "bg-blue-900/60 text-blue-300",
};
const ANN_LABELS: Record<string, string> = {
  not_announced: "", nda: "NDA", on_sale: "On Sale", open: "Open",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-5 ${className}`}
      style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>{title}</h2>
      {action}
    </div>
  );
}

function WaitingRow({ count, label, sub, href, alert }: { count: number; label: string; sub: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-4 py-3 border-b last:border-0 hover:bg-white/5 -mx-5 px-5 transition-colors group"
      style={{ borderColor: "var(--psg-card-border)" }}>
      <span className={`text-2xl font-bold w-10 text-center shrink-0 ${alert ? "text-red-400" : "text-white"}`}>{count}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{sub}</div>
      </div>
      <span className="text-white/20 group-hover:text-white/60 transition-colors">›</span>
    </Link>
  );
}

function CompactTile({ href, icon, title, sub, badge }: { href: string; icon: string; title: string; sub: string; badge?: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border p-3.5 hover:border-blue-500/40 hover:bg-white/5 transition-all group"
      style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white flex items-center gap-2">
          {title}
          {badge ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">{badge}</span> : null}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "var(--psg-muted)" }}>{sub}</div>
      </div>
      <span className="text-white/20 group-hover:text-white/60 transition-colors shrink-0">›</span>
    </Link>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-white/60">{title}</h2>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--psg-card-border)" }} />
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

function QuickSearch({ productions, tasks }: { productions: Production[]; tasks: Task[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const trimmed = q.trim().toLowerCase();
  const matchedProds = trimmed ? productions.filter(p => p.name.toLowerCase().includes(trimmed)).slice(0, 4) : [];
  const matchedTasks = trimmed ? tasks.filter(t => t.title.toLowerCase().includes(trimmed)).slice(0, 3) : [];
  const hasResults = matchedProds.length > 0 || matchedTasks.length > 0;

  return (
    <div ref={ref} className="relative">
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search productions, tasks…"
        className="w-full rounded-lg px-4 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500 pr-10"
        style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--psg-muted)" }}>⌕</span>

      {open && hasResults && (
        <div className="absolute top-full mt-1 w-full rounded-lg border shadow-2xl z-50 overflow-hidden"
          style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          {matchedProds.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Productions</div>
              {matchedProds.map(p => (
                <Link key={p.id} href={`/productions/${p.id}`} onClick={() => { setQ(""); setOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors">
                  <span className="text-base">🎭</span>
                  <span className="text-sm text-white">{p.name}</span>
                  {p.announcementStatus && p.announcementStatus !== "not_announced" && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ml-auto ${ANN_COLORS[p.announcementStatus]}`}>{ANN_LABELS[p.announcementStatus]}</span>
                  )}
                </Link>
              ))}
            </>
          )}
          {matchedTasks.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-t" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)" }}>Tasks</div>
              {matchedTasks.map(t => (
                <Link key={t.id} href="/tasks" onClick={() => { setQ(""); setOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors">
                  <span className="text-base">✅</span>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{t.title}</div>
                    {t.production && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{t.production.name}</div>}
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: session } = useSession();
  const role: string = (session?.user as any)?.role ?? "member";
  const perms = parsePerms((session?.user as any)?.permissions ?? null);

  const [productions, setProductions] = useState<Production[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [news, setNews] = useState<string | null>(null);
  const [newsDismissed, setNewsDismissed] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<{ id: number; status: string; netAmount: number; vatAmount: number }[]>([]);
  const [salesBrands, setSalesBrands] = useState<SalesBrand[]>([]);
  const [salesTasksCount, setSalesTasksCount] = useState(0);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);

  const userId = Number((session?.user as any)?.id);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/tasks?assigneeId=${userId}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setTasks(d); });
    if (role === "admin") {
      fetch("/api/tasks").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllTasks(d); });
    }
    fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setProductions(d); });
    fetch("/api/property").then(r => r.json()).then(d => { if (d?.maintenance) setMaintenance(d.maintenance); });
    fetch("/api/quicklinks").then(r => r.json()).then(d => { if (Array.isArray(d)) setQuickLinks(d); });
    fetch("/api/settings").then(r => r.json()).then(d => { if (d?.news) setNews(d.news); });
    fetch("/api/opportunities").then(r => r.json()).then(d => { if (Array.isArray(d)) setOpportunities(d); });
    fetch("/api/invoices").then(r => r.json()).then(d => { if (Array.isArray(d)) setInvoices(d); });
    fetch("/api/expenses").then(r => r.json()).then(d => { if (Array.isArray(d)) setExpenses(d); });
    fetch("/api/sales/brands").then(r => r.json()).then(d => { if (Array.isArray(d)) setSalesBrands(d); });
    fetch("/api/sales/tasks").then(r => r.json()).then(d => { if (Array.isArray(d)) setSalesTasksCount(d.filter((t: { completedAt: string | null }) => !t.completedAt).length); });
    fetch("/api/calendar").then(r => r.json()).then(d => { if (Array.isArray(d)) setCalEvents(d); });
    try { if (localStorage.getItem("news-dismissed") === "true") setNewsDismissed(true); } catch {}
  }, [userId, role]);

  // Computed
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const activeProd = productions.filter(p => p.status !== "closed");
  const activeTasks = showAllTasks ? allTasks : tasks;
  const overdueTasks = activeTasks.filter(t => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now);
  const dueSoonTasks = activeTasks.filter(t => t.status !== "done" && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= weekFromNow);
  const urgentMaint = maintenance.filter(m => m.priority === "urgent" && m.status !== "resolved");
  const openMaint = maintenance.filter(m => m.status !== "resolved");
  const overdueInvoices = invoices.filter(i => i.status !== "paid" && i.dueDate && new Date(i.dueDate) < now);
  const unpaidSales = invoices.filter(i => i.type === "sales" && i.status !== "paid");
  const unpaidPurchases = invoices.filter(i => i.type === "purchase" && i.status !== "paid");
  const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

  // Upcoming key dates + tour stops in next 60 days
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const upcoming = calEvents
    .filter(ev => (ev.type === "key_date" || ev.type === "tour_stop") && ev.startDate && new Date(ev.startDate) >= now && new Date(ev.startDate) <= in60Days)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 8);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  const waitingCount = overdueTasks.length + dueSoonTasks.length + urgentMaint.length;

  return (
    <div className="max-w-6xl space-y-0">

      {/* News banner */}
      {news && !newsDismissed && (
        <div className="-mx-6 -mt-8 mb-6 px-6 py-3 flex items-center gap-3"
          style={{ backgroundColor: "#b45309", color: "#fef3c7" }}>
          <span className="text-xs font-bold tracking-widest uppercase shrink-0">News</span>
          <span className="text-sm flex-1 truncate">{news}</span>
          <button onClick={() => {
            setNewsDismissed(true);
            try { localStorage.setItem("news-dismissed", "true"); } catch {}
          }} className="shrink-0 text-amber-200 hover:text-white text-lg leading-none">×</button>
        </div>
      )}

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">{greeting.toUpperCase()}{firstName ? `, ${firstName.toUpperCase()}` : ""}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--psg-muted)" }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Top two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: Waiting on you + Search */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader
              title={showAllTasks ? "Waiting on the team" : "Waiting on you"}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--psg-blue)", color: "white" }}>{waitingCount} in all</span>
                  {role === "admin" && (
                    <button
                      onClick={() => setShowAllTasks(v => !v)}
                      className="text-xs px-2 py-0.5 rounded border transition-colors"
                      style={{ borderColor: "var(--psg-card-border)", color: showAllTasks ? "white" : "var(--psg-muted)", backgroundColor: showAllTasks ? "rgba(255,255,255,0.1)" : "transparent" }}
                    >
                      {showAllTasks ? "My tasks" : "All tasks"}
                    </button>
                  )}
                </div>
              }
            />
            {overdueTasks.length > 0 && (
              <WaitingRow count={overdueTasks.length} label="Late tasks" sub={showAllTasks ? "Past their due date across the team" : "Past their due date in Tasks"} href="/tasks" alert />
            )}
            {dueSoonTasks.length > 0 && (
              <WaitingRow count={dueSoonTasks.length} label="Tasks due this week" sub="Not late yet, due in the next 7 days" href="/tasks" />
            )}
            {urgentMaint.length > 0 && (
              <WaitingRow count={urgentMaint.length} label="Urgent maintenance" sub="Open urgent issues at Cockshute" href="/property?tab=Maintenance" alert />
            )}
            {waitingCount === 0 && (
              <div className="text-sm py-2" style={{ color: "var(--psg-muted)" }}>{showAllTasks ? "Nothing waiting on the team right now." : "Nothing waiting on you right now."}</div>
            )}
          </Card>

          {/* Search */}
          <QuickSearch productions={productions} tasks={tasks} />
        </div>

        {/* Right: Upcoming + Quick links */}
        <div className="lg:col-span-2 space-y-4">

          {/* Upcoming key dates */}
          <Card>
            <CardHeader title="Upcoming" action={
              <Link href="/calendar" className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-blue)" }}>Calendar</Link>
            } />
            {upcoming.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--psg-muted)" }}>No upcoming events in the next 60 days.</div>
            ) : (
              <div className="space-y-0">
                {upcoming.map(ev => (
                  <Link key={ev.id} href={ev.href ?? "/calendar"}
                    className="flex items-center gap-3 py-2 border-b last:border-0 hover:bg-white/5 -mx-5 px-5 transition-colors group"
                    style={{ borderColor: "var(--psg-card-border)" }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate group-hover:text-blue-300 transition-colors">{ev.title}</div>
                    </div>
                    <div className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }}>{fmtDate(ev.startDate)}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Quick links */}
          {quickLinks.length > 0 && (
            <Card>
              <CardHeader title="Quick links" />
              <div className="flex flex-wrap gap-2">
                {quickLinks.map(l => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:border-blue-500/40 hover:bg-white/10 transition-all"
                    style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                    <span>{l.icon}</span>
                    <span className="text-white">{l.label}</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Tile grid with section headings */}
      {/* ME */}
      <SectionHeading title="Me" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactTile href="/tasks" icon="✅" title="My Tasks"
          sub={`${tasks.filter(t => t.status !== "done" && t.assigneeUserId === Number((session?.user as any)?.id)).length} open`}
          badge={overdueTasks.filter(t => t.assigneeUserId === Number((session?.user as any)?.id)).length || undefined} />
        <CompactTile href="/productions" icon="🎭" title="My Productions" sub="Productions I'm on" />
      </div>

      {(canAccess(perms, "productions", role) || canAccess(perms, "venues", role)) && (
        <>
          <SectionHeading title="Production Management" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {canAccess(perms, "productions", role) && (
              <>
                <CompactTile href="/productions" icon="🎭" title="All Productions" sub={`${activeProd.length} active`} />
                <CompactTile href="/productions/new" icon="＋" title="New Production" sub="Create a production" />
              </>
            )}
            {canAccess(perms, "venues", role) && (
              <CompactTile href="/venues" icon="🏛️" title="Venues" sub="Venue directory" />
            )}
            {canAccess(perms, "productions", role) && (
              <CompactTile href="/calendar" icon="📅" title="Calendar" sub="Key dates across all productions" />
            )}
          </div>
        </>
      )}

      {canAccess(perms, "bd", role) && (
        <>
          <SectionHeading title="Business Dev" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CompactTile href="/bd" icon="📈" title="Pipeline"
              sub={(() => { const active = opportunities.filter(o => !["won","lost"].includes(o.stage)).length; return active > 0 ? `${active} active opportunit${active !== 1 ? "ies" : "y"}` : "No active opportunities"; })()} />
          </div>
        </>
      )}

      {canAccess(perms, "sales", role) && (
        <>
          <SectionHeading title="Sales" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CompactTile href="/sales" icon="💡" title="Brands"
              sub={(() => {
                const active = salesBrands.filter(b => !["lost","paused"].includes(b.stage)).length;
                return active > 0 ? `${active} active brand${active !== 1 ? "s" : ""}` : "No active brands";
              })()} />
            <CompactTile href="/sales?tab=tasks" icon="📋" title="Sales Tasks"
              sub={salesTasksCount > 0 ? `${salesTasksCount} open task${salesTasksCount !== 1 ? "s" : ""}` : "All done"}
              badge={salesTasksCount || undefined} />
          </div>
        </>
      )}

      {canAccess(perms, "finance", role) && (
        <>
          <SectionHeading title="Finance" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CompactTile href="/finance" icon="🧾" title="Sales Invoices"
              sub={unpaidSales.length > 0 ? `${unpaidSales.length} unpaid · ${fmt(unpaidSales.reduce((s, i) => s + i.netAmount + i.vatAmount, 0))}` : "All paid up"}
              badge={overdueInvoices.filter(i => i.type === "sales").length || undefined} />
            <CompactTile href="/finance?tab=purchase" icon="💸" title="Purchase Invoices"
              sub={unpaidPurchases.length > 0 ? `${unpaidPurchases.length} to pay · ${fmt(unpaidPurchases.reduce((s, i) => s + i.netAmount + i.vatAmount, 0))}` : "Nothing outstanding"}
              badge={overdueInvoices.filter(i => i.type === "purchase").length || undefined} />
            <CompactTile href="/finance?tab=expenses" icon="🗂️" title="Expenses"
              sub={(() => { const unpaid = expenses.filter(e => e.status !== "paid"); return unpaid.length > 0 ? `${unpaid.length} pending · ${fmt(unpaid.reduce((s, e) => s + e.netAmount + e.vatAmount, 0))}` : "Nothing pending"; })()} />
          </div>
        </>
      )}

      {(canAccess(perms, "tasks", role) || canAccess(perms, "property", role)) && (
        <>
          <SectionHeading title="Operations" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {canAccess(perms, "tasks", role) && (
              <CompactTile href="/tasks" icon="✅" title="Tasks"
                sub={`${tasks.filter(t => t.status !== "done").length} assigned to you`}
                badge={tasks.filter(t => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length || undefined} />
            )}
            {canAccess(perms, "property", role) && (
              <CompactTile href="/property" icon="🏭" title="Cockshute Industrial Estate"
                sub={openMaint.length > 0 ? `${openMaint.length} open issue${openMaint.length !== 1 ? "s" : ""}` : "No open issues"}
                badge={urgentMaint.length || undefined} />
            )}
            <CompactTile href="/suppliers" icon="📦" title="Supplier Register" sub="Contractors, venues & services" />
          </div>
        </>
      )}

      <SectionHeading title="Marketing" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactTile href="/marketing" icon="📣" title="Content Calendar" sub="Schedule & plan social media posts" />
        <CompactTile href="/marketing?view=list" icon="📋" title="Post List" sub="All posts across platforms" />
      </div>

      <SectionHeading title="Hub" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactTile href="/roadmap" icon="💡" title="Ideas & Roadmap" sub="Feature requests & improvements" />
        <CompactTile href="/helpdesk" icon="🎫" title="Help Desk" sub="Report an issue or request help" />
        <CompactTile href="/ask" icon="🤖" title="Ask Me Anything" sub="Questions answered from company docs" />
        <CompactTile href="/fun" icon="🎭" title="Fun Corner" sub="This is not a place of entertainment" />
      </div>

      {role === "admin" && (
        <>
          <SectionHeading title="Admin" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CompactTile href="/director" icon="📊" title="Director Dashboard" sub="Finance, pipeline & operations overview" />
            <CompactTile href="/admin/users" icon="👥" title="Users" sub="Access & permissions" />
            <CompactTile href="/admin/settings" icon="⚙️" title="Hub Settings" sub="News banner, quick links" />
          </div>
        </>
      )}

      <div className="h-8" />
    </div>
  );
}
