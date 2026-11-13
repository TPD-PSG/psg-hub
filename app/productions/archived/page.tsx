"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";

type Production = {
  id: number; name: string; type: string; venue: string | null;
  archivedAt: string | null; logoUrl?: string | null; color?: string | null;
  startDate?: string | null; endDate?: string | null;
};

export default function ArchivedProductionsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const [productions, setProductions] = useState<Production[]>([]);
  const [unarchiving, setUnarchiving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/productions?archived=1").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProductions(d);
    });
  }, []);

  async function unarchive(p: Production) {
    setUnarchiving(p.id);
    await fetch(`/api/productions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    setProductions(prev => prev.filter(x => x.id !== p.id));
    setUnarchiving(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Archived Productions</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {productions.length} production{productions.length !== 1 ? "s" : ""} archived
          </p>
        </div>
        <Link href="/productions" className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/10"
          style={{ color: "var(--psg-muted)", border: "1px solid var(--psg-card-border)" }}>
          ← Active Productions
        </Link>
      </div>

      <div className="rounded-lg border divide-y" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        {productions.length === 0 && (
          <p className="p-8 text-center" style={{ color: "var(--psg-muted)" }}>No archived productions.</p>
        )}
        {productions.map(p => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-4" style={{ borderColor: "var(--psg-card-border)" }}>
            <Link href={`/productions/${p.id}`} className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center opacity-60"
                style={{ backgroundColor: p.logoUrl ? "transparent" : (p.color ?? "var(--psg-card-border)") }}>
                {p.logoUrl
                  ? <Image src={p.logoUrl} alt={p.name} width={40} height={40} className="object-contain w-full h-full" />
                  : <span className="text-xs font-bold text-white/60">{p.name.slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium" style={{ color: "var(--psg-muted)" }}>{p.name}</span>
                  <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{p.type}</span>
                  {p.venue && <span className="text-sm" style={{ color: "var(--psg-muted)" }}>· {p.venue}</span>}
                </div>
                {p.archivedAt && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                    Archived {new Date(p.archivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
            </Link>
            {role === "admin" && (
              <button
                onClick={() => unarchive(p)}
                disabled={unarchiving === p.id}
                className="shrink-0 text-xs px-3 py-1.5 rounded transition-colors hover:bg-white/10 disabled:opacity-50"
                style={{ color: "var(--psg-muted)", border: "1px solid var(--psg-card-border)" }}
              >
                {unarchiving === p.id ? "Restoring…" : "Restore"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
