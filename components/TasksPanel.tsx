"use client";

import { useEffect, useState } from "react";

type User = { id: number; name: string; email: string };
type Task = {
  id: number;
  title: string;
  description: string | null;
  productionId: number | null;
  assigneeUserId: number | null;
  assigneeUser: User | null;
  assigneeName: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  requiresSignoff: boolean;
  signoffUserId: number | null;
  signoffUser: User | null;
  signoffAt: string | null;
  production?: { id: number; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  awaiting_signoff: "Awaiting Sign-off",
  done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  todo: "bg-white/10 text-white/60",
  in_progress: "bg-blue-900/60 text-blue-300",
  awaiting_signoff: "bg-yellow-900/60 text-yellow-300",
  done: "bg-green-900/60 text-green-300",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "text-white/40",
  medium: "text-yellow-400",
  high: "text-red-400",
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

type Props = {
  productionId?: number; // undefined = company-wide page
};

const BLANK = {
  title: "", description: "", assigneeUserId: "", assigneeName: "",
  status: "todo", priority: "medium", dueDate: "",
  requiresSignoff: false, signoffUserId: "",
};

export default function TasksPanel({ productionId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    reload();
    fetch("/api/users").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setUsers(data); });
  }, [productionId]);

  async function reload() {
    const qs = productionId !== undefined
      ? `?productionId=${productionId}`
      : "?companyWide=1";
    const data = await fetch(`/api/tasks${qs}`).then((r) => r.json());
    if (Array.isArray(data)) setTasks(data);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      productionId: productionId ?? null,
      assigneeUserId: form.assigneeUserId ? Number(form.assigneeUserId) : null,
      signoffUserId: form.signoffUserId ? Number(form.signoffUserId) : null,
    };
    if (editTask) {
      await fetch(`/api/tasks/${editTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowForm(false); setEditTask(null); setForm(BLANK);
    await reload();
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await reload();
  }

  async function quickStatus(task: Task, status: string) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title, description: task.description, status,
        priority: task.priority, dueDate: task.dueDate,
        assigneeUserId: task.assigneeUserId, assigneeName: task.assigneeName,
        requiresSignoff: task.requiresSignoff, signoffUserId: task.signoffUserId,
        signoffAt: status === "done" && task.requiresSignoff ? new Date().toISOString() : task.signoffAt,
      }),
    });
    await reload();
  }

  const filtered = tasks.filter((t) => {
    if (statusFilter === "active") return t.status !== "done";
    if (statusFilter === "done") return t.status === "done";
    if (statusFilter === "signoff") return t.status === "awaiting_signoff";
    return true;
  });

  const counts = {
    active: tasks.filter((t) => t.status !== "done").length,
    signoff: tasks.filter((t) => t.status === "awaiting_signoff").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
          {[
            { key: "active", label: `Active (${counts.active})` },
            { key: "signoff", label: `Sign-off needed (${counts.signoff})` },
            { key: "done", label: `Done (${counts.done})` },
            { key: "all", label: "All" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={statusFilter === key
                ? { backgroundColor: "var(--psg-blue)", color: "white" }
                : { backgroundColor: "rgba(255,255,255,0.08)", color: "var(--psg-muted)" }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditTask(null); setForm(BLANK); setShowForm(true); }}
          className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>
          + Add Task
        </button>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-lg border text-sm" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          {tasks.length === 0 ? "No tasks yet." : "No tasks in this filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-start gap-3">
                {/* Quick complete checkbox */}
                <button
                  onClick={() => quickStatus(task, task.status === "done" ? "todo" : (task.requiresSignoff ? "awaiting_signoff" : "done"))}
                  className="mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors"
                  style={task.status === "done"
                    ? { backgroundColor: "var(--psg-blue)", borderColor: "var(--psg-blue)" }
                    : { borderColor: "var(--psg-card-border)", backgroundColor: "transparent" }}
                  title={task.status === "done" ? "Mark incomplete" : task.requiresSignoff ? "Request sign-off" : "Mark done"}
                >
                  {task.status === "done" && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {task.status === "awaiting_signoff" && <span className="text-yellow-400 text-xs font-bold">?</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${task.status === "done" ? "line-through opacity-50" : ""}`}>{task.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                    <span className={`text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority === "high" ? "▲ High" : task.priority === "low" ? "▼ Low" : ""}
                    </span>
                  </div>

                  {task.description && <div className="text-sm mt-1" style={{ color: "var(--psg-muted)" }}>{task.description}</div>}

                  <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "var(--psg-muted)" }}>
                    {(task.assigneeUser || task.assigneeName) && (
                      <span>Assigned to: <span className="text-white/70">{task.assigneeUser?.name ?? task.assigneeName}</span></span>
                    )}
                    {task.requiresSignoff && task.signoffUser && (
                      <span className={task.status === "awaiting_signoff" ? "text-yellow-400 font-medium" : ""}>
                        Sign-off: {task.signoffUser.name}
                        {task.signoffAt ? ` ✓ ${new Date(task.signoffAt).toLocaleDateString("en-GB")}` : ""}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-400" : ""}>
                        Due: {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {!productionId && task.production && (
                      <span>Production: <span className="text-white/70">{task.production.name}</span></span>
                    )}
                  </div>
                </div>

                {/* Quick status cycle */}
                <div className="flex gap-1 shrink-0">
                  {task.status !== "in_progress" && task.status !== "done" && (
                    <button onClick={() => quickStatus(task, "in_progress")} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Start</button>
                  )}
                  {task.requiresSignoff && task.status !== "awaiting_signoff" && task.status !== "done" && (
                    <button onClick={() => quickStatus(task, "awaiting_signoff")} className="text-xs px-2 py-1 rounded" style={{ color: "#facc15", backgroundColor: "rgba(250,204,21,0.1)" }}>Request sign-off</button>
                  )}
                  <button onClick={() => { setEditTask(task); setForm({ title: task.title, description: task.description ?? "", assigneeUserId: task.assigneeUserId?.toString() ?? "", assigneeName: task.assigneeName ?? "", status: task.status, priority: task.priority, dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "", requiresSignoff: task.requiresSignoff, signoffUserId: task.signoffUserId?.toString() ?? "" }); setShowForm(true); }} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
                  <button onClick={() => deleteTask(task.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold">{editTask ? "Edit Task" : "New Task"}</h2>
              <button onClick={() => { setShowForm(false); setEditTask(null); setForm(BLANK); }} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <F label="Title *"><input required className={inp} style={inpStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></F>
              <F label="Description"><textarea rows={2} className={inp} style={inpStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></F>

              <div className="grid grid-cols-2 gap-3">
                <F label="Status">
                  <select className={inp} style={inpStyle} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </F>
                <F label="Priority">
                  <select className={inp} style={inpStyle} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </F>
              </div>

              <F label="Due date"><input type="date" className={inp} style={inpStyle} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></F>

              <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Assignment</div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Assign to (Hub user)">
                    <select className={inp} style={inpStyle} value={form.assigneeUserId} onChange={(e) => setForm((f) => ({ ...f, assigneeUserId: e.target.value, assigneeName: e.target.value ? "" : f.assigneeName }))}>
                      <option value="">— select —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </F>
                  <F label="Or assignee name (free text)">
                    <input className={inp} style={inpStyle} placeholder="External contact…" value={form.assigneeName} onChange={(e) => setForm((f) => ({ ...f, assigneeName: e.target.value, assigneeUserId: e.target.value ? "" : f.assigneeUserId }))} />
                  </F>
                </div>
              </div>

              <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="signoff" checked={form.requiresSignoff} onChange={(e) => setForm((f) => ({ ...f, requiresSignoff: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="signoff" className="text-sm font-medium">Requires sign-off</label>
                </div>
                {form.requiresSignoff && (
                  <F label="Sign-off from">
                    <select className={inp} style={inpStyle} value={form.signoffUserId} onChange={(e) => setForm((f) => ({ ...f, signoffUserId: e.target.value }))}>
                      <option value="">— select person —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </F>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditTask(null); setForm(BLANK); }} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>{editTask ? "Save Changes" : "Add Task"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
