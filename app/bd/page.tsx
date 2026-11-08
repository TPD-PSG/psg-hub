"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: number; name: string; type: string };
type BDTask = { id: number; description: string; dueDate: string | null; completedAt: string | null };
type Opportunity = {
  id: number; title: string; type: string; stage: string;
  value: number | null; clientId: number | null; client: Client | null;
  description: string | null; closeDate: string | null; lostReason: string | null; notes: string | null;
  tasks: BDTask[]; createdAt: string; updatedAt: string;
};

const STAGES = [
  { key: "lead",        label: "Lead",        color: "#6b7280" },
  { key: "qualified",   label: "Qualified",   color: "#3b82f6" },
  { key: "proposal",    label: "Proposal",    color: "#8b5cf6" },
  { key: "negotiating", label: "Negotiating", color: "#f59e0b" },
  { key: "won",         label: "Won",         color: "#10b981" },
  { key: "lost",        label: "Lost",        color: "#ef4444" },
];

const OPP_TYPES = ["production","event","scenic","rental","acquisition","f&b","other"];
const CLIENT_TYPES = ["promoter","venue","council","broadcaster","corporate","other"];

const BLANK_OPP = { title: "", type: "production", stage: "lead", value: "", clientId: "", description: "", closeDate: "", notes: "" };
const BLANK_TASK = { description: "", dueDate: "" };
const BLANK_CLIENT = { name: "", type: "promoter", website: "", address: "", notes: "" };
const BLANK_CONTACT = { name: "", role: "", email: "", phone: "" };

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function fmtValue(v: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}
function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

