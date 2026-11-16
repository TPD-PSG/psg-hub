"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

type State = "loading" | "ready" | "submitting" | "done" | "error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErrorMsg(d.error); setState("error"); }
        else { setName(d.name); setEmail(d.email); setState("ready"); }
      })
      .catch(() => { setErrorMsg("Something went wrong. Please try again."); setState("error"); });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < 8) { setFormError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setFormError("Passwords do not match"); return; }

    setState("submitting");
    const res = await fetch(`/api/invites/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error ?? "Something went wrong"); setState("ready"); return; }
    setState("done");
    setTimeout(() => router.push("/"), 2500);
  }

  const inp = "w-full rounded px-3 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: "#0a193d" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="bg-white rounded px-3 py-2">
            <Image src="/psg-logo.png" alt="PSG" width={80} height={52} className="object-contain" />
          </div>
        </div>

        {state === "loading" && (
          <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Checking your invitation…</p>
        )}

        {state === "error" && (
          <div className="rounded-lg border p-6 text-center space-y-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
            <p className="text-2xl">⚠️</p>
            <p className="font-semibold text-white">Invitation invalid</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{errorMsg}</p>
          </div>
        )}

        {state === "done" && (
          <div className="rounded-lg border p-6 text-center space-y-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
            <p className="text-2xl">✅</p>
            <p className="font-semibold text-white">Account created!</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Redirecting you to sign in…</p>
          </div>
        )}

        {(state === "ready" || state === "submitting") && (
          <div className="rounded-lg border p-6 space-y-5" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
            <div>
              <h1 className="text-xl font-bold text-white">Welcome to PSG Hub</h1>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Hi {name} — set a password to activate your account.</p>
            </div>

            <div className="text-sm rounded px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
              {email}
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Password</label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className={inp}
                  style={inpStyle}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Confirm password</label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className={inp}
                  style={inpStyle}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{formError}</p>
              )}
              <button
                type="submit"
                disabled={state === "submitting"}
                className="w-full text-white py-2.5 rounded font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#2563eb" }}
              >
                {state === "submitting" ? "Creating account…" : "Activate account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
