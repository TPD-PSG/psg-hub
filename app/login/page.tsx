"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
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
          <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-sm mb-6" style={{ color: "var(--psg-muted)" }}>PSG Hub</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Email</label>
              <input
                required
                type="email"
                autoComplete="email"
                className={inp}
                style={inpStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Password</label>
              <input
                required
                type="password"
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
