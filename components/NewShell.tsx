"use client";

// The new look's shell (build brief stage 3): one sidebar of 11 items in four groups (lib/newLookNav),
// a 64 px icon rail inside a production, a bottom bar on phones (under 900 px) with More for the
// full menu, and search (⌘K / Ctrl K). Same routes and data as the old shell; only the frame differs.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness, CalendarDays, CheckSquare, Clapperboard, Hammer, Home, LayoutGrid, LifeBuoy, Megaphone, PoundSterling, Search, Settings, Share2, Star, Wrench, X,
} from "lucide-react";
import Icon from "@/components/Icon";
import NotificationBell from "@/components/NotificationBell";
import UserNav from "@/components/UserNav";
import { activeKey, navFor, navPages, type NavGroup } from "@/lib/newLookNav";
import { SectionMenu } from "@/components/nl";
import { DEFAULT_HIDDEN_SECTIONS, parsePerms } from "@/lib/permissions";

// A production's sections, grouped as in the brief (same ?section= values as today). Overview comes
// in stage 5; until then a production still opens on Schedule.
const PRODUCTION_GROUPS = [
  { label: "Plan", sections: [{ key: "schedule", label: "Schedule" }, { key: "tour", label: "Tour stops" }, { key: "advancing", label: "Advancing" }, { key: "callsheets", label: "Call sheets" }] },
  { label: "People", sections: [{ key: "crew", label: "Crew" }, { key: "contacts", label: "Contacts" }, { key: "accommodation", label: "Accommodation" }] },
  { label: "Money", sections: [{ key: "budget", label: "Budget" }] },
  { label: "Logistics", sections: [{ key: "haulage", label: "Haulage" }] },
  { label: "Records", sections: [{ key: "documents", label: "Documents" }, { key: "links", label: "Links" }, { key: "hs", label: "Health and safety" }, { key: "reports", label: "Show reports" }] },
  { label: "Work", sections: [{ key: "tasks", label: "Tasks" }, { key: "notes", label: "Notes" }, { key: "meetings", label: "Meetings" }] },
];

const ICONS: Record<string, LucideIcon> = { Home, CheckSquare, Star, Clapperboard, CalendarDays, BriefcaseBusiness, Megaphone, PoundSterling, Wrench, Share2, LifeBuoy, Settings, Hammer };
type Counts = { tasks: number | null; productions: number | null; deals: number | null; finance: number | null };
type Hit = { type: string; label: string; line?: string | null; href: string };
export type ShellSpace = { slug: string; name: string };

