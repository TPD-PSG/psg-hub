"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { confirmDialog } from "@/components/Dialogs";
import { fmtDay as fmtDate } from "@/lib/format";

export type Ticket = {
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

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "open",        label: "Open",        color: "#3b82f6" },
  { key: "in_progress", label: "In Progress",  color: "#f59e0b" },
  { key: "resolved",    label: "Resolved",     color: "#10b981" },
  { key: "closed",      label: "Closed",       color: "#6b7280" },
];

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


const inp = "w-full rounded-lg px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)" };

const BLANK = { title: "", description: "", category: "bug", priority: "medium" };

export type HelpdeskInitial = { tickets: Ticket[]; all: boolean } | null;

export default function HelpdeskView({ initial, isAdmin }: { initial: HelpdeskInitial; isAdmin: boolean }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? (isAdmin ? "admin" : "member");
  const [tickets, setTickets] = useState<Ticket[]>(initial?.tickets ?? []);
  // Admins start on every ticket; the server knows the role, so this is right from the first render
  const [showAll, setShowAll] = useState(initial?.all ?? isAdmin);
  const loadedFor = useRef<boolean | null>(initial ? initial.all : null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function load(all: boolean) {
    const r = await fetch(`/api/help-tickets${all ? "?all=1" : ""}`);
    const d = await r.json();
    if (Array.isArray(d)) setTickets(d);
  }

  useEffect(() => {
    if (loadedFor.current === showAll) return; // arrived with the page
    loadedFor.current = null;
    load(showAll);
  }, [showAll]);

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
    if (!await confirmDialog("Delete this ticket?")) return;
    await fetch(`/api/help-tickets/${id}`, { method: "DELETE" });
    load(showAll);
  }

  function toggleExpanded(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div className="space-y-6">
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

      {/* Kanban board */}
      {tickets.length === 0 ? (
        <div className="text-sm py-10 text-center" style={{ color: "var(--psg-muted)" }}>
          No tickets yet — submit one above.
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {COLUMNS.map(col => {
            const colTickets = tickets.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="rounded-xl border flex flex-col min-h-32" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="ml-auto text-xs rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: col.color + "22", color: col.color }}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-3 flex-1">
                  {colTickets.length === 0 ? (
                    <p className="text-xs py-4 text-center" style={{ color: "var(--psg-muted)" }}>No tickets</p>
                  ) : (
                    colTickets.map(ticket => {
                      const isOpen = expanded[ticket.id];
                      return (
                        <div key={ticket.id} className="rounded-lg border p-3 space-y-2 cursor-pointer hover:border-white/20 transition-colors"
                          style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "var(--psg-card-border)" }}
                          onClick={() => toggleExpanded(ticket.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className="text-xs font-mono" style={{ color: "var(--psg-muted)" }}>#{ticket.id}</span>
                                {badge(ticket.priority, PRIORITY_COLORS[ticket.priority] ?? "#6b7280")}
                              </div>
                              <p className="text-sm font-medium text-white leading-snug">{ticket.title}</p>
                            </div>
                            <span className="text-xs shrink-0 mt-0.5" style={{ color: "var(--psg-muted)" }}>
                              {isOpen ? "▲" : "▼"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{CAT_LABELS[ticket.category]}</span>
                            <span className="text-xs ml-auto" style={{ color: "var(--psg-muted)" }}>{fmtDate(ticket.createdAt)}</span>
                          </div>

                          {/* Expanded detail */}
                          {isOpen && (
                            <div className="pt-2 space-y-2 border-t" style={{ borderColor: "var(--psg-card-border)" }} onClick={e => e.stopPropagation()}>
                              {ticket.description && (
                                <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{ticket.description}</p>
                              )}
                              {showAll && ticket.createdByUser && (
                                <p className="text-xs" style={{ color: "var(--psg-muted)" }}>by {ticket.createdByUser.name}</p>
                              )}
                              {ticket.resolvedAt && (
                                <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Resolved {fmtDate(ticket.resolvedAt)}</p>
                              )}

                              {/* Admin controls */}
                              {role === "admin" && (
                                <div className="flex flex-col gap-1.5 pt-1">
                                  <select
                                    value={ticket.status}
                                    onChange={e => updateTicket(ticket.id, { status: e.target.value })}
                                    className="text-xs rounded px-2 py-1 border w-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)", color: COLUMNS.find(c => c.key === ticket.status)?.color ?? "white" }}
                                  >
                                    {COLUMNS.map(c => <option key={c.key} value={c.key} className="text-white">{c.label}</option>)}
                                  </select>
                                  <select
                                    value={ticket.priority}
                                    onChange={e => updateTicket(ticket.id, { priority: e.target.value })}
                                    className="text-xs rounded px-2 py-1 border w-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)", color: PRIORITY_COLORS[ticket.priority] ?? "white" }}
                                  >
                                    {PRIORITIES.map(p => <option key={p} value={p} className="text-white capitalize">{p}</option>)}
                                  </select>
                                  <button onClick={() => deleteTicket(ticket.id)} className="text-xs text-red-400 hover:text-red-300 text-left transition-colors">Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