export default function BDPage() {
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [filterStage, setFilterStage] = useState("all");

  // Opportunity form
  const [showOppForm, setShowOppForm] = useState(false);
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [oppForm, setOppForm] = useState<typeof BLANK_OPP & { id?: number }>(BLANK_OPP);

  // Selected opp for detail panel
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  // Task form
  const [taskInput, setTaskInput] = useState(BLANK_TASK);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(BLANK_CLIENT);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [showContactForm, setShowContactForm] = useState<number | null>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [o, c] = await Promise.all([
      fetch("/api/opportunities").then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]);
    if (Array.isArray(o)) setOpps(o);
    if (Array.isArray(c)) setClients(c);
    if (selectedOpp) {
      const fresh = (Array.isArray(o) ? o : []).find((x: Opportunity) => x.id === selectedOpp.id);
      if (fresh) setSelectedOpp(fresh);
    }
  }

  async function saveOpp(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...oppForm, value: oppForm.value || null, clientId: oppForm.clientId || null };
    if (oppForm.id) {
      await fetch(`/api/opportunities/${oppForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowOppForm(false);
    setEditOpp(null);
    setOppForm(BLANK_OPP);
    reload();
  }

  async function deleteOpp(id: number) {
    if (!confirm("Delete this opportunity? This cannot be undone.")) return;
    await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
    if (selectedOpp?.id === id) setSelectedOpp(null);
    reload();
  }

  async function moveStage(opp: Opportunity, stage: string) {
    await fetch(`/api/opportunities/${opp.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...opp, stage }) });
    reload();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpp) return;
    await fetch(`/api/opportunities/${selectedOpp.id}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskInput) });
    setTaskInput(BLANK_TASK);
    setShowTaskForm(false);
    reload();
  }

  async function toggleTask(task: BDTask) {
    await fetch(`/api/bd-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, completedAt: task.completedAt ? null : new Date().toISOString() }),
    });
    reload();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/bd-tasks/${id}`, { method: "DELETE" });
    reload();
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clientForm) });
    setShowClientForm(false);
    setClientForm(BLANK_CLIENT);
    reload();
  }

  async function convertToProduction(opp: Opportunity) {
    if (!confirm(`Convert "${opp.title}" to a production? This will open the new production form.`)) return;
    router.push(`/productions/new?from=bd&title=${encodeURIComponent(opp.title)}`);
  }

  function openEdit(opp: Opportunity) {
    setOppForm({
      id: opp.id, title: opp.title, type: opp.type, stage: opp.stage,
      value: opp.value?.toString() ?? "", clientId: opp.clientId?.toString() ?? "",
      description: opp.description ?? "", closeDate: opp.closeDate ? opp.closeDate.slice(0, 10) : "",
      notes: opp.notes ?? "",
    });
    setEditOpp(opp);
    setShowOppForm(true);
  }

  const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]));
  const visibleOpps = filterStage === "all" ? opps : opps.filter(o => o.stage === filterStage);
  const activeOpps = opps.filter(o => o.stage !== "won" && o.stage !== "lost");
  const totalPipeline = activeOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const wonValue = opps.filter(o => o.stage === "won").reduce((s, o) => s + (o.value ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Development</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {activeOpps.length} active · {fmtValue(totalPipeline) ?? "£0"} pipeline · {fmtValue(wonValue) ?? "£0"} won
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowClientForm(true)} className="border px-3 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            + Client
          </button>
          <button onClick={() => { setOppForm(BLANK_OPP); setEditOpp(null); setShowOppForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Opportunity
          </button>
        </div>
      </div>

      {/* View toggle + stage filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["pipeline","list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-sm capitalize transition-colors" style={{ backgroundColor: view === v ? "var(--psg-blue)" : "transparent", color: view === v ? "#fff" : "var(--psg-muted)" }}>
              {v}
            </button>
          ))}
        </div>
        {view === "list" && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStage("all")} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStage === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: "var(--psg-muted)" }}>All</button>
            {STAGES.map(s => (
              <button key={s.key} onClick={() => setFilterStage(s.key)} className="px-3 py-1 rounded text-xs transition-colors" style={{ backgroundColor: filterStage === s.key ? s.color + "33" : "transparent", color: filterStage === s.key ? s.color : "var(--psg-muted)" }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline kanban */}
      {view === "pipeline" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {STAGES.map(stage => {
            const cols = opps.filter(o => o.stage === stage.key);
            return (
              <div key={stage.key} className="rounded-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", borderTop: `3px solid ${stage.color}` }}>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
                  <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{cols.length}</span>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  {cols.map(opp => (
                    <button key={opp.id} onClick={() => setSelectedOpp(opp)} className="w-full text-left rounded-lg p-3 border transition-colors hover:border-white/20" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                      <div className="text-sm font-medium text-white mb-1 leading-tight">{opp.title}</div>
                      {opp.client && <div className="text-xs mb-1" style={{ color: "var(--psg-muted)" }}>{opp.client.name}</div>}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</span>
                        {opp.value && <span className="text-xs font-medium" style={{ color: stage.color }}>{fmtValue(opp.value)}</span>}
                      </div>
                      {opp.closeDate && (
                        <div className="text-xs mt-1" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                          {isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "⚠ " : ""}Close {fmtDate(opp.closeDate)}
                        </div>
                      )}
                      {opp.tasks.filter(t => !t.completedAt).length > 0 && (
                        <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                          {opp.tasks.filter(t => !t.completedAt).length} task{opp.tasks.filter(t => !t.completedAt).length !== 1 ? "s" : ""} open
                        </div>
                      )}
                    </button>
                  ))}
                  {cols.length === 0 && <div className="text-xs py-4 text-center" style={{ color: "var(--psg-muted)" }}>No opportunities</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Opportunity</th>
                <th className="px-4 py-3 text-left font-medium text-white">Client</th>
                <th className="px-4 py-3 text-left font-medium text-white">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-white">Value</th>
                <th className="px-4 py-3 text-left font-medium text-white">Close</th>
                <th className="px-4 py-3 text-left font-medium text-white">Tasks</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleOpps.map(opp => {
                const s = stageMap[opp.stage];
                return (
                  <tr key={opp.id} onClick={() => setSelectedOpp(opp)} className="border-t hover:bg-white/5 transition-colors cursor-pointer group" style={{ borderColor: "var(--psg-card-border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{opp.title}</div>
                      <div className="text-xs capitalize" style={{ color: "var(--psg-muted)" }}>{opp.type}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{opp.client?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s?.color + "22", color: s?.color }}>{s?.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{fmtValue(opp.value) ?? "—"}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: isOverdue(opp.closeDate) && opp.stage !== "won" && opp.stage !== "lost" ? "#ef4444" : "var(--psg-muted)" }}>
                      {fmtDate(opp.closeDate) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {opp.tasks.filter(t => !t.completedAt).length}/{opp.tasks.length}
                    </td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(opp)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => deleteOpp(opp.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleOpps.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No opportunities yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selectedOpp && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md border-l shadow-2xl flex flex-col z-40" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <h2 className="font-semibold text-white truncate pr-4">{selectedOpp.title}</h2>
            <button onClick={() => setSelectedOpp(null)} className="text-xl leading-none shrink-0 hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Stage selector */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--psg-muted)" }}>Stage</div>
              <div className="flex flex-wrap gap-1">
                {STAGES.map(s => (
                  <button key={s.key} onClick={() => moveStage(selectedOpp, s.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{ backgroundColor: selectedOpp.stage === s.key ? s.color : s.color + "22", color: selectedOpp.stage === s.key ? "#fff" : s.color }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              {selectedOpp.client && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Client</div>
                  <div className="text-sm text-white">{selectedOpp.client.name}</div>
                </div>
              )}
              {selectedOpp.value && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Value</div>
                  <div className="text-sm font-medium text-white">{fmtValue(selectedOpp.value)}</div>
                </div>
              )}
              <div>
                <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Type</div>
                <div className="text-sm text-white capitalize">{selectedOpp.type}</div>
              </div>
              {selectedOpp.closeDate && (
                <div>
                  <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Close date</div>
                  <div className="text-sm" style={{ color: isOverdue(selectedOpp.closeDate) && selectedOpp.stage !== "won" && selectedOpp.stage !== "lost" ? "#ef4444" : "white" }}>
                    {fmtDate(selectedOpp.closeDate)}
                  </div>
                </div>
              )}
            </div>

            {selectedOpp.description && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Description</div>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.description}</p>
              </div>
            )}

            {selectedOpp.notes && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--psg-muted)" }}>Notes</div>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedOpp.notes}</p>
              </div>
            )}

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Follow-up tasks</div>
                <button onClick={() => setShowTaskForm(t => !t)} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
              </div>

              {showTaskForm && (
                <form onSubmit={addTask} className="mb-3 space-y-2 rounded-lg p-3 border" style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}>
                  <input required placeholder="Task description" className={inp} style={inpStyle} value={taskInput.description} onChange={e => setTaskInput(t => ({ ...t, description: e.target.value }))} />
                  <div className="flex gap-2">
                    <input type="date" className={inp} style={inpStyle} value={taskInput.dueDate} onChange={e => setTaskInput(t => ({ ...t, dueDate: e.target.value }))} />
                    <button type="submit" className="text-white px-3 py-2 rounded text-sm font-medium hover:opacity-90 shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {selectedOpp.tasks.length === 0 && !showTaskForm && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No tasks yet</p>}
                {selectedOpp.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 rounded p-2 group" style={{ backgroundColor: task.completedAt ? "transparent" : "rgba(255,255,255,0.03)" }}>
                    <button onClick={() => toggleTask(task)} className="mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors" style={{ borderColor: task.completedAt ? "#10b981" : "var(--psg-card-border)", backgroundColor: task.completedAt ? "#10b981" : "transparent" }}>
                      {task.completedAt && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ color: task.completedAt ? "var(--psg-muted)" : "white", textDecoration: task.completedAt ? "line-through" : "none" }}>{task.description}</div>
                      {task.dueDate && <div className="text-xs mt-0.5" style={{ color: isOverdue(task.dueDate) && !task.completedAt ? "#ef4444" : "var(--psg-muted)" }}>{fmtDate(task.dueDate)}</div>}
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel actions */}
          <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <button onClick={() => openEdit(selectedOpp)} className="flex-1 border py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
            {selectedOpp.stage === "won" && (
              <button onClick={() => convertToProduction(selectedOpp)} className="flex-1 text-white py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "#10b981" }}>
                → Production
              </button>
            )}
            <button onClick={() => deleteOpp(selectedOpp.id)} className="border py-2 px-3 rounded text-sm hover:bg-red-900/20 transition-colors text-red-400" style={{ borderColor: "rgba(239,68,68,0.3)" }}>Delete</button>
          </div>
        </div>
      )}

      {/* Opportunity form modal */}
      {showOppForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-lg border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">{editOpp ? "Edit Opportunity" : "New Opportunity"}</h2>
              <button onClick={() => { setShowOppForm(false); }} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              <form onSubmit={saveOpp} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Title *</label>
                  <input required className={inp} style={inpStyle} value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                    <select className={inp} style={inpStyle} value={oppForm.type} onChange={e => setOppForm(f => ({ ...f, type: e.target.value }))}>
                      {OPP_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Stage</label>
                    <select className={inp} style={inpStyle} value={oppForm.stage} onChange={e => setOppForm(f => ({ ...f, stage: e.target.value }))}>
                      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Value (£)</label>
                    <input type="number" className={inp} style={inpStyle} value={oppForm.value} onChange={e => setOppForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Close date</label>
                    <input type="date" className={inp} style={inpStyle} value={oppForm.closeDate} onChange={e => setOppForm(f => ({ ...f, closeDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Client</label>
                  <select className={inp} style={inpStyle} value={oppForm.clientId} onChange={e => setOppForm(f => ({ ...f, clientId: e.target.value }))}>
                    <option value="">— None —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Description</label>
                  <textarea rows={2} className={inp} style={inpStyle} value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                  <textarea rows={2} className={inp} style={inpStyle} value={oppForm.notes} onChange={e => setOppForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>
                    {editOpp ? "Save" : "Add Opportunity"}
                  </button>
                  <button type="button" onClick={() => setShowOppForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Client form modal */}
      {showClientForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">Add Client</h2>
              <button onClick={() => setShowClientForm(false)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4">
              <form onSubmit={saveClient} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                  <input required className={inp} style={inpStyle} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                  <select className={inp} style={inpStyle} value={clientForm.type} onChange={e => setClientForm(f => ({ ...f, type: e.target.value }))}>
                    {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
                  <input className={inp} style={inpStyle} value={clientForm.website} onChange={e => setClientForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                  <textarea rows={2} className={inp} style={inpStyle} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add Client</button>
                  <button type="button" onClick={() => setShowClientForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
