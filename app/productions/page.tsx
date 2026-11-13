"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import UserAvatar from "@/components/UserAvatar";

type TeamMember = { user: { id: number; name: string; email: string; avatarUrl?: string | null } };
type Production = {
  id: number; name: string; type: string; venue: string | null; status: string;
  announcementStatus?: string;
  internalStatus?: string;
  logoUrl?: string | null;
  color?: string | null;
  team?: TeamMember[];
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

const ANN_COLORS: Record<string, string> = {
  nda: "bg-red-900/60 text-red-300",
  not_announced: "bg-orange-900/60 text-orange-300",
  on_sale: "bg-blue-900/60 text-blue-300",
  open: "bg-green-900/60 text-green-300",
};
const ANN_LABELS: Record<string, string> = {
  nda: "NDA", not_announced: "Not Announced", on_sale: "On Sale", open: "Open",
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
            <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: p.logoUrl ? "transparent" : (p.color ?? "var(--psg-card-border)") }}>
              {p.logoUrl
                ? <Image src={p.logoUrl} alt={p.name} width={40} height={40} className="object-contain w-full h-full" />
                : <span className="text-xs font-bold text-white/60">{p.name.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{p.name}</span>
                <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{p.type}</span>
                {p.venue && <span className="text-sm" style={{ color: "var(--psg-muted)" }}>· {p.venue}</span>}
              </div>
              {p.team && p.team.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  {p.team.map((m) => (
                    <span key={m.user.id} title={m.user.name}>
                      <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={24} />
                    </span>
                  ))}
                  <span className="text-xs ml-1" style={{ color: "var(--psg-muted)" }}>
                    {p.team.map((m) => m.user.name.split(" ")[0]).join(", ")}
                  </span>
                </div>
              )}
            </div>
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
                {p.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
