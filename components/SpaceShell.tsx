"use client";

// The frame around every page in a company space: night-dark top bar with an accent rule and
// the company's logo, a dark sidebar of the space's own tools, and "Shared with PSG" links.
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import UserNav from "@/components/UserNav";
import type { SpaceTheme } from "@/lib/spaces";

const capsFont = "var(--tws-caps-font), var(--tws-font), sans-serif";

export default function SpaceShell({ space, children }: { space: SpaceTheme; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [menu, setMenu] = useState(false);
  const base = `/spaces/${space.slug}`;
  const own = [
    { href: base, label: "Home" },
    { href: `${base}/board`, label: "Build board" },
    { href: `${base}/jobs`, label: "Build jobs" },
    { href: `${base}/planner`, label: "Planner" },
    { href: `${base}/quotes`, label: "Quotes" },
    { href: `${base}/materials`, label: "Materials & kit" },
    { href: `${base}/storage`, label: "Storage" },
    { href: `${base}/noticeboard`, label: "Noticeboard" },
    { href: `${base}/fun`, label: "Fun Corner" },
    { href: `${base}/roadmap`, label: "Roadmap" },
  ];
  const shared = [
    { href: "/tasks", label: "My tasks" }, { href: "/calendar", label: "Calendar" },
    { href: "/helpdesk", label: "Help desk" },
  ];
  const active = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
  const name = space.name.toUpperCase();

  const nav = (
    <nav aria-label={space.name} className="flex flex-col gap-6 py-5 h-full">
      <span className="px-6 text-[15px] font-extrabold text-white">{space.name}</span>
      <div className="flex flex-col">
        {own.map(i => {
          const on = active(i.href);
          return (
            <Link key={i.href} href={i.href} onClick={() => setMenu(false)} aria-current={on ? "page" : undefined}
              className="px-6 py-2.5 text-sm no-underline" style={on
                ? { color: "#fff", fontWeight: 700, background: "var(--tws-char-hi)", borderLeft: "4px solid var(--tws-accent)", paddingLeft: 20 }
                : { color: "var(--tws-nav-ink)" }}>{i.label}</Link>
          );
        })}
      </div>
      <div className="flex flex-col">
        <span className="px-6 pb-2" style={{ fontFamily: capsFont, fontSize: 11, letterSpacing: "0.3em", color: "var(--tws-accent)" }}>SHARED WITH PSG</span>
        {shared.map(i => <Link key={i.href} href={i.href} className="px-6 py-2.5 text-sm" style={{ color: "var(--tws-nav-ink)" }}>{i.label}</Link>)}
      </div>
      <Link href="/?all=1" className="mt-auto px-6 pt-4 flex items-center gap-2.5 text-[13px]" style={{ borderTop: "1px solid var(--tws-char-hi)", color: "var(--tws-nav-ink)" }}>
        <span aria-hidden="true">←</span>
        <span className="bg-white px-1 py-0.5 flex"><Image src="/psg-logo.png" alt="" width={34} height={22} className="object-contain" /></span>
        PSG Hub home
      </Link>
    </nav>
  );

  return (
    <div className="tws-shell min-h-screen flex flex-col" style={{ background: "var(--tws-ground)", color: "var(--tws-ink)" }}>
      {/* Top bar */}
      <header className="h-16 shrink-0 sticky top-0 z-40 flex items-center justify-between gap-3 px-3 sm:px-6"
        style={{ background: "var(--tws-night)", borderBottom: "4px solid var(--tws-accent)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setMenu(m => !m)} aria-label="Open menu" aria-expanded={menu} className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5">
            {[0, 1, 2].map(i => <span key={i} className="w-5 h-0.5" style={{ background: "var(--tws-nav-ink)" }} />)}
          </button>
          <Link href={base} className="flex items-center gap-3.5 min-w-0 no-underline">
            {space.logoUrl ? (
              <span className="flex px-2 py-1 shrink-0" style={{ background: "var(--tws-ground)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
                <img src={space.logoUrl} alt={space.name} className="h-9 w-auto max-w-[110px] object-contain" />
              </span>
            ) : (
              <span className="px-2 py-1 font-extrabold text-sm shrink-0" style={{ background: "var(--tws-accent)", color: "var(--tws-ink)" }}>{space.shortName ?? space.name}</span>
            )}
            <span className="hidden sm:block truncate" style={{ fontFamily: capsFont, fontSize: 12, letterSpacing: "0.3em", color: "var(--tws-accent-light)" }}>{name}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/?all=1" className="hidden sm:flex items-center gap-2 text-[13px]" style={{ color: "var(--tws-nav-ink)" }}>
            <span className="bg-white px-1 py-0.5 flex"><Image src="/psg-logo.png" alt="" width={30} height={20} className="object-contain" /></span>PSG Hub
          </Link>
          <NotificationBell />
          <UserNav />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block w-[240px] shrink-0" style={{ background: "var(--tws-night)" }}>
          <div className="sticky top-16">{nav}</div>
        </aside>
        {menu && (
          <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="w-[260px] max-w-[85vw] h-full overflow-y-auto" style={{ background: "var(--tws-night)" }}>{nav}</div>
            <button type="button" aria-label="Close menu" className="flex-1" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMenu(false)} />
          </div>
        )}
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
