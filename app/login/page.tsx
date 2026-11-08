"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type UserRow = { id: number; name: string; email: string; avatarUrl: string | null };

function Initials({ name }: { name: string }) {
  const ini = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white">
      {ini}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/users/public").then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email: selected.email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Incorrect password.");
    } else {
      router.push(params.get("callbackUrl") ?? "/");
      router.refresh();
    }
  }

  const inp = "w-full rounded px-3 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
  const inpStyle = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: "var(--psg-dark-bg)", zIndex: 100 }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded px-4 py-2">
            <Image src="/psg-logo.png" alt="Production Solutions Group" width={120} height={76} className="object-contain" priority />
          </div>
        </div>

        <div className="rounded-xl border p-8 shadow-2xl" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          {!selected ? (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
              <p className="text-sm mb-6" style={{ color: "var(--psg-muted)" }}>PSG Hub — who are you?</p>

              {users.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelected(u); setError(""); }}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-colors group"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden relative shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>
                        {u.avatarUrl ? (
                          <Image src={u.avatarUrl} alt={u.name} fill className="object-cover" />
                        ) : (
                          <Initials name={u.name} />
                        )}
                      </div>
                      <span className="text-xs text-center leading-tight" style={{ color: "var(--psg-muted)" }}>
                        {u.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                // Fallback: plain email/password form if no users loaded
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="email" placeholder="Email" required className={inp} style={inpStyle}
                    onChange={e => setSelected({ id: 0, name: "", email: e.target.value, avatarUrl: null })} />
                  <input type="password" placeholder="Password" required className={inp} style={inpStyle}
                    value={password} onChange={e => setPassword(e.target.value)} />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button type="submit" disabled={loading} className="w-full text-white py-2.5 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--psg-blue)" }}>
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => { setSelected(null); setPassword(""); setError(""); }}
                className="flex items-center gap-1.5 text-xs mb-5 hover:text-white transition-colors"
                style={{ color: "var(--psg-muted)" }}
              >
                ← All users
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full overflow-hidden relative shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>
                  {selected.avatarUrl ? (
                    <Image src={selected.avatarUrl} alt={selected.name} fill className="object-cover" />
                  ) : (
                    <Initials name={selected.name} />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{selected.name}</p>
                  <p className="text-xs" style={{ color: "var(--psg-muted)" }}>{selected.email}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Password</label>
                  <input
                    required
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    className={inp}
                    style={inpStyle}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-2.5 rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: "var(--psg-blue)" }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
