"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Production = {
  id: number; name: string; type: string; venue: string | null; status: string;
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

export default function ProductionsPage() {
  const [productions, setProductions] = useState<Production[]>([]);

  useEffect(() => {
    fetch("/api/productions").then((r) => r.json()).then(setProductions);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Productions</h1>
        <Link
          href="/productions/new"
          className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--psg-blue)" }}
        >
          + New Production
        </Link>
      </div>
      <div className="rounded-lg border divide-y" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        {productions.length === 0 && (
          <p className="p-8 text-center" style={{ color: "var(--psg-muted)" }}>No productions yet.</p>
        )}
        {productions.map((p) => (
          <Link
            key={p.id}
            href={`/productions/${p.id}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--psg-card-border)" }}
          >
            <div className="flex-1">
              <span className="font-medium text-white">{p.name}</span>
              <span className="ml-2 text-sm" style={{ color: "var(--psg-muted)" }}>{p.type}</span>
              {p.venue && <span className="ml-2 text-sm" style={{ color: "var(--psg-muted)" }}>· {p.venue}</span>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-white/10 text-white/40"}`}>
              {p.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
