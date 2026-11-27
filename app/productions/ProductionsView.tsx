"use client";
import { useSearchParams } from "next/navigation";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";
import { fmtDate as fmtDateShared } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS, ANN_COLORS, ANN_LABELS } from "@/lib/productionStatus";
const fmtDate = (s: string | null) => fmtDateShared(s, "");

type TeamMember = { user: { id: number; name: string; email: string; avatarUrl?: string | null } };
export type Production = {
  id: number; name: string; type: string; venue: string | null;
  status: string; announcementStatus?: string; internalStatus?: string;
  logoUrl?: string | null; color?: string | null;
  startDate: string | null; endDate: string | null;
  team?: TeamMember[];
};

// Colours and labels shared with each production's page

function StatTile({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-5 flex flex-col gap-1" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
      <span className="text-3xl font-bold text-white">{value}</span>
      <span className="text-sm font-medium text-white">{label}</span>
      {sub && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{sub}</span>}
    </div>
  );
}

// Productions arrive with the page (loaded on the server by page.tsx), so there's no empty flash
export default function ProductionsView({ initialProductions }: { initialProductions: Production[] }) {
  const { data: session } = useSession();
  const [productions] = useState<Production[]>(initialProductions);
  // ?mine=1 (the new look's "My productions") opens on the productions I'm on
  const [tab, setTab] = useState<"all" | "mine">(useSearchParams()?.get("mine") === "1" ? "mine" : "all");

  const userId = (session?.user as { id?: string; role?: string; permissions?: string | null } | undefined)?.id ? Number((session!.user as { id?: string }).id) : null;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const active = productions.filter(p => p.status !== "closed");
  const mine = productions.filter(p => p.team?.some(m => m.user.id === userId));
  const inProduction = active.filter(p => p.status === "in-production");
  const inPlanning = active.filter(p => p.status === "planning");
  const openingThisMonth = active.filter(p => {
    if (!p.startDate) return false;
    const d = new Date(p.startDate);
    return d >= thisMonthStart && d <= thisMonthEnd;
  });

  const displayed = tab === "mine" ? mine : productions.filter(p => p.status !== "closed");

  const tabBtn = (t: "all" | "mine", label: string, count: number) => (
    <button
      onClick={() => setTab(t)}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: tab === t ? "var(--psg-blue)" : "rgba(255,255,255,0.06)",
        color: tab === t ? "#fff" : "var(--psg-muted)",
        border: `1px solid ${tab === t ? "var(--psg-blue)" : "var(--psg-card-border)"}`,
      }}
    >
      {label} <span className="ml-1 text-xs opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={active.length} label="Active" sub="productions" />
        <StatTile value={inProduction.length} label="In Production" sub={inPlanning.length > 0 ? `${inPlanning.length} in planning` : undefined} />
        <StatTile value={mine.length} label="My Productions" sub="I'm on the team" />
        <StatTile value={openingThisMonth.length} label="Opening This Month" sub={openingThisMonth.map(p => p.name).join(", ") || undefined} />
      </div>

      {/* Tabs + list */}
      <div>
        <div className="flex gap-2 mb-4">
          {tabBtn("all", "All Active", active.length)}
          {tabBtn("mine", "My Productions", mine.length)}
        </div>

        <div className="rounded-lg border divide-y" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          {displayed.length === 0 && (
            <p className="p-8 text-center" style={{ color: "var(--psg-muted)" }}>
              {tab === "mine" ? "You're not on any active productions." : "No productions yet."}
            </p>
          )}
          {displayed.map((p) => (
            <Link
              key={p.id}
              href={`/productions/${p.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--psg-card-border)" }}
            >
              {/* Logo / colour swatch */}
              <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: p.logoUrl ? "transparent" : (p.color ?? "var(--psg-card-border)") }}>
                {p.logoUrl
                  ? <Image src={p.logoUrl} alt={p.name} width={40} height={40} className="object-contain w-full h-full" />
                  : <span className="text-xs font-bold text-white/60">{p.name.slice(0, 2).toUpperCase()}</span>
                }
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white">{p.name}</span>
                  <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{p.type}</span>
                  {p.venue && <span className="text-sm" style={{ color: "var(--psg-muted)" }}>· {p.venue}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {(p.startDate || p.endDate) && (
                    <span className="text-xs" style={{ color: "var(--psg-muted)" }}>
                      {p.startDate ? fmtDate(p.startDate) : ""}
                      {p.startDate && p.endDate ? " – " : ""}
                      {p.endDate ? fmtDate(p.endDate) : ""}
                    </span>
                  )}
                  {p.team && p.team.length > 0 && (
                    <div className="flex items-center gap-1">
                      {p.team.slice(0, 5).map((m) => (
                        <span key={m.user.id} title={m.user.name}>
                          <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={20} />
                        </span>
                      ))}
                      {p.team.length > 5 && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>+{p.team.length - 5}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                {p.internalStatus === "confirmed"
                  ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold tracking-wide" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#4ade80" }}>CONFIRMED</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full font-semibold tracking-wide" style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>PENCIL</span>
                }
                {p.announcementStatus && p.announcementStatus !== "not_announced" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ANN_COLORS[p.announcementStatus] ?? "bg-white/10 text-white/40"}`}>
                    {ANN_LABELS[p.announcementStatus] ?? p.announcementStatus}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-white/10 text-white/40"}`}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Link to archived */}
        <div className="mt-3 text-right">
          <Link href="/productions/archived" className="text-xs hover:underline" style={{ color: "var(--psg-muted)" }}>
            View archived productions →
          </Link>
        </div>
      </div>
    </div>
  );
}
