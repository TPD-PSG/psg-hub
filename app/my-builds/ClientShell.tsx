// The client's own top bar in the builder's brand (TWS mockups): logo, name and accent rule,
// with notifications and their account. No Hub menu: clients only have their builds.
import Image from "next/image";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import UserNav from "@/components/UserNav";
import type { SpaceTheme } from "@/lib/spaces";

// nav: the client portal's pages (Builds, Hires) when there's more than one
export default function ClientShell({ brand, company, children, home = "/my-builds", nav }: { brand: SpaceTheme | null; company: string | null; children: React.ReactNode; home?: string; nav?: { href: string; label: string; on?: boolean }[] }) {
  const caps = { fontFamily: "var(--tws-caps-font), var(--tws-font), sans-serif", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase" as const };
  return (
    <div className="tws-shell min-h-screen flex flex-col" style={{ background: "var(--tws-ground)", color: "var(--tws-ink)" }}>
      <header className="h-16 shrink-0 sticky top-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-6"
        style={{ background: "var(--tws-night)", borderBottom: "4px solid var(--tws-accent)" }}>
        <Link href={home} className="flex items-center gap-3.5 min-w-0 no-underline">
          {brand?.logoUrl ? (
            <span className="flex px-2 py-1 shrink-0" style={{ background: "var(--tws-ground)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
              <img src={brand.logoUrl} alt={brand.name} className="h-9 w-auto max-w-[110px] object-contain" />
            </span>
          ) : brand ? (
            <span className="px-2 py-1 font-extrabold text-sm shrink-0" style={{ background: "var(--tws-accent)", color: "var(--tws-ink)" }}>{brand.shortName ?? brand.name}</span>
          ) : (
            <span className="bg-white px-2 py-1 flex shrink-0"><Image src="/psg-logo.png" alt="Production Solutions Group" width={56} height={36} className="object-contain" /></span>
          )}
          <span className="hidden sm:block truncate" style={{ ...caps, color: "var(--tws-accent-light)" }}>{brand ? brand.name : "PSG Hub"}</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {nav && nav.length > 1 && (
            <nav aria-label="Your pages" className="flex gap-1">
              {nav.map(n => <Link key={n.href} href={n.href} aria-current={n.on ? "page" : undefined} className="px-2.5 py-1.5 text-[13px] font-semibold no-underline"
                style={n.on ? { background: "var(--tws-accent)", color: "var(--tws-ink)" } : { color: "var(--tws-nav-ink)" }}>{n.label}</Link>)}
            </nav>
          )}
          {company && <span className="hidden md:block text-[13px] truncate" style={{ color: "var(--tws-nav-ink)" }}>{company}</span>}
          <NotificationBell />
          <UserNav />
        </div>
      </header>
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