export default function NewShell({ spaces, children }: { spaces: ShellSpace[]; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as { role?: string; permissions?: string | null } | undefined;
  const groups = useMemo(() => navFor({ role: user?.role ?? "member", permissions: user?.permissions ?? null }), [user?.role, user?.permissions]);
  const query = useSearchParams()?.toString() ?? "";
  const active = activeKey(groups, pathname, query);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const prodId = pathname.match(/^\/productions\/(\d+)/)?.[1] ?? null;
  const inProduction = !!prodId;
  const section = new URLSearchParams(query).get("section") ?? "schedule";
  // The production's menu: tour stops only for tours; sections hidden for this person's role left out
  const [prod, setProd] = useState<{ id: string; name: string; isTour: boolean; color: string | null } | null>(null);
  useEffect(() => {
    if (!prodId) return;
    let live = true;
    fetch(`/api/productions/${prodId}/summary`).then(r => (r.ok ? r.json() : null)).then(d => { if (live && d) setProd({ id: prodId, name: d.name, isTour: !!d.isTour, color: d.color ?? null }); }).catch(() => {});
    return () => { live = false; };
  }, [prodId]);
  const hidden = useMemo(() => new Set(user?.role === "admin" ? [] : (parsePerms(user?.permissions ?? null).hiddenSections ?? DEFAULT_HIDDEN_SECTIONS[user?.role ?? "member"] ?? [])), [user?.role, user?.permissions]);
  const prodGroups = PRODUCTION_GROUPS
    .map(g => ({ ...g, sections: g.sections.filter(x => !hidden.has(x.key) && (x.key !== "tour" || prod?.id !== prodId || prod.isTour)) }))
    .filter(g => g.sections.length);

  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/nav-counts").then(r => (r.ok ? r.json() : null)).then(d => { if (live && d) setCounts(d); }).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 120_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  // ⌘K / Ctrl K opens search anywhere
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const count = (k?: string) => (k && counts ? (counts as Record<string, number | null>)[k] ?? null : null);

  return (
    <div className="nl-page min-h-screen flex" style={{ background: "var(--nl-bg)" }}>
      {/* Desktop: the sidebar, or the icon rail inside a production */}
      <div className="nl-desktop-nav sticky top-0 h-screen shrink-0" style={{ background: "var(--nl-nav)" }}>
        {inProduction ? (
          <div className="flex h-full">
            <Rail groups={groups} active={active} onSearch={() => setSearch(true)} />
            <SectionMenu groups={prodGroups} active={section} hrefFor={k => `/productions/${prodId}?section=${k}`} color={prod?.color ?? undefined} back={{ href: "/productions", label: "Productions" }} />
          </div>
        ) : (
          <SidebarNav groups={groups} active={active} pathname={pathname} count={count} spaces={spaces} onSearch={() => setSearch(true)} />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top strip: logo on phones, search, notifications, you */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14" style={{ background: "var(--nl-nav)", borderBottom: "1px solid var(--nl-border)" }}>
          <Link href="/" className="nl-phone-only flex items-center gap-2 shrink-0" aria-label="PSG Hub home">
            <Image src="/psg-logo.png" alt="" width={32} height={32} style={{ background: "#fff" }} />
            <span className="nl-caps" style={{ color: "var(--nl-text)" }}>PSG Hub</span>
          </Link>
          <button type="button" onClick={() => setSearch(true)} className="nl-desktop-only nl-search nl-focus" style={{ width: 360, cursor: "text", textAlign: "left" }} aria-label="Search (Ctrl K)">
            <Icon icon={Search} muted />
            <span className="flex-1 text-sm" style={{ color: "var(--nl-text-muted)" }}>Search productions, venues, people…</span>
            <span className="nl-kbd" aria-hidden="true">⌘K</span>
          </button>
          <div className="ml-auto flex items-center"><NotificationBell /><UserNav /></div>
        </header>
        {/* Phones, inside a production: its sections as a picker under the top strip */}
        {inProduction && (
          <div className="nl-phone-only px-4 pt-3">
            <label className="flex flex-col gap-1 w-full">
              <span className="nl-caps">Section</span>
              <select value={section} onChange={e => router.push(`/productions/${prodId}?section=${e.target.value}`)} className="nl-focus"
                style={{ minHeight: 44, background: "var(--nl-panel)", color: "var(--nl-text)", border: "1px solid var(--nl-border)", padding: "0 10px", font: "600 14px var(--nl-font)" }}>
                {prodGroups.map(g => <optgroup key={g.label} label={g.label}>{g.sections.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</optgroup>)}
              </select>
            </label>
          </div>
        )}
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6 md:py-8 nl-main">{children}</main>
      </div>

      {/* Phones: the bottom bar */}
      <nav aria-label="Main" className="nl-phone-only fixed bottom-0 left-0 right-0 z-40 flex" style={{ background: "var(--nl-nav)", borderTop: "1px solid var(--nl-border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {[
          { label: "Home", icon: Home, href: "/", on: active === "home" },
          { label: "Search", icon: Search, onClick: () => setSearch(true) },
          { label: "Productions", icon: Clapperboard, href: groups.some(g => g.items.some(i => i.key === "productions")) ? "/productions" : null, on: active === "productions" },
          { label: "Tasks", icon: CheckSquare, href: groups.some(g => g.items.some(i => i.key === "tasks")) ? "/tasks" : null, on: active === "tasks" },
          { label: "More", icon: LayoutGrid, onClick: () => setMore(true), on: more },
        ].filter(b => b.href !== null).map(b => {
          const inner = <><Icon icon={b.icon} muted={!b.on} /><span className="text-[11px] font-semibold">{b.label}</span></>;
          const style = { minHeight: 56, color: b.on ? "var(--nl-text)" : "var(--nl-text-muted)" } as const;
          return b.href
            ? <Link key={b.label} href={b.href} className="flex-1 flex flex-col items-center justify-center gap-1 nl-focus" aria-current={b.on ? "page" : undefined} style={style}>{inner}</Link>
            : <button key={b.label} type="button" onClick={b.onClick} className="flex-1 flex flex-col items-center justify-center gap-1 nl-focus" style={style}>{inner}</button>;
        })}
      </nav>

      {more && (
        <div className="nl-phone-only fixed inset-0 z-50 overflow-y-auto flex-col" role="dialog" aria-modal="true" aria-label="Menu" style={{ background: "var(--nl-nav)" }}
          onClickCapture={e => { if ((e.target as HTMLElement).closest("a")) setMore(false); }}>
          <div className="flex items-center justify-between px-4 h-14" style={{ borderBottom: "1px solid var(--nl-border)" }}>
            <span className="nl-caps" style={{ color: "var(--nl-text)" }}>Menu</span>
            <button type="button" onClick={() => setMore(false)} aria-label="Close menu" className="nl-focus p-2"><Icon icon={X} /></button>
          </div>
          <SidebarNav groups={groups} active={active} pathname={pathname} count={count} spaces={spaces} expandAll />
        </div>
      )}

      {search && <SearchPalette groups={groups} onClose={() => setSearch(false)} />}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarNav({ groups, active, pathname, count, spaces, onSearch, expandAll = false }: {
  groups: NavGroup[]; active: string | null; pathname: string; count: (k?: string) => number | null; spaces: ShellSpace[]; onSearch?: () => void; expandAll?: boolean;
}) {
  const [href, setHref] = useState("");
  useEffect(() => { setHref(`${pathname}${window.location.search}`); }, [pathname]); // eslint-disable-line react-hooks/set-state-in-effect -- the query string is only known in the browser
  return (
    <nav aria-label="Main" className="flex flex-col gap-4 py-4 h-full overflow-y-auto" style={{ width: expandAll ? "100%" : 248 }}>
      {!expandAll && (
        <Link href="/" className="flex items-center gap-2.5 px-4 pb-1 nl-focus" aria-label="PSG Hub home">
          <Image src="/psg-logo.png" alt="" width={34} height={34} style={{ background: "#fff" }} />
          <span className="nl-caps" style={{ color: "var(--nl-text)", fontSize: 12 }}>PSG Hub</span>
        </Link>
      )}
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col">
          {g.label && <span className="nl-caps px-4 pb-1.5">{g.label}</span>}
          {g.items.map(i => {
            const on = active === i.key;
            const c = count(i.count);
            return (
              <div key={i.key}>
                <Link href={i.href} className="nl-navitem" aria-current={on ? "page" : undefined}>
                  <Icon icon={ICONS[i.icon] ?? Home} muted={!on} />
                  <span className="truncate">{i.label}</span>
                  {c != null && c > 0 && <span className="nl-count" aria-label={`${c}`}>{c}</span>}
                </Link>
                {/* An item's pages show under it while you're in it (so anything is two clicks away) */}
                {(on || expandAll) && i.subs && i.subs.length > 1 && (
                  <div className="flex flex-col pb-1">
                    {i.subs.map(s => {
                      const sOn = href === s.href || (!s.href.includes("?") && href === s.href);
                      return <Link key={s.href} href={s.href} className="nl-navitem" aria-current={sOn ? "page" : undefined} style={{ minHeight: 32, paddingLeft: 46, fontSize: 13, borderLeftColor: "transparent", background: "transparent", color: sOn ? "var(--nl-text)" : undefined }}>{s.label}</Link>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {spaces.length > 0 && (
        <div className="flex flex-col">
          <span className="nl-caps px-4 pb-1.5">Spaces</span>
          {spaces.map(s => (
            <Link key={s.slug} href={`/spaces/${s.slug}`} className="nl-navitem"><Icon icon={Hammer} muted /><span className="truncate">{s.name}</span></Link>
          ))}
        </div>
      )}
      {onSearch && <span className="sr-only"><button type="button" onClick={onSearch}>Search</button></span>}
    </nav>
  );
}

/** Inside a production: icons only, so the production's own menu can sit beside it (stage 5). */
function Rail({ groups, active, onSearch }: { groups: NavGroup[]; active: string | null; onSearch: () => void }) {
  return (
    <nav aria-label="Main" className="nl-rail h-full">
      <Link href="/" aria-label="PSG Hub home" className="mb-2"><Image src="/psg-logo.png" alt="" width={30} height={30} style={{ background: "#fff" }} /></Link>
      <button type="button" onClick={onSearch} aria-label="Search" className="nl-focus" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon icon={Search} muted /></button>
      {groups.flatMap(g => g.items).map(i => (
        <Link key={i.key} href={i.href} aria-label={i.label} aria-current={active === i.key ? "page" : undefined}>
          <Icon icon={ICONS[i.icon] ?? Home} muted={active !== i.key} />
          <span className="nl-tip" aria-hidden="true">{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

const RECENT_KEY = "nl-recent-search";
function readRecent(): Hit[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; } }

function SearchPalette({ groups, onClose }: { groups: NavGroup[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [server, setServer] = useState<{ q: string; results: Hit[] }>({ q: "", results: [] });
  const [recent] = useState<Hit[]>(() => (typeof window === "undefined" ? [] : readRecent()));
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pages = useMemo(() => navPages(groups), [groups]);

  useEffect(() => { input.current?.focus(); }, []);
  const text = q.trim().toLowerCase();
  // Pages from the menu match straight away; everything else comes from the server
  const pageHits: Hit[] = useMemo(() => (text.length < 2 ? [] : pages.filter(p => p.words.includes(text) || p.label.toLowerCase().includes(text)).slice(0, 5).map(p => ({ type: "Pages", label: p.label, href: p.href }))), [text, pages]);
  useEffect(() => {
    if (text.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(text)}`, { signal: ctl.signal }).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.results) setServer({ q: text, results: d.results }); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text]);

  const list = text.length >= 2 ? [...pageHits, ...(server.q === text ? server.results : [])] : recent;
  const go = useCallback((h: Hit) => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([h, ...readRecent().filter(r => r.href !== h.href)].slice(0, 6))); } catch { /* not remembered */ }
    onClose();
    router.push(h.href);
  }, [onClose, router]);

  // Grouped by type, in the order the types first appear
  const types = [...new Set(list.map(h => h.type))];
  let n = -1;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" style={{ background: "rgba(0,4,30,0.7)" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-xl flex flex-col" style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-border)", maxHeight: "70vh" }}
        onKeyDown={e => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
          else if (e.key === "Enter" && list[sel]) { e.preventDefault(); go(list[sel]); }
        }}>
        <label className="nl-search" style={{ border: 0, borderBottom: "1px solid var(--nl-border)", minHeight: 52 }}>
          <Icon icon={Search} muted />
          <span className="sr-only">Search</span>
          <input ref={input} type="search" value={q} onChange={e => { setQ(e.target.value); setSel(0); }} placeholder="Search productions, venues, people, invoices, pages…" />
          <span className="nl-kbd" aria-hidden="true">Esc</span>
        </label>
        <div className="overflow-y-auto py-2" role="listbox" aria-label="Results">
          {list.length === 0 && <p className="m-0 px-4 py-3 text-sm" style={{ color: "var(--nl-text-muted)" }}>{q.trim().length >= 2 ? "Nothing found." : "Type to search. Recent items show here."}</p>}
          {q.trim().length < 2 && list.length > 0 && <span className="nl-caps px-4 pt-1 pb-1 block">Recent</span>}
          {types.map(type => (
            <div key={type}>
              {q.trim().length >= 2 && <span className="nl-caps px-4 pt-2 pb-1 block">{type}</span>}
              {list.filter(h => h.type === type).map(h => {
                n++;
                const idx = n, on = idx === sel;
                return (
                  <button key={`${h.type}${h.href}${h.label}`} type="button" role="option" aria-selected={on} onMouseEnter={() => setSel(idx)} onClick={() => go(h)}
                    className="w-full text-left flex items-baseline gap-3 px-4 py-2" style={{ background: on ? "var(--nl-panel-active)" : "transparent", color: "var(--nl-text)" }}>
                    <span className="font-semibold truncate">{h.label}</span>
                    {h.line && <span className="text-xs truncate" style={{ color: "var(--nl-text-muted)" }}>{h.line}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
