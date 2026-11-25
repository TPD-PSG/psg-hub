// Links into the company spaces (e.g. The Workshop Stoke) from the main PSG Hub, in each space's
// own colours: a button in the top bar on every page, and a banner on the Hub home page.
import Link from "next/link";
import type { SpaceTheme } from "@/lib/spaces";
import { spaceTokens } from "@/lib/spaceTheme";

const accentOf = (s: SpaceTheme) => spaceTokens(s.color)["--tws-accent"];

export function SpaceTopBarLinks({ spaces }: { spaces: SpaceTheme[] }) {
  if (!spaces.length) return null;
  return (
    <nav aria-label="Company spaces" className="flex items-center gap-2">
      {spaces.map(s => (
        <Link key={s.id} href={`/spaces/${s.slug}`} title={`Open ${s.name}`}
          className="flex items-center gap-2 h-9 pl-1 pr-3 text-xs font-bold uppercase tracking-wider shrink-0 hover:brightness-110"
          style={{ backgroundColor: "#1f2226", color: "#fff", borderBottom: `3px solid ${accentOf(s)}` }}>
          {s.logoUrl ? (
            <span className="flex items-center h-7 px-1" style={{ backgroundColor: "#f5f2ec" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
              <img src={s.logoUrl} alt="" className="h-6 w-auto max-w-[60px] object-contain" />
            </span>
          ) : (
            <span className="flex items-center h-7 px-1.5" style={{ backgroundColor: accentOf(s), color: "#24272b" }}>{(s.shortName ?? s.name).toUpperCase()}</span>
          )}
          <span className="hidden md:inline">{s.shortName ? `${s.shortName.toUpperCase()} space` : s.name}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ))}
    </nav>
  );
}

export function SpaceHomeBanners({ spaces }: { spaces: SpaceTheme[] }) {
  if (!spaces.length) return null;
  return (
    <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: spaces.length > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : undefined }}>
      {spaces.map(s => (
        <Link key={s.id} href={`/spaces/${s.slug}`} className="group flex items-center gap-4 px-5 py-4 flex-wrap"
          style={{ backgroundColor: "#1f2226", borderBottom: `4px solid ${accentOf(s)}` }}>
          {s.logoUrl ? (
            <span className="flex items-center px-2 py-1.5 shrink-0" style={{ backgroundColor: "#f5f2ec" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
              <img src={s.logoUrl} alt={`${s.name} logo`} className="h-10 w-auto max-w-[120px] object-contain" />
            </span>
          ) : (
            <span className="px-3 py-2 font-extrabold shrink-0" style={{ backgroundColor: accentOf(s), color: "#24272b" }}>{(s.shortName ?? s.name).toUpperCase()}</span>
          )}
          <span className="flex flex-col flex-1 min-w-[180px]">
            <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.3em", color: spaceTokens(s.color)["--tws-accent-light"] }}>Company space</span>
            <span className="text-lg font-bold text-white">{s.name}</span>
            <span className="text-xs" style={{ color: "#c9ccd1" }}>Builds, planner, materials, noticeboard and build of the month</span>
          </span>
          <span className="px-4 py-2.5 text-sm font-bold shrink-0 group-hover:brightness-110" style={{ backgroundColor: accentOf(s), color: "#24272b" }}>{`Open ${s.shortName ? s.shortName.toUpperCase() : "space"} →`}</span>
        </Link>
      ))}
    </div>
  );
}
