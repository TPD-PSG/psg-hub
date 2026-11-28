"use client";

// The new look's Home (build brief stage 4). It answers three questions in order: what needs me,
// what's happening now, and where do I go next. Full width. The panels follow the person's Home
// role (director, PM, office; set by admins in Users), never a switch on the page.
// Built only from the shared components (components/nl). No cash or bank figures for any role.
import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness, CalendarDays, CheckSquare, Clapperboard, Hammer, Home as HomeIcon, LifeBuoy, Megaphone, PartyPopper, PoundSterling, Settings, Share2, Star, Wrench,
} from "lucide-react";
import { Button, Chip, EmptyState, ListRow, NeedsYou, Panel, PinnedShortcut, SearchField, SpaceCard, StatTile } from "@/components/nl";
import { navFor, navPages } from "@/lib/newLookNav";
import type { HomeData } from "@/lib/newHome";

const ICONS: Record<string, LucideIcon> = { Home: HomeIcon, CheckSquare, Star, Clapperboard, CalendarDays, BriefcaseBusiness, Megaphone, PoundSterling, Wrench, Share2, LifeBuoy, PartyPopper, Settings, Hammer };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const k = (n: number) => (n >= 1e6 ? `£${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `£${Math.round(n / 1e3)}k` : `£${Math.round(n)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function NewHome({ viewer, data }: { viewer: { name: string; role: string; permissions: string | null }; data: HomeData }) {
  const groups = useMemo(() => navFor({ role: viewer.role, permissions: viewer.permissions }), [viewer.role, viewer.permissions]);
  const pages = useMemo(() => navPages(groups), [groups]);
  const [pins, setPins] = useState(data.pins);
  const [editing, setEditing] = useState(false);
  // Needs you: hiding a line takes it off Home (not done, just hidden) until it changes
  const [needs, setNeeds] = useState(data.needs);
  const [hiddenNeeds, setHiddenNeeds] = useState(data.hiddenNeeds);
  const hideNeed = async (i: number) => {
    const n = needs[i];
    if (!n) return;
    setNeeds(ns => ns.filter(x => x.key !== n.key)); setHiddenNeeds(h => h + 1);
    const res = await fetch("/api/me/needs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: n.key, version: n.version }) }).catch(() => null);
    if (!res?.ok) { setNeeds(data.needs.filter(x => x.key === n.key || needs.some(y => y.key === x.key))); setHiddenNeeds(h => h - 1); }
  };
  const showHidden = async () => { const res = await fetch("/api/me/needs", { method: "DELETE" }).catch(() => null); if (res?.ok) window.location.reload(); };
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = viewer.name.split(" ")[0] ?? "";
  const countLine = [data.showsToday ? `${plural(data.showsToday, "show")} on today` : "No shows on today", needs.length ? `${plural(needs.length, "thing")} need${needs.length === 1 ? "s" : ""} you` : null].filter(Boolean).join(" · ");
  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));

  // A pin's label and icon come from the menu (only pages this person can open are offered)
  const pinInfo = (href: string) => {
    const page = pages.find(p => p.href === href);
    const entry = groups.flatMap(g => g.items).find(i => i.href === href || i.subs?.some(s => s.href === href));
    return page ? { label: page.label, icon: ICONS[entry?.icon ?? "Home"] ?? HomeIcon } : null;
  };
  const shownPins = pins.map(h => ({ href: h, info: pinInfo(h) })).filter((p): p is { href: string; info: { label: string; icon: LucideIcon } } => !!p.info);

  async function savePins(next: string[] | null) {
    const res = await fetch("/api/me/pinned", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hrefs: next }) });
    if (res.ok) { if (next) setPins(next); setEditing(false); if (!next) window.location.reload(); }
  }

  return (
    <div className="nl-home flex flex-col gap-5">
      {/* 1. Greeting, date, one-line count; search on the right */}
      <div className="nl-o-0 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0" style={{ fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>{greeting}, {first}</h1>
          <p className="m-0 mt-1 text-sm" style={{ color: "var(--nl-text-muted)" }}>
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {countLine}
          </p>
        </div>
        <div className="w-full sm:w-80"><SearchField placeholder="Search the Hub" onFocus={openSearch} /></div>
      </div>

      {/* 2. Needs you (hidden completely when nothing needs the person and nothing's hidden) */}
      <div className="nl-o-1"><NeedsYou items={needs.slice(0, 8).map(n => ({ href: n.href, text: n.text, when: n.when }))} onHide={hideNeed} hidden={hiddenNeeds} onShowHidden={showHidden} /></div>

      {/* 3. Space cards */}
      <div className="nl-o-7 grid gap-3 md:grid-cols-3">
        <SpaceCard href="/productions" name="Production Solutions Group" line={data.director.live ? `${plural(data.director.live, "live show")}` : "Nothing on"} />
        {data.spaces.map(s => (
          <SpaceCard key={s.slug} href={`/spaces/${s.slug}`} name={s.name} line={s.kind === "rentals" ? (s.hires ? `${plural(s.hires, "hire")} confirmed or out` : "No hires booked") : s.builds ? `${plural(s.builds, "build")} in the workshop` : "Nothing in the workshop"}
            ground="#f4efe6" ink="#1a1d21" rule={s.color ?? "#c49a6c"}
            /* eslint-disable-next-line @next/next/no-img-element -- the space's own logo */
            logo={s.logoUrl ? <img src={s.logoUrl} alt="" width={44} height={44} style={{ objectFit: "contain", width: 44, height: 44 }} /> : undefined} />
        ))}
        {!data.spaces.some(s => s.kind === "rentals") && <div className="flex items-center gap-4 p-4" style={{ background: "var(--nl-panel)", border: "1px dashed var(--nl-border)" }} aria-label="Rentals and Crew: coming">
          <span className="flex flex-col min-w-0">
            <span className="font-extrabold">Rentals &amp; Crew</span>
            <span className="text-[13px]" style={{ color: "var(--nl-text-muted)" }}>Coming</span>
          </span>
          <span className="ml-auto"><Chip>Coming</Chip></span>
        </div>}
      </div>

      {/* 4. Role panel */}
      <div className="nl-o-4">
        {data.homeRole === "director" && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Live shows" value={data.director.live} line={data.director.live ? "In production now" : "Nothing on"} href="/productions" />
            {data.director.pipeline != null
              ? <StatTile label="Weighted pipeline" value={k(data.director.pipeline)} line={plural(data.director.openDeals, "open deal")} href="/bd" />
              : <StatTile label="Weighted pipeline" value="—" line="BD isn't in your areas" />}
            <StatTile label="Out this week" value={data.director.outThisWeek} line={data.director.outNames.length ? data.director.outNames.join(", ") : "No get-outs this week"} href="/calendar" />
            <StatTile label="Next key date" value={data.director.nextKey ? day(data.director.nextKey.at) : "—"} line={data.director.nextKey ? `${data.director.nextKey.title}` : "Nothing coming up"} href={data.director.nextKey?.href} />
          </div>
        )}
        {data.homeRole === "pm" && (
          <Panel title="My productions" more={{ href: "/productions?mine=1", label: "All of mine" }} pad={data.mine.length === 0}>
            {data.mine.length === 0 ? <EmptyState title="You're not on any shows yet" line="Shows you're on the team for appear here, with their next key moment." /> : (
              <div className="grid gap-px md:grid-cols-2" style={{ background: "var(--nl-border)" }}>
                {data.mine.slice(0, 6).map(p => (
                  <Link key={p.id} href={`/productions/${p.id}`} className="nl-focus flex flex-col gap-1 p-4 min-w-0" style={{ background: "var(--nl-panel)", borderLeft: `4px solid ${p.color ?? "var(--nl-accent)"}`, color: "var(--nl-text)", textDecoration: "none" }}>
                    <span className="font-bold truncate">{p.name}</span>
                    <span className="text-xs truncate" style={{ color: "var(--nl-text-muted)" }}>{p.venue ?? "No venue yet"}</span>
                    <span className="text-xs truncate">{p.next ? `${day(p.next.at)} · ${p.next.title}` : "Nothing dated next"}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}
        {data.homeRole === "office" && data.office && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Expenses to approve" value={data.office.expenses} line={data.office.expenses ? "Waiting in Finance" : "All approved"} href="/finance?tab=expenses" tone={data.office.expenses ? "warn" : undefined} />
            <StatTile label="Invoices to chase" value={data.office.invoicesToChase} line={data.office.invoicesToChase ? "Past their due date" : "Nothing overdue"} href="/finance" tone={data.office.invoicesToChase ? "bad" : undefined} />
            <StatTile label="Cockshute issues" value={data.office.cockshute} line={data.office.cockshute ? "Open maintenance" : "Nothing open"} href="/property" />
            <StatTile label="H&S reports" value={data.office.hs} line={data.office.hs ? "Open reports" : "Nothing open"} href="/health-safety" />
          </div>
        )}
      </div>

      {/* 5. On today (3/5) and Coming up (2/5) */}
      <div className="nl-o-2 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 min-w-0">
          <Panel title="On today" more={{ href: "/calendar", label: "Calendar" }} pad={data.today.length === 0}>
            {data.today.length === 0 ? <EmptyState title="Nothing on today" line="Shows, get-ins and tour stops on today's date appear here." /> :
              data.today.slice(0, 8).map(e => <ListRow key={e.id} href={e.productionId ? `/productions/${e.productionId}?section=schedule` : e.href ?? "/calendar"} dot={e.color} title={e.production ?? e.title} line={[e.title !== e.production ? e.title : null, e.venue && !e.title.includes(e.venue) ? e.venue : null].filter(Boolean).join(" · ")} />)}
          </Panel>
        </div>
        <div className="lg:col-span-2 min-w-0 nl-o-3">
          <Panel title="Coming up" more={{ href: "/calendar", label: "Calendar" }} pad={data.comingUp.length === 0}>
            {data.comingUp.length === 0 ? <EmptyState title="Nothing in the next 30 days" line="Key dates and tour stops show here as they come up." /> :
              data.comingUp.map(e => <ListRow key={e.id} href={e.productionId ? `/productions/${e.productionId}?section=schedule` : e.href ?? "/calendar"} dot={e.color} title={e.title} line={[day(e.startDate), e.production !== e.title ? e.production : null].filter(Boolean).join(" · ")} />)}
          </Panel>
        </div>
      </div>

      {/* 6. Companies (directors) or My tasks, beside Pinned */}
      <div className="nl-contents grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 min-w-0 nl-o-8">
          {data.companies ? (
            <Panel title="Companies" more={{ href: "/director", label: "Director dashboard" }} pad={false}>
              {data.companies.length === 0 ? <EmptyState title="No companies yet" /> : data.companies.map(c => (
                <ListRow key={c.name} href={c.spaceSlug ? `/spaces/${c.spaceSlug}` : "/director"} title={c.name}
                  line={c.live || c.pipeline?.open || c.next14 ? [`${plural(c.live, "live show")}`, c.pipeline && data.seeBd ? `${k(c.pipeline.weighted)} pipeline` : null, `${plural(c.next14, "date")} in the next 14 days`].filter(Boolean).join(" · ") : "Nothing on"} />
              ))}
            </Panel>
          ) : (
            <Panel title="My tasks" more={{ href: "/tasks", label: "All tasks" }} pad={data.tasks.length === 0}>
              {data.tasks.length === 0 ? <EmptyState title="Nothing on your list" line="Tasks from meetings and minutes land here." /> :
                data.tasks.map(t => <ListRow key={t.id} href={`/tasks?highlight=${t.id}`} title={t.title} line={[t.production?.name, t.dueDate ? `Due ${day(t.dueDate)}` : null].filter(Boolean).join(" · ")}
                  chip={t.dueDate && new Date(t.dueDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? <Chip tone="bad">Overdue</Chip> : undefined} />)}
            </Panel>
          )}
        </div>
        <div className="lg:col-span-2 min-w-0 nl-o-5">
          <Panel title="Pinned">
            <div className="flex justify-end -mt-9 mb-3"><button type="button" onClick={() => setEditing(v => !v)} className="text-xs font-semibold nl-focus" style={{ color: "var(--nl-accent)" }}>{editing ? "Done" : "Edit"}</button></div>
            {editing ? (
              <PinPicker pages={pages} chosen={pins} onSave={savePins} />
            ) : shownPins.length === 0 ? <EmptyState title="No shortcuts pinned" line="Pin up to six pages you use most." /> : (
              <div className="grid gap-2 grid-cols-2">{shownPins.map(p => <PinnedShortcut key={p.href} href={p.href} icon={p.info.icon} label={p.info.label} />)}</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Choose up to six pages from the menu. */
function PinPicker({ pages, chosen, onSave }: { pages: { label: string; href: string }[]; chosen: string[]; onSave: (h: string[] | null) => void }) {
  const [pick, setPick] = useState(chosen.filter(h => pages.some(p => p.href === h)));
  const toggle = (h: string) => setPick(p => (p.includes(h) ? p.filter(x => x !== h) : p.length >= 6 ? p : [...p, h]));
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs" style={{ color: "var(--nl-text-muted)" }}>{pick.length} of 6 chosen</span>
      <div className="flex flex-col max-h-72 overflow-y-auto" style={{ border: "1px solid var(--nl-border)" }}>
        {pages.map(p => (
          <label key={p.href} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer" style={{ borderTop: "1px solid var(--nl-border)" }}>
            <input type="checkbox" checked={pick.includes(p.href)} disabled={!pick.includes(p.href) && pick.length >= 6} onChange={() => toggle(p.href)} />
            {p.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onSave(pick)}>Save</Button>
        <Button kind="outline" onClick={() => onSave(null)}>Back to the defaults</Button>
      </div>
    </div>
  );
}
