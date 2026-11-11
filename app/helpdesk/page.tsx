"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Ticket = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  createdByUser: { id: number; name: string } | null;
  assignedToUser: { id: number; name: string } | null;
};

const CATEGORIES = ["bug", "feature", "question", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  resolved: "#10b981",
  closed: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

const CAT_LABELS: Record<string, string> = {
  bug: "🐛 Bug",
  feature: "✨ Feature",
  question: "❓ Question",
  other: "📝 Other",
};

function badge(text: string, color: string) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ backgroundColor: color + "22", color }}>
      {text.replace("_", " ")}
    </span>
  );
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const inp = "w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)" };

const BLANK = { title: "", description: "", category: "bug", priority: "medium" };

export default function HelpDeskPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showAll, setShowAll] = useState(role === "admin");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function load(all: boolean) {
    const r = await fetch(`/api/help-tickets${all ? "?all=1" : ""}`);
    const d = await r.json();
    if (Array.isArray(d)) setTickets(d);
  }

  useEffect(() => { load(showAll); }, [showAll]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    await fetch("/api/help-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm(BLANK);
    setShowForm(false);
    setSubmitting(false);
    load(showAll);
  }

  async function updateTicket(id: number, patch: Record<string, unknown>) {
    await fetch(`/api/help-tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load(showAll);
  }

  async function deleteTicket(id: number) {
    if (!confirm("Delete this ticket?")) return;
    await fetch(`/api/help-tickets/${id}`, { method: "DELETE" });
    load(showAll);
  }

  const filtered = filterStatus === "all" ? tickets : tickets.filter(t => t.status === filterStatus);
  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Help Desk</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {showAll ? `${openCount} open ticket${openCount !== 1 ? "s" : ""} across the team` : "Report an issue or request a feature"}
          </p>
        </div>
        <div className="flex gap-2">
          {role === "admin" && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-sm px-3 py-1.5 rounded border transition-colors"
              style={{ borderColor: "var(--psg-card-border)", color: showAll ? "white" : "var(--psg-muted)", backgroundColor: showAll ? "rgba(255,255,255,0.1)" : "transparent" }}
            >
              {showAll ? "My tickets" : "All tickets"}
            </button>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-sm px-4 py-1.5 rounded text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--psg-blue)" }}
          >
            + New Ticket
          </button>
        </div>
      </div>

      {/* New ticket form */}
      {showForm && (
        <form onSubmit={submit} className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <h2 className="text-sm font-semibold text-white">New Ticket</h2>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Title *</label>
            <input required className={inp} style={inpStyle} placeholder="Brief summary of the issue or request" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Description</label>
            <textarea rows={4} className={inp} style={inpStyle} placeholder="Steps to reproduce, expected behaviour, screenshots…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Category</label>
              <select className={inp} style={inpStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Priority</label>
              <select className={inp} style={inpStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded text-sm text-white font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>
              {submitting ? "Submitting…" : "Submit Ticket"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }} className="px-4 py-2 rounded text-sm border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg overflow-hidden border w-fit text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
        {["all", ...STATUSES].map(s => {
          const count = s === "all" ? tickets.length : tickets.filter(t => t.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 capitalize transition-colors flex items-center gap-1.5"
              style={filterStatus === s ? { backgroundColor: "var(--psg-blue)", color: "#fff" } : { backgroundColor: "transparent", color: "var(--psg-muted)" }}>
              {s.replace("_", " ")}
              {count > 0 && <span className="text-xs rounded-full px-1.5" style={{ backgroundColor: filterStatus === s ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <div className="text-sm py-10 text-center" style={{ color: "var(--psg-muted)" }}>
          {filterStatus === "all" ? "No tickets yet — submit one above." : `No ${filterStatus.replace("_", " ")} tickets.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <div key={ticket.id} className="rounded-xl border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono" style={{ color: "var(--psg-muted)" }}>#{ticket.id}</span>
                    {badge(ticket.status, STATUS_COLORS[ticket.status] ?? "#6b7280")}
                    {badge(ticket.priority, PRIORITY_COLORS[ticket.priority] ?? "#6b7280")}
                    <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{CAT_LABELS[ticket.category]}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{ticket.title}</p>
                  {ticket.description && (
                    <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{ticket.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: "var(--psg-muted)" }}>
                    <span>Submitted {fmtDate(ticket.createdAt)}</span>
                    {showAll && ticket.createdByUser && <span>by {ticket.createdByUser.name}</span>}
                    {ticket.resolvedAt && <span>· Resolved {fmtDate(ticket.resolvedAt)}</span>}
                  </div>
                </div>

                {/* Admin controls */}
                {role === "admin" && (
                  <div className="flex flex-col gap-2 shrink-0 min-w-32">
                    <select
                      value={ticket.status}
                      onChange={e => updateTicket(ticket.id, { status: e.target.value })}
                      className="text-xs rounded px-2 py-1 border"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)", color: STATUS_COLORS[ticket.status] ?? "white" }}
                    >
                      {STATUSES.map(s => <option key={s} value={s} className="text-white capitalize">{s.replace("_", " ")}</option>)}
                    </select>
                    <select
                      value={ticket.priority}
                      onChange={e => updateTicket(ticket.id, { priority: e.target.value })}
                      className="text-xs rounded px-2 py-1 border"
                      style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)", color: PRIORITY_COLORS[ticket.priority] ?? "white" }}
                    >
                      {PRIORITIES.map(p => <option key={p} value={p} className="text-white capitalize">{p}</option>)}
                    </select>
                    <button onClick={() => deleteTicket(ticket.id)} className="text-xs text-red-400 hover:text-red-300 text-left transition-colors">Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
