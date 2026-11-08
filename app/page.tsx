"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type Production = {
  id: number; name: string; type: string; venue: string | null;
  startDate: string | null; endDate: string | null; status: string;
  _count: { events: number; budgetLines: number; crew: number };
  budgetLines: { budgeted: number; expenses: { estimated: number; committed: number; spent: number }[] }[];
};

type Opportunity = {
  id: number; title: string; type: string; stage: string;
  value: number | null; client: { name: string } | null;
  closeDate: string | null; tasks: { id: number; completedAt: string | null; dueDate: string | null }[];
};

type CrewMember = { id: number; name: string; discipline: string; insuranceExpiry: string | null };
type Event = { id: number; title: string; startAt: string; location: string | null; production: { name: string } };

const STAGES = ["lead","qualified","proposal","negotiating","won","lost"];
const STAGE_COLORS: Record<string, string> = {
  lead: "#6b7280", qualified: "#3b82f6", proposal: "#8b5cf6",
  negotiating: "#f59e0b", won: "#10b981", lost: "#ef4444",
};
const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

// ── Widget registry ───────────────────────────────────────────────────────────

const ALL_WIDGETS = [
  { id: "productions",    label: "Active Productions",    description: "Live productions with budget health" },
  { id: "bd_pipeline",   label: "BD Pipeline",           description: "Opportunities by stage" },
  { id: "bd_tasks",      label: "Follow-up Tasks",       description: "Open BD tasks due soon" },
  { id: "budget_alerts", label: "Budget Alerts",         description: "Productions approaching or over budget" },
  { id: "upcoming",      label: "Upcoming Schedule",     description: "Next events across all productions" },
  { id: "crew",          label: "Crew Overview",         description: "Total crew and insurance alerts" },
];

const DEFAULT_WIDGETS = ["productions", "bd_pipeline", "bd_tasks", "budget_alerts"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function isOverdue(s: string | null) {
  return !!s && new Date(s) < new Date();
}
function calcBudget(p: Production) {
  const budgeted = p.budgetLines.reduce((s, l) => s + l.budgeted, 0);
  const spent = p.budgetLines.reduce((s, l) => l.expenses.reduce((e, x) => e + x.spent, 0) + s, 0);
  return { budgeted, spent, pct: budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0 };
}

// ── Widget components ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-5 ${className}`} style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      {children}
    </div>
  );
}

function WidgetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--psg-muted)" }}>{children}</h2>;
}

