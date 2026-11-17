"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";

const PROD_SECTIONS = [
  { key: "schedule", label: "Schedule" },
  { key: "budget", label: "Budget" },
  { key: "crew", label: "Crew" },
  { key: "accommodation", label: "Accommodation" },
  { key: "haulage", label: "Haulage" },
  { key: "callsheets", label: "Call Sheets" },
  { key: "advancing", label: "Advancing" },
  { key: "contacts", label: "Contacts" },
  { key: "documents", label: "Documents" },
  { key: "links", label: "Links" },
  { key: "hs", label: "Health & Safety" },
  { key: "reports", label: "Show Reports" },
  { key: "tasks", label: "Tasks" },
];

const DEFAULT_HIDDEN_BY_ROLE: Record<string, string[]> = {
  client: ["budget", "crew", "advancing", "links"],
  freelancer: ["budget", "crew", "advancing", "links"],
};

const MODULES = [
  { key: "bd", label: "Business Dev" },
  { key: "productions", label: "Productions" },
  { key: "venues", label: "Venues" },
  { key: "tasks", label: "Tasks" },
  { key: "property", label: "Property" },
  { key: "finance", label: "Finance" },
  { key: "sales", label: "Sales" },
  { key: "marketing", label: "Marketing" },
];

type Permissions = { modules: string[]; allProductions: boolean; hiddenSections?: string[] };
type User = {
  id: number; name: string; email: string; role: string; avatarUrl?: string | null;
  color?: string | null; permissions: string | null; createdAt: string;
};
type Production = { id: number; name: string; status: string };

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

const INVITE_BLANK = { name: "", email: "", role: "member" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(BLANK);
  const [perms, setPerms] = useState<Permissions>(defaultPerms());
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(INVITE_BLANK);
  const [inviteError, setInviteError] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [allProductions, setAllProductions] = useState<Production[]>([]);
  const [selectedProductions, setSelectedProductions] = useState<number[]>([]);

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllProductions(d); });
  }, []);

  async function reload() {
    const data = await fetch("/api/users").then((r) => r.json());
    if (Array.isArray(data)) setUsers(data);
  }

  function openCreate() {
    setEditUser(null);
    setForm(BLANK);
    setPerms(defaultPerms());
    setSelectedProductions([]);
    setError("");
    setShowForm(true);
  }

  async function openEdit(u: User) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, color: u.color ?? "" });
    setPerms(parsePerms(u.permissions));
    setError("");
    setShowForm(true);
    const ids = await fetch(`/api/users/${u.id}/productions`).then(r => r.json()).catch(() => []);
    setSelectedProductions(Array.isArray(ids) ? ids : []);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = { ...form, permissions: perms, color: form.color || null };
    let savedUserId: number | null = null;
    if (editUser) {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      savedUserId = editUser.id;
    } else {
      const res = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      const created = await res.json();
      savedUserId = created.id;
    }

    // Sync team memberships when "Team only" is selected
    if (savedUserId && form.role !== "admin" && perms.modules.includes("productions") && !perms.allProductions) {
      const current = await fetch(`/api/users/${savedUserId}/productions`).then(r => r.json()).catch(() => []) as number[];
      const toAdd = selectedProductions.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !selectedProductions.includes(id));
      await Promise.all([
        ...toAdd.map(pid => fetch(`/api/productions/${pid}/team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: savedUserId }) })),
        ...toRemove.map(pid => fetch(`/api/productions/${pid}/team/${savedUserId}`, { method: "DELETE" })),
      ]);
    }

    setShowForm(false); setEditUser(null);
    await reload();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSending(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    setInviteSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setInviteError(data.error ?? "Failed to send invite");
      return;
    }
    setInviteSent(true);
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
        <div className="flex gap-2">
          <button onClick={() => { setInviteForm(INVITE_BLANK); setInviteError(""); setInviteSent(false); setShowInvite(true); }} className="px-4 py-2 rounded font-medium text-sm border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            ✉ Invite User
          </button>
          <button onClick={openCreate} className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Add User
          </button>
        </div>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isAdmin ? "bg-purple-900/60 text-purple-300" :
                      u.role === "client" ? "bg-emerald-900/60 text-emerald-300" :
                      u.role === "freelancer" ? "bg-amber-900/60 text-amber-300" :
                      "bg-white/10 text-white/60"
                    }`}>
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
                    <option value="client">Client</option>
                    <option value="freelancer">Freelancer</option>
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

                  {perms.modules.includes("productions") && form.role !== "admin" && (
                    <div className="border-t pt-4" style={{ borderColor: "var(--psg-card-border)" }}>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--psg-muted)" }}>Visible Sections</div>
                      <div className="text-xs mb-2" style={{ color: "var(--psg-muted)" }}>Untick to hide a section from this user</div>
                      <div className="grid grid-cols-2 gap-1">
                        {PROD_SECTIONS.map(s => {
                          const defaultHidden = DEFAULT_HIDDEN_BY_ROLE[form.role] ?? [];
                          const hidden = perms.hiddenSections ?? defaultHidden;
                          const isHidden = hidden.includes(s.key);
                          return (
                            <label key={s.key} className="flex items-center gap-2 cursor-pointer py-1">
                              <input type="checkbox" className="w-4 h-4 rounded" checked={!isHidden}
                                onChange={() => {
                                  const current = perms.hiddenSections ?? DEFAULT_HIDDEN_BY_ROLE[form.role] ?? [];
                                  const next = isHidden ? current.filter(x => x !== s.key) : [...current, s.key];
                                  setPerms(p => ({ ...p, hiddenSections: next }));
                                }} />
                              <span className="text-sm">{s.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                      {!perms.allProductions && allProductions.length > 0 && (
                        <div className="mt-3 rounded-lg border max-h-48 overflow-y-auto" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
                          {allProductions.map(p => (
                            <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 border-b last:border-b-0" style={{ borderColor: "var(--psg-card-border)" }}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded shrink-0"
                                checked={selectedProductions.includes(p.id)}
                                onChange={() => setSelectedProductions(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])}
                              />
                              <span className="text-sm truncate">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
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

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">Invite User</h2>
              <button onClick={() => setShowInvite(false)} className="text-xl leading-none hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4">
              {inviteSent ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-2xl">✉️</p>
                  <p className="font-semibold text-white">Invitation sent!</p>
                  <p className="text-sm" style={{ color: "var(--psg-muted)" }}>An email has been sent to {inviteForm.email} with a link to set their password.</p>
                  <button onClick={() => setShowInvite(false)} className="mt-4 px-4 py-2 rounded text-sm text-white" style={{ backgroundColor: "var(--psg-blue)" }}>Done</button>
                </div>
              ) : (
                <form onSubmit={sendInvite} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                    <input required className={inp} style={inpStyle} value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Email *</label>
                    <input required type="email" className={inp} style={inpStyle} value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Role</label>
                    <select className={inp} style={inpStyle} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="member">Member</option>
                      <option value="admin">Admin (full access)</option>
                      <option value="client">Client</option>
                      <option value="freelancer">Freelancer</option>
                    </select>
                  </div>
                  {inviteError && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{inviteError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={inviteSending} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: "var(--psg-blue)" }}>
                      {inviteSending ? "Sending…" : "Send Invitation"}
                    </button>
                    <button type="button" onClick={() => setShowInvite(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
