"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";

const MODULES = [
  { key: "bd", label: "Business Dev" },
  { key: "productions", label: "Productions" },
  { key: "venues", label: "Venues" },
  { key: "tasks", label: "Tasks" },
  { key: "property", label: "Property" },
];

type Permissions = { modules: string[]; allProductions: boolean };
type User = {
  id: number; name: string; email: string; role: string; avatarUrl?: string | null;
  color?: string | null; permissions: string | null; createdAt: string;
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function defaultPerms(): Permissions {
  return { modules: ["productions", "tasks"], allProductions: false };
}
function parsePerms(raw: string | null): Permissions {
  if (!raw) return defaultPerms();
  try { return JSON.parse(raw); } catch { return defaultPerms(); }
}

const BLANK = { name: "", email: "", password: "", role: "member", color: "" };

const MEMBER_COLORS = ["#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316","#14b8a6"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(BLANK);
  const [perms, setPerms] = useState<Permissions>(defaultPerms());
  const [error, setError] = useState("");

  useEffect(() => { reload(); }, []);

  async function reload() {
    const data = await fetch("/api/users").then((r) => r.json());
    if (Array.isArray(data)) setUsers(data);
  }

  function openCreate() {
    setEditUser(null);
    setForm(BLANK);
    setPerms(defaultPerms());
    setError("");
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, color: u.color ?? "" });
    setPerms(parsePerms(u.permissions));
    setError("");
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = { ...form, permissions: perms, color: form.color || null };
    if (editUser) {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
    } else {
      const res = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
    }
    setShowForm(false); setEditUser(null);
    await reload();
  }

  async function deleteUser(id: number) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error); return; }
    await reload();
  }

  function toggleModule(key: string) {
    setPerms((p) => ({
      ...p,
      modules: p.modules.includes(key) ? p.modules.filter((m) => m !== key) : [...p.modules, key],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Manage Hub access and permissions</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>
          + Add User
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: "var(--psg-card-border)" }}>
              {["Name", "Email", "Role", "Module access", "Productions", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
            {users.map((u) => {
              const p = parsePerms(u.permissions);
              const isAdmin = u.role === "admin";
              return (
                <tr key={u.id} className="hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size={28} />
                      {u.name}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? "bg-purple-900/60 text-purple-300" : "bg-white/10 text-white/60"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="text-xs" style={{ color: "var(--psg-muted)" }}>All (admin)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {MODULES.filter((m) => p.modules.includes(m.key)).map((m) => (
                          <span key={m.key} className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">{m.label}</span>
                        ))}
                        {p.modules.length === 0 && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>None</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                    {isAdmin ? "All" : p.allProductions ? "All" : "Team only"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(u)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                      <button onClick={() => deleteUser(u.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "var(--psg-card-bg)", border: "1px solid var(--psg-card-border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold">{editUser ? "Edit User" : "Add User"}</h2>
              <button onClick={() => setShowForm(false)} className="text-xl leading-none" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              {error && <div className="text-sm text-red-400 rounded px-3 py-2 bg-red-900/20">{error}</div>}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                  <input required className={inp} style={inpStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Email *</label>
                  <input required type="email" className={inp} style={inpStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{editUser ? "New password (leave blank to keep)" : "Password *"}</label>
                  <input type="password" required={!editUser} className={inp} style={inpStyle} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Role</label>
                  <select className={inp} style={inpStyle} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="member">Member</option>
                    <option value="admin">Admin (full access)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--psg-muted)" }}>Schedule colour</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {MEMBER_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: f.color === c ? "" : c }))}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{ backgroundColor: c, outline: form.color === c ? `3px solid white` : "none", outlineOffset: 2 }} />
                    ))}
                    {form.color && !MEMBER_COLORS.includes(form.color) && (
                      <span className="w-7 h-7 rounded-full" style={{ backgroundColor: form.color, outline: "3px solid white", outlineOffset: 2 }} />
                    )}
                    {form.color && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, color: "" }))} className="text-xs ml-1" style={{ color: "var(--psg-muted)" }}>Clear</button>
                    )}
                  </div>
                </div>
              </div>

              {form.role !== "admin" && (
                <>
                  <div className="border-t pt-4" style={{ borderColor: "var(--psg-card-border)" }}>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Module Access</div>
                    <div className="space-y-2">
                      {MODULES.map((m) => (
                        <label key={m.key} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={perms.modules.includes(m.key)} onChange={() => toggleModule(m.key)} className="w-4 h-4 rounded" />
                          <span className="text-sm">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {perms.modules.includes("productions") && (
                    <div className="border-t pt-4" style={{ borderColor: "var(--psg-card-border)" }}>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Production Access</div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="radio" name="prodAccess" checked={perms.allProductions} onChange={() => setPerms((p) => ({ ...p, allProductions: true }))} className="w-4 h-4" />
                          <div>
                            <div className="text-sm font-medium">All productions</div>
                            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Can see every production in the Hub</div>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="radio" name="prodAccess" checked={!perms.allProductions} onChange={() => setPerms((p) => ({ ...p, allProductions: false }))} className="w-4 h-4" />
                          <div>
                            <div className="text-sm font-medium">Team only</div>
                            <div className="text-xs" style={{ color: "var(--psg-muted)" }}>Only sees productions they're added to as a team member</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: "var(--psg-blue)" }}>{editUser ? "Save Changes" : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
