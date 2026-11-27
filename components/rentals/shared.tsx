"use client";
// Pieces shared by the rentals space's pages (PSG Rentals & Crew).
import Link from "next/link";
import type { SpaceTheme } from "@/lib/spaces";
import { alertDialog } from "@/components/Dialogs";
import { muted, pageHeader } from "@/lib/twsUi";

/** JSON call that shows the error and returns null when it fails */
export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T | null> {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { await alertDialog(j.error ?? "That didn't work. Try again."); return null; }
  return j as T;
}

export function RentalsHeader({ space, title, line, children }: { space: SpaceTheme; title: string; line?: string; children?: React.ReactNode }) {
  return (
    <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-3">
      <div className="text-[13px]" style={muted}><Link href={`/spaces/${space.slug}`} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › {title}</div>
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{title}</h1>
          {line && <span className="text-sm" style={muted}>{line}</span>}
        </div>
        {children && <div className="flex gap-3 flex-wrap">{children}</div>}
      </div>
    </header>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className="text-xs font-bold px-2.5 py-1.5"
    style={on ? { background: "var(--tws-char)", color: "#fff", border: "1px solid var(--tws-char)" } : { background: "transparent", color: "var(--tws-ink)", border: "1px solid var(--tws-line)" }}>{children}</button>;
}

export const th: React.CSSProperties = { textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--tws-muted)", padding: "8px 10px", borderBottom: "2px solid var(--tws-line)", whiteSpace: "nowrap" };
export const td: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--tws-line)", fontSize: 14, verticalAlign: "top" };
