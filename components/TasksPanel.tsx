"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";

type User = { id: number; name: string; email: string; avatarUrl?: string | null };
type TaskList = { id: number; name: string; position: number };
type Task = {
  id: number;
  title: string;
  description: string | null;
  productionId: number | null;
  taskListId: number | null;
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

function TaskCard({ task, onQuickStatus, onEdit, onDelete, showProduction }: {
  task: Task;
  onQuickStatus: (task: Task, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  showProduction: boolean;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onQuickStatus(task, task.status === "done" ? "todo" : (task.requiresSignoff ? "awaiting_signoff" : "done"))}
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
              <span className="flex items-center gap-1">
                {task.assigneeUser && <UserAvatar name={task.assigneeUser.name} avatarUrl={task.assigneeUser.avatarUrl} size={18} />}
                <span>Assigned to: <span className="text-white/70">{task.assigneeUser?.name ?? task.assigneeName}</span></span>
              </span>
            )}
            {task.requiresSignoff && task.signoffUser && (
              <span className={`flex items-center gap-1 ${task.status === "awaiting_signoff" ? "text-yellow-400 font-medium" : ""}`}>
                <UserAvatar name={task.signoffUser.name} avatarUrl={task.signoffUser.avatarUrl} size={18} />
                Sign-off: {task.signoffUser.name}
                {task.signoffAt ? ` ✓ ${new Date(task.signoffAt).toLocaleDateString("en-GB")}` : ""}
              </span>
            )}
            {task.dueDate && (
              <span className={new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-red-400" : ""}>
                Due: {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {showProduction && task.production && (
              <span>Production: <span className="text-white/70">{task.production.name}</span></span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {task.status !== "in_progress" && task.status !== "done" && (
            <button onClick={() => onQuickStatus(task, "in_progress")} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Start</button>
          )}
          {task.requiresSignoff && task.status !== "awaiting_signoff" && task.status !== "done" && (
            <button onClick={() => onQuickStatus(task, "awaiting_signoff")} className="text-xs px-2 py-1 rounded" style={{ color: "#facc15", backgroundColor: "rgba(250,204,21,0.1)" }}>Request sign-off</button>
          )}
          <button onClick={() => onEdit(task)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Edit</button>
          <button onClick={() => onDelete(task.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
        </div>
      </div>
    </div>
  );
}

type Props = { productionId?: number };

const BLANK = {
  title: "", description: "", assigneeUserId: "", assigneeName: "",
  status: "todo", priority: "medium", dueDate: "",
  requiresSignoff: false, signoffUserId: "",
};

// Sentinel value for "no list" (tasks not assigned to any list)
const NO_LIST_ID = "__none__";

export default function TasksPanel({ productionId }: Props) {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [activeListId, setActiveListId] = useState<string>(NO_LIST_ID);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");

  // Task form
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState(BLANK);

  // List management
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingListId, setRenamingListId] = useState<number | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  useEffect(() => {
    if (productionId !== undefined) loadLists();
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionId]);

  useEffect(() => {
    reloadTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionId, activeListId]);

  async function loadLists() {
    if (!productionId) return;
    const data = await fetch(`/api/productions/${productionId}/task-lists`).then(r => r.json());
    if (Array.isArray(data)) setLists(data);
  }

  async function loadUsers() {
    const data = await fetch("/api/users").then(r => r.json());
    if (Array.isArray(data)) setUsers(data);
  }

  async function reloadTasks() {
    let qs: string;
    if (productionId !== undefined) {
      qs = `?productionId=${productionId}`;
      if (activeListId === NO_LIST_ID) qs += "&taskListId=null";
      else qs += `&taskListId=${activeListId}`;
    } else {
      qs = "?companyWide=1";
    }
    const data = await fetch(`/api/tasks${qs}`).then(r => r.json());
    if (Array.isArray(data)) setTasks(data);
  }

  async function addList() {
    if (!newListName.trim() || !productionId) return;
    await fetch(`/api/productions/${productionId}/task-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newListName.trim() }),
    });
    setNewListName(""); setShowNewList(false);
    await loadLists();
  }

  async function renameList(id: number) {
    if (!renamingValue.trim()) return;
    await fetch(`/api/task-lists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renamingValue.trim() }),
    });
    setRenamingListId(null); setRenamingValue("");
    await loadLists();
  }

  async function deleteList(id: number, name: string) {
    if (!confirm(`Delete list "${name}"? Tasks in this list will not be deleted but will be unassigned from the list.`)) return;
    await fetch(`/api/task-lists/${id}`, { method: "DELETE" });
    if (activeListId === String(id)) setActiveListId(NO_LIST_ID);
    await loadLists();
    await reloadTasks();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const listIdForTask = productionId !== undefined && activeListId !== NO_LIST_ID
      ? Number(activeListId)
      : null;
    const payload = {
      ...form,
      productionId: productionId ?? null,
      taskListId: listIdForTask,
      assigneeUserId: form.assigneeUserId ? Number(form.assigneeUserId) : null,
      signoffUserId: form.signoffUserId ? Number(form.signoffUserId) : null,
    };
    if (editTask) {
      await fetch(`/api/tasks/${editTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowForm(false); setEditTask(null); setForm(BLANK);
    await reloadTasks();
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await reloadTasks();
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
    await reloadTasks();
  }

  const filtered = tasks.filter((t) => {
    if (statusFilter === "active") return t.status !== "done";
    if (statusFilter === "done") return t.status === "done";
    if (statusFilter === "signoff") return t.status === "awaiting_signoff";
    return true;
  });

  const counts = {
    active: tasks.filter(t => t.status !== "done").length,
    signoff: tasks.filter(t => t.status === "awaiting_signoff").length,
    done: tasks.filter(t => t.status === "done").length,
  };

  // Group tasks by production for standalone "my tasks" view
  const groupedTasks: { label: string; tasks: Task[] }[] = [];
  if (productionId === undefined) {
    const groups = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = t.production?.name ?? "Company-wide";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    // Company-wide last
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Company-wide") return 1;
      if (b === "Company-wide") return -1;
      return a.localeCompare(b);
    });
    for (const [label, tasks] of sorted) groupedTasks.push({ label, tasks });
  }

  const activeListName = activeListId === NO_LIST_ID
    ? "General"
    : lists.find(l => String(l.id) === activeListId)?.name ?? "General";

  return (
    <div>
      {/* ── List tabs ── */}
      {productionId !== undefined && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {/* General (no list) tab */}
          <button
            onClick={() => setActiveListId(NO_LIST_ID)}
            className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
            style={activeListId === NO_LIST_ID
              ? { backgroundColor: "var(--psg-blue)", color: "white" }
              : { backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}
          >
            General
          </button>

          {lists.map(list => (
            <div key={list.id} className="relative group flex items-center gap-0.5">
              {renamingListId === list.id ? (
                <form onSubmit={e => { e.preventDefault(); renameList(list.id); }} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={renamingValue}
                    onChange={e => setRenamingValue(e.target.value)}
                    onBlur={() => renameList(list.id)}
                    className="text-sm px-2 py-1 rounded border text-white focus:outline-none"
                    style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-blue)", width: Math.max(80, renamingValue.length * 8 + 24) }}
                  />
                </form>
              ) : (
                <>
                  <button
                    onClick={() => setActiveListId(String(list.id))}
                    className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
                    style={activeListId === String(list.id)
                      ? { backgroundColor: "var(--psg-blue)", color: "white" }
                      : { backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}
                  >
                    {list.name}
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                    <button
                      onClick={() => { setRenamingListId(list.id); setRenamingValue(list.name); }}
                      title="Rename list"
                      className="w-5 h-5 flex items-center justify-center rounded text-xs hover:bg-white/10 transition-colors"
                      style={{ color: "var(--psg-muted)" }}
                    >✎</button>
                    <button
                      onClick={() => deleteList(list.id, list.name)}
                      title="Delete list"
                      className="w-5 h-5 flex items-center justify-center rounded text-xs hover:bg-red-500/20 transition-colors"
                      style={{ color: "var(--psg-muted)" }}
                    >✕</button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* New list */}
          {showNewList ? (
            <form onSubmit={e => { e.preventDefault(); addList(); }} className="flex items-center gap-1">
              <input
                autoFocus
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onBlur={() => { if (!newListName.trim()) setShowNewList(false); }}
                placeholder="List name…"
                className="text-sm px-2 py-1 rounded border text-white focus:outline-none"
                style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-blue)", width: 140 }}
              />
              <button type="submit" className="text-sm px-2 py-1 rounded font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
              <button type="button" onClick={() => { setShowNewList(false); setNewListName(""); }} className="text-sm px-2 py-1 rounded" style={{ color: "var(--psg-muted)" }}>✕</button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewList(true)}
              className="text-sm px-2.5 py-1.5 rounded-md transition-colors"
              style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.04)" }}
              title="New list"
            >+ List</button>
          )}
        </div>
      )}

      {/* ── Status filter + Add Task ── */}
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
          + Add Task{productionId !== undefined ? ` to ${activeListName}` : ""}
        </button>
      </div>

      {/* ── Task list ── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-lg border text-sm" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          {tasks.length === 0 ? "No tasks yet." : "No tasks in this filter."}
        </div>
      ) : productionId === undefined ? (
        // Standalone "my tasks" view — grouped by production
        <div className="space-y-6">
          {groupedTasks.map(({ label, tasks: groupTasks }) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{label}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "var(--psg-muted)" }}>{groupTasks.length}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--psg-card-border)" }} />
              </div>
              <div className="space-y-2">
                {groupTasks.map((task) => <TaskCard key={task.id} task={task} onQuickStatus={quickStatus} onEdit={(t) => { setEditTask(t); setForm({ title: t.title, description: t.description ?? "", assigneeUserId: t.assigneeUserId?.toString() ?? "", assigneeName: t.assigneeName ?? "", status: t.status, priority: t.priority, dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "", requiresSignoff: t.requiresSignoff, signoffUserId: t.signoffUserId?.toString() ?? "" }); setShowForm(true); }} onDelete={deleteTask} showProduction={false} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onQuickStatus={quickStatus} onEdit={(t) => { setEditTask(t); setForm({ title: t.title, description: t.description ?? "", assigneeUserId: t.assigneeUserId?.toString() ?? "", assigneeName: t.assigneeName ?? "", status: t.status, priority: t.priority, dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "", requiresSignoff: t.requiresSignoff, signoffUserId: t.signoffUserId?.toString() ?? "" }); setShowForm(true); }} onDelete={deleteTask} showProduction={false} />
          ))}
        </div>
      )}

      {/* ── Task form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold">{editTask ? "Edit Task" : `New Task${productionId !== undefined ? ` — ${activeListName}` : ""}`}</h2>
              <button onClick={() => { setShowForm(false); setEditTask(null); setForm(BLANK); }} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <F label="Title *"><input required className={inp} style={inpStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></F>
              <F label="Description"><textarea rows={2} className={inp} style={inpStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></F>

              <div className="grid grid-cols-2 gap-3">
                <F label="Status">
                  <select className={inp} style={inpStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </F>
                <F label="Priority">
                  <select className={inp} style={inpStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </F>
              </div>

              <F label="Due date"><input type="date" className={inp} style={inpStyle} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></F>

              <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>Assignment</div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Assign to (Hub user)">
                    <select className={inp} style={inpStyle} value={form.assigneeUserId} onChange={e => setForm(f => ({ ...f, assigneeUserId: e.target.value, assigneeName: e.target.value ? "" : f.assigneeName }))}>
                      <option value="">— select —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </F>
                  <F label="Or assignee name (free text)">
                    <input className={inp} style={inpStyle} placeholder="External contact…" value={form.assigneeName} onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value, assigneeUserId: e.target.value ? "" : f.assigneeUserId }))} />
                  </F>
                </div>
              </div>

              <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="signoff" checked={form.requiresSignoff} onChange={e => setForm(f => ({ ...f, requiresSignoff: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="signoff" className="text-sm font-medium">Requires sign-off</label>
                </div>
                {form.requiresSignoff && (
                  <F label="Sign-off from">
                    <select className={inp} style={inpStyle} value={form.signoffUserId} onChange={e => setForm(f => ({ ...f, signoffUserId: e.target.value }))}>
                      <option value="">— select person —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
