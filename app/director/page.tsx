"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";

type Production = { id: number; name: string; status: string; startDate: string | null; endDate: string | null; announcementStatus?: string; budgetLines?: { estimated: number; committed: number; spent: number }[] };
type Invoice = { id: number; type: string; status: string; netAmount: number; vatAmount: number; dueDate: string | null; issuedDate: string | null };
type Opportunity = { id: number; name: string; stage: string; value: number | null };
type Task = { id: number; title: string; status: string; dueDate: string | null; assigneeUser?: { name: string; avatarUrl?: string | null } | null; production?: { name: string } | null };
type HelpTicket = { id: number; status: string; priority: string; title: string };
type Expense = { id: number; status: string; netAmount: number; vatAmount: number };

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--psg-muted)" }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: color ?? "white" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-white/60">{title}</h2>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--psg-card-border)" }} />
      {href && <Link href={href} className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-blue)" }}>View all →</Link>}
    </div>
  );
}

const STAGE_ORDER = ["prospecting", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const ANN_COLORS: Record<string, string> = {
  not_announced: "bg-gray-800 text-gray-400",
  nda: "bg-purple-900/60 text-purple-300",
  on_sale: "bg-green-900/60 text-green-300",
  open: "bg-blue-900/60 text-blue-300",
};
const ANN_LABELS: Record<string, string> = {
  not_announced: "Not announced", nda: "NDA", on_sale: "On Sale", open: "Open",
};

export default function DirectorPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const router = useRouter();

  const [productions, setProductions] = useState<Production[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (role !== "admin") { router.replace("/"); return; }
    fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setProductions(d); });
    fetch("/api/invoices").then(r => r.json()).then(d => { if (Array.isArray(d)) setInvoices(d); });
    fetch("/api/opportunities").then(r => r.json()).then(d => { if (Array.isArray(d)) setOpportunities(d); });
    fetch("/api/tasks").then(r => r.json()).then(d => { if (Array.isArray(d)) setTasks(d); });
    fetch("/api/help-tickets").then(r => r.json()).then(d => { if (Array.isArray(d)) setTickets(d); });
    fetch("/api/expenses").then(r => r.json()).then(d => { if (Array.isArray(d)) setExpenses(d); });
  }, [role, router]);

  const now = new Date();

  // Finance metrics
  const salesInvoices = invoices.filter(i => i.type === "sales");
  const purchaseInvoices = invoices.filter(i => i.type === "purchase");
  const totalSalesValue = salesInvoices.reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const paidSales = salesInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const unpaidSalesValue = salesInvoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const overdueSales = salesInvoices.filter(i => i.status !== "paid" && i.dueDate && new Date(i.dueDate) < now);
  const unpaidPurchasesValue = purchaseInvoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.netAmount + i.vatAmount, 0);
  const pendingExpenses = expenses.filter(e => e.status !== "paid");
  const pendingExpensesValue = pendingExpenses.reduce((s, e) => s + e.netAmount + e.vatAmount, 0);

  // Productions
  const activeProds = productions.filter(p => p.status !== "closed");
  const closedProds = productions.filter(p => p.status === "closed");

  // BD pipeline
  const activeOpps = opportunities.filter(o => !["won", "lost"].includes(o.stage));
  const pipelineValue = activeOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const byStage = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = opportunities.filter(o => o.stage === s);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  // Tasks
  const openTasks = tasks.filter(t => t.status !== "done");
  const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

  // Help desk
  const openTickets = tickets.filter(t => !["resolved", "closed"].includes(t.status));
  const urgentTickets = openTickets.filter(t => t.priority === "urgent");

  if (role !== "admin") return null;

  return (
    <div className="max-w-7xl space-y-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Director Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Finance KPIs */}
      <SectionHeader title="Finance" href="/finance" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sales Raised" value={fmt(totalSalesValue)} sub={`${salesInvoices.length} invoice${salesInvoices.length !== 1 ? "s" : ""}`} />
        <StatCard label="Sales Collected" value={fmt(paidSales)} sub={`${salesInvoices.filter(i => i.status === "paid").length} paid`} color="#34d399" />
        <StatCard label="Outstanding Sales" value={fmt(unpaidSalesValue)} sub={overdueSales.length > 0 ? `${overdueSales.length} overdue` : "None overdue"} color={overdueSales.length > 0 ? "#f87171" : undefined} />
        <StatCard label="Purchases to Pay" value={fmt(unpaidPurchasesValue)} sub={`${purchaseInvoices.filter(i => i.status !== "paid").length} invoices`} />
      </div>

      {/* Overdue sales invoices */}
      {overdueSales.length > 0 && (
        <>
          <SectionHeader title="Overdue Sales Invoices" href="/finance" />
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                  {["Reference", "Amount", "Due", "Days overdue"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueSales.map(i => {
                  const days = Math.floor((now.getTime() - new Date(i.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-3 text-white">INV-{String(i.id).padStart(4, "0")}</td>
                      <td className="px-4 py-3 text-white">{fmt(i.netAmount + i.vatAmount)}</td>
                      <td className="px-4 py-3 text-red-400">{fmtDate(i.dueDate)}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">{days}d</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Productions */}
      <SectionHeader title="Productions" href="/productions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active" value={String(activeProds.length)} sub="In production" />
        <StatCard label="Total" value={String(productions.length)} sub={`${closedProds.length} closed`} />
        <StatCard label="Open Tasks" value={String(openTasks.length)} sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "None overdue"} color={overdueTasks.length > 0 ? "#f87171" : undefined} />
        <StatCard label="Expenses Pending" value={fmt(pendingExpensesValue)} sub={`${pendingExpenses.length} to approve`} color={pendingExpenses.length > 0 ? "#fbbf24" : undefined} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              {["Production", "Status", "Announcement", "Start", "End"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeProds.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No active productions.</td></tr>
            ) : activeProds.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-white/5 cursor-pointer" style={{ borderColor: "var(--psg-card-border)" }} onClick={() => router.push(`/productions/${p.id}`)}>
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 capitalize">{p.status}</span></td>
                <td className="px-4 py-3">
                  {p.announcementStatus && p.announcementStatus !== "not_announced" ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ANN_COLORS[p.announcementStatus]}`}>{ANN_LABELS[p.announcementStatus]}</span>
                  ) : <span style={{ color: "var(--psg-muted)" }}>—</span>}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{fmtDate(p.startDate)}</td>
                <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{fmtDate(p.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* BD Pipeline */}
      <SectionHeader title="Business Dev Pipeline" href="/bd" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Opportunities" value={String(activeOpps.length)} sub="In pipeline" />
        <StatCard label="Pipeline Value" value={fmt(pipelineValue)} sub="Estimated total" />
        <StatCard label="Won" value={String(byStage.won?.length ?? 0)} sub={fmt(byStage.won?.reduce((s, o) => s + (o.value ?? 0), 0) ?? 0)} color="#34d399" />
        <StatCard label="Lost" value={String(byStage.lost?.length ?? 0)} sub="This period" color="#f87171" />
      </div>

      {activeOpps.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                {["Opportunity", "Stage", "Value"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeOpps.map(o => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-white/5 cursor-pointer" style={{ borderColor: "var(--psg-card-border)" }} onClick={() => router.push("/bd")}>
                  <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300">{STAGE_LABELS[o.stage] ?? o.stage}</span></td>
                  <td className="px-4 py-3 text-white">{o.value ? fmt(o.value) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help Desk */}
      {(openTickets.length > 0 || urgentTickets.length > 0) && (
        <>
          <SectionHeader title="Help Desk" href="/helpdesk" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Open Tickets" value={String(openTickets.length)} />
            <StatCard label="Urgent" value={String(urgentTickets.length)} color={urgentTickets.length > 0 ? "#f87171" : undefined} />
            <StatCard label="Total Raised" value={String(tickets.length)} sub="All time" />
          </div>
        </>
      )}

      {/* Overdue tasks summary */}
      {overdueTasks.length > 0 && (
        <>
          <SectionHeader title="Overdue Tasks" href="/tasks" />
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                  {["Task", "Production", "Assigned to", "Due"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueTasks.slice(0, 10).map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3 text-white">{t.title}</td>
                    <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{t.production?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {t.assigneeUser ? (
                        <span className="flex items-center gap-1.5" style={{ color: "var(--psg-muted)" }}>
                          <UserAvatar name={t.assigneeUser.name} avatarUrl={t.assigneeUser.avatarUrl} size={20} />
                          {t.assigneeUser.name}
                        </span>
                      ) : <span style={{ color: "var(--psg-muted)" }}>Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-red-400">{fmtDate(t.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="h-8" />
    </div>
  );
}