function ProductionsWidget({ productions }: { productions: Production[] }) {
  const active = productions.filter(p => p.status !== "closed");
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <WidgetTitle>Active Productions</WidgetTitle>
        <Link href="/productions" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
      </div>
      {active.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No active productions. <Link href="/productions/new" className="text-blue-400">Create one →</Link></p>
      ) : (
        <div className="space-y-3">
          {active.slice(0, 5).map(p => {
            const { budgeted, spent, pct } = calcBudget(p);
            return (
              <Link key={p.id} href={`/productions/${p.id}`} className="block hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-white truncate">{p.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? "bg-white/10 text-white/50"}`}>{p.status}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "var(--psg-muted)" }}>{fmt(spent)} / {fmt(budgeted)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <div className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function BDPipelineWidget({ opps }: { opps: Opportunity[] }) {
  const active = opps.filter(o => o.stage !== "won" && o.stage !== "lost");
  const pipelineValue = active.reduce((s, o) => s + (o.value ?? 0), 0);
  const wonValue = opps.filter(o => o.stage === "won").reduce((s, o) => s + (o.value ?? 0), 0);
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <WidgetTitle>BD Pipeline</WidgetTitle>
        <Link href="/bd" className="text-xs text-blue-400 hover:text-blue-300">Open →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Pipeline</div>
          <div className="text-lg font-bold text-white">{fmt(pipelineValue)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{active.length} opportunities</div>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Won</div>
          <div className="text-lg font-bold text-green-400">{fmt(wonValue)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{opps.filter(o => o.stage === "won").length} deals</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {STAGES.filter(s => s !== "lost").map(stage => {
          const count = opps.filter(o => o.stage === stage).length;
          const val = opps.filter(o => o.stage === stage).reduce((s, o) => s + (o.value ?? 0), 0);
          if (count === 0) return null;
          return (
            <div key={stage} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                <span className="capitalize" style={{ color: "var(--psg-muted)" }}>{stage}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{count}</span>
                {val > 0 && <span className="text-xs font-medium text-white">{fmt(val)}</span>}
              </div>
            </div>
          );
        })}
        {active.length === 0 && <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No active opportunities. <Link href="/bd" className="text-blue-400">Add one →</Link></p>}
      </div>
    </Card>
  );
}

function BDTasksWidget({ opps }: { opps: Opportunity[] }) {
  const tasks = opps.flatMap(o =>
    o.tasks.filter(t => !t.completedAt).map(t => ({ ...t, oppTitle: o.title, oppId: o.id }))
  ).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  }).slice(0, 8);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <WidgetTitle>Follow-up Tasks</WidgetTitle>
        <Link href="/bd" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No open tasks.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <Link key={t.id} href="/bd" className="flex items-start gap-3 group">
              <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{t.oppTitle}</div>
                <div className="text-xs" style={{ color: isOverdue(t.dueDate) ? "#ef4444" : "var(--psg-muted)" }}>
                  {t.dueDate ? (isOverdue(t.dueDate) ? `Overdue · ${fmtDate(t.dueDate)}` : fmtDate(t.dueDate)) : "No due date"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function BudgetAlertsWidget({ productions }: { productions: Production[] }) {
  const alerts = productions
    .filter(p => p.status !== "closed")
    .map(p => ({ ...p, ...calcBudget(p) }))
    .filter(p => p.pct >= 70)
    .sort((a, b) => b.pct - a.pct);

  return (
    <Card>
      <WidgetTitle>Budget Alerts</WidgetTitle>
      {alerts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>All productions within budget.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map(p => (
            <Link key={p.id} href={`/productions/${p.id}`} className="block hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white truncate">{p.name}</span>
                <span className={`text-xs font-bold ml-2 shrink-0 ${p.pct >= 100 ? "text-red-400" : p.pct >= 90 ? "text-orange-400" : "text-yellow-400"}`}>{Math.round(p.pct)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <div className={`h-full rounded-full ${p.pct >= 100 ? "bg-red-500" : p.pct >= 90 ? "bg-orange-400" : "bg-yellow-400"}`} style={{ width: `${Math.min(p.pct, 100)}%` }} />
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{fmt(p.spent)} of {fmt(p.budgeted)}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function UpcomingWidget({ events }: { events: Event[] }) {
  const upcoming = events
    .filter(e => new Date(e.startAt) >= new Date())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 6);

  return (
    <Card>
      <WidgetTitle>Upcoming Schedule</WidgetTitle>
      {upcoming.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No upcoming events.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map(e => (
            <div key={e.id} className="flex items-start gap-3">
              <div className="rounded px-2 py-1 text-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.06)", minWidth: 44 }}>
                <div className="text-xs font-bold text-white">{new Date(e.startAt).toLocaleDateString("en-GB", { day: "numeric" })}</div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{new Date(e.startAt).toLocaleDateString("en-GB", { month: "short" })}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{e.title}</div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{e.production.name}{e.location ? ` · ${e.location}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CrewWidget({ crew }: { crew: CrewMember[] }) {
  const soon = crew.filter(c => {
    if (!c.insuranceExpiry) return false;
    const d = new Date(c.insuranceExpiry);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 60;
  }).sort((a, b) => new Date(a.insuranceExpiry!).getTime() - new Date(b.insuranceExpiry!).getTime());

  const disciplines = Array.from(new Set(crew.map(c => c.discipline)));

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <WidgetTitle>Crew Overview</WidgetTitle>
        <Link href="/crew" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
      </div>
      <div className="flex gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-white">{crew.length}</div>
          <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Total crew</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{disciplines.length}</div>
          <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Disciplines</div>
        </div>
      </div>
      {soon.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: "#f59e0b" }}>Insurance expiring soon</div>
          <div className="space-y-1">
            {soon.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--psg-muted)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: isOverdue(c.insuranceExpiry) ? "#ef4444" : "#f59e0b" }}>{fmtDate(c.insuranceExpiry)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {soon.length === 0 && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>All insurance up to date.</p>}
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [widgets, setWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [editing, setEditing] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const [p, o, c] = await Promise.all([
      fetch("/api/productions").then(r => r.json()),
      fetch("/api/opportunities").then(r => r.json()),
      fetch("/api/crew").then(r => r.json()),
    ]);
    if (Array.isArray(p)) setProductions(p);
    if (Array.isArray(o)) setOpps(o);
    if (Array.isArray(c)) setCrew(c);
    // Flatten events from productions
    if (Array.isArray(p)) {
      const allEvents = p.flatMap((prod: any) =>
        (prod.events ?? []).map((e: any) => ({ ...e, production: { name: prod.name } }))
      );
      setEvents(allEvents);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetch("/api/me/preferences").then(r => r.json()).then(prefs => {
      if (prefs?.widgets && Array.isArray(prefs.widgets)) setWidgets(prefs.widgets);
      setPrefsLoaded(true);
    }).catch(() => setPrefsLoaded(true));
  }, [loadData]);

  async function saveWidgets(w: string[]) {
    setWidgets(w);
    await fetch("/api/me/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ widgets: w }) });
  }

  function toggleWidget(id: string) {
    const next = widgets.includes(id) ? widgets.filter(w => w !== id) : [...widgets, id];
    saveWidgets(next);
  }

  function moveWidget(id: string, dir: -1 | 1) {
    const idx = widgets.indexOf(id);
    if (idx < 0) return;
    const next = [...widgets];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    saveWidgets(next);
  }

  const active = productions.filter(p => p.status !== "closed");
  const pipelineValue = opps.filter(o => o.stage !== "won" && o.stage !== "lost").reduce((s, o) => s + (o.value ?? 0), 0);
  const openTasks = opps.flatMap(o => o.tasks.filter(t => !t.completedAt)).length;

  function renderWidget(id: string) {
    switch (id) {
      case "productions":    return <ProductionsWidget key={id} productions={productions} />;
      case "bd_pipeline":    return <BDPipelineWidget key={id} opps={opps} />;
      case "bd_tasks":       return <BDTasksWidget key={id} opps={opps} />;
      case "budget_alerts":  return <BudgetAlertsWidget key={id} productions={productions} />;
      case "upcoming":       return <UpcomingWidget key={id} events={events} />;
      case "crew":           return <CrewWidget key={id} crew={crew} />;
      default: return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">PSG Hub</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(e => !e)}
            className="border px-3 py-2 rounded text-sm transition-colors hover:bg-white/5"
            style={{ borderColor: editing ? "var(--psg-blue)" : "var(--psg-card-border)", color: editing ? "white" : "var(--psg-muted)" }}
          >
            {editing ? "Done" : "Edit Dashboard"}
          </button>
          <Link href="/productions/new" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + New Production
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active productions", value: active.length, unit: "" },
          { label: "Pipeline value", value: fmt(pipelineValue), unit: "" },
          { label: "Won this year", value: fmt(opps.filter(o => o.stage === "won").reduce((s, o) => s + (o.value ?? 0), 0)), unit: "" },
          { label: "Open BD tasks", value: openTasks, unit: "" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{label}</div>
            <div className="text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <h2 className="text-sm font-semibold text-white mb-1">Customise your dashboard</h2>
          <p className="text-xs mb-4" style={{ color: "var(--psg-muted)" }}>Choose which widgets appear and reorder them. Each team member has their own layout.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_WIDGETS.map(w => {
              const active = widgets.includes(w.id);
              const idx = widgets.indexOf(w.id);
              return (
                <div key={w.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors" style={{ borderColor: active ? "rgba(37,99,235,0.5)" : "var(--psg-card-border)", backgroundColor: active ? "rgba(37,99,235,0.08)" : "transparent" }}>
                  <button onClick={() => toggleWidget(w.id)} className="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors" style={{ borderColor: active ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: active ? "var(--psg-blue)" : "transparent" }}>
                    {active && <span className="text-white text-xs">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{w.label}</div>
                    <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{w.description}</div>
                  </div>
                  {active && (
                    <div className="flex gap-1">
                      <button onClick={() => moveWidget(w.id, -1)} disabled={idx === 0} className="text-xs px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors" style={{ color: "var(--psg-muted)" }}>↑</button>
                      <button onClick={() => moveWidget(w.id, 1)} disabled={idx === widgets.length - 1} className="text-xs px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors" style={{ color: "var(--psg-muted)" }}>↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget grid */}
      {prefsLoaded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {widgets.map(id => renderWidget(id))}
        </div>
      )}
    </div>
  );
}
