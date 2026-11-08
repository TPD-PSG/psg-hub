"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user as any;

  // Avatar — always fetch fresh from DB in case session token is stale
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [liveAvatarUrl, setLiveAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.avatarUrl) setLiveAvatarUrl(d.avatarUrl);
    });
  }, []);

  // Password
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  if (!session) return null;

  const initials = user?.name
    ? user.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarMsg("");
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setLiveAvatarUrl(data.avatarUrl);
      await update({ avatarUrl: data.avatarUrl });
      setAvatarMsg("Photo updated!");
    } else {
      setAvatarMsg(data.error ?? "Upload failed");
    }
    setAvatarLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwMsg("");
    if (pwForm.next !== pwForm.confirm) {
      setPwError("New passwords don't match");
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    const res = await fetch("/api/users/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (res.ok) {
      setPwMsg("Password changed successfully.");
      setPwForm({ current: "", next: "", confirm: "" });
    } else {
      setPwError(data.error ?? "Failed to change password");
    }
  }

  const card = "rounded-xl border p-6 mb-4";
  const cardStyle = { backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" };
  const inp = "w-full rounded px-3 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-white mb-6">My Profile</h1>

      {/* Avatar card */}
      <div className={card} style={cardStyle}>
        <h2 className="text-sm font-semibold text-white mb-4">Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>
            {(liveAvatarUrl ?? user?.avatarUrl) ? (
              <Image src={liveAvatarUrl ?? user.avatarUrl} alt={user.name ?? ""} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-white font-medium mb-0.5">{user?.name}</p>
            <p className="text-xs mb-3" style={{ color: "var(--psg-muted)" }}>{user?.email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              className="text-sm px-3 py-1.5 rounded border hover:bg-white/10 transition-colors text-white disabled:opacity-50"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              {avatarLoading ? "Uploading…" : "Change photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
            {avatarMsg && (
              <p className="text-xs mt-2" style={{ color: avatarMsg.includes("!") ? "#4ade80" : "#f87171" }}>{avatarMsg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className={card} style={cardStyle}>
        <h2 className="text-sm font-semibold text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Current password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className={inp}
              style={inpStyle}
              value={pwForm.current}
              onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>New password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inp}
              style={inpStyle}
              value={pwForm.next}
              onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Confirm new password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inp}
              style={inpStyle}
              value={pwForm.confirm}
              onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>
          {pwError && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{pwError}</p>}
          {pwMsg && <p className="text-sm text-green-400 bg-green-900/20 border border-green-800/40 rounded px-3 py-2">{pwMsg}</p>}
          <button
            type="submit"
            disabled={pwLoading}
            className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--psg-blue)" }}
          >
            {pwLoading ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
