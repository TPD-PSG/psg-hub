"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type User = { id: number; name: string; email: string; role: string; createdAt: string };

const BLANK = { name: "", email: "", password: "", role: "member" };
const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<typeof BLANK & { id?: number }>(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.replace("/");
    }
  }, [status, session, router]);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const data = await fetch("/api/users").then((r) => r.json());
    if (Array.isArray(data)) setUsers(data);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = form.id
      ? await fetch(`/api/users/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      : await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? "An error occurred");
      return;
    }
    setShowForm(false);
    setEditUser(null);
    setForm(BLANK);
    reload();
  }

  async function deleteUser(u: User) {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error);
      return;
    }
    reload();
  }

  function openEdit(u: User) {
    setForm({ id: u.id, name: u.name, email: u.email, password: "", role: u.role });
    setEditUser(u);
    setShowForm(true);
  }

  if (status === "loading") return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{users.length} user{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setForm(BLANK); setEditUser(null); setError(""); setShowForm(true); }}
          className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--psg-blue)" }}
        >
          + Add User
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
              <th className="px-4 py-3 text-left font-medium text-white">Name</th>
              <th className="px-4 py-3 text-left font-medium text-white">Email</th>
              <th className="px-4 py-3 text-left font-medium text-white">Role</th>
              <th className="px-4 py-3 text-left font-medium text-white">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-blue-900/60 text-blue-300" : "bg-white/10 text-white/60"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(u)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                    <button onClick={() => deleteUser(u)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
              <h2 className="font-semibold text-white">{editUser ? "Edit User" : "Add User"}</h2>
              <button onClick={() => { setShowForm(false); setError(""); }} className="text-xl leading-none hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
            </div>
            <div className="px-5 py-4">
              <form onSubmit={save} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
                  <input required className={inp} style={inpStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Email *</label>
                  <input required type="email" className={inp} style={inpStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>
                    Password {editUser ? "(leave blank to keep current)" : "*"}
                  </label>
                  <input
                    required={!editUser}
                    type="password"
                    autoComplete="new-password"
                    className={inp}
                    style={inpStyle}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Role</label>
                  <select className={inp} style={inpStyle} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
                    {editUser ? "Save Changes" : "Add User"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
