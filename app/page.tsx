"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Production = {
  id: number;
  name: string;
  type: string;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  _count: { events: number; budgetLines: number };
  budgetLines: { budgeted: number; expenses: { amount: number }[] }[];
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function calcBudget(p: Production) {
  const total = p.budgetLines.reduce((s, l) => s + l.budgeted, 0);
  const spent = p.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.amount, 0), 0);
  return { total, spent, variance: total - spent };
}

export default function Dashboard() {
  const [productions, setProductions] = useState<Production[]>([]);

  useEffect(() => {
    fetch("/api/productions").then((r) => r.json()).then(setProductions);
  }, []);

  const active = productions.filter((p) => p.status !== "closed");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/productions/new"
          className="text-white px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--psg-blue)" }}
        >
          + New Production
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Productions", value: active.length, isCurrency: false },
          { label: "Total Budget", value: active.reduce((s, p) => s + calcBudget(p).total, 0), isCurrency: true },
          { label: "Total Spent", value: active.reduce((s, p) => s + calcBudget(p).spent, 0), isCurrency: true },
        ].map(({ label, value, isCurrency }) => (
          <div key={label} className="rounded-lg border p-5" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{label}</p>
            <p className="text-3xl font-bold mt-1 text-white">{isCurrency ? fmt(value as number) : value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 text-white">All Productions</h2>
        {productions.length === 0 ? (
          <div className="rounded-lg border p-10 text-center" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            No productions yet.{" "}
            <Link href="/productions/new" className="text-white underline">Create your first one.</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {productions.map((p) => {
              const { total, spent, variance } = calcBudget(p);
              const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/productions/${p.id}`}
                  className="block rounded-lg border p-5 transition-colors hover:border-blue-500/50"
                  style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base text-white">{p.name}</span>
                        <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{p.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-white/10 text-white/50"}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.venue && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{p.venue}</p>}
                      <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                        {p._count.events} events · {p._count.budgetLines} budget lines
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-44">
                      <p className="text-sm font-medium text-white">
                        {fmt(spent)} <span className="font-normal" style={{ color: "var(--psg-muted)" }}>of {fmt(total)}</span>
                      </p>
                      <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--psg-card-border)" }}>
                        <div
                          className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-green-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${variance < 0 ? "text-red-400" : "text-green-400"}`}>
                        {variance < 0 ? `${fmt(Math.abs(variance))} over` : `${fmt(variance)} remaining`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
