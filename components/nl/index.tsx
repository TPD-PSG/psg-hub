"use client";

// New look shared components (build brief stage 2, 28 Nov 2026). Every page in the new look is
// built only from these. They read the --nl-* tokens (app/new-look.css), so they only look right
// inside the new look (or a .nl-scope wrapper). No emoji: icons are the Lucide set via <Icon>.
// Square corners throughout; only avatars are round.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Search as SearchIcon } from "lucide-react";
import Icon from "@/components/Icon";

// ── Navigation ────────────────────────────────────────────────────────────────

/** A sidebar item: icon, label, an optional count, and the active state. */
export function NavItem({ href, icon, label, count, active = false }: { href: string; icon: LucideIcon; label: string; count?: number | null; active?: boolean }) {
  return (
    <Link href={href} className="nl-navitem" aria-current={active ? "page" : undefined}>
      <Icon icon={icon} muted={!active} />
      <span className="truncate">{label}</span>
      {count != null && count > 0 && <span className="nl-count" aria-label={`${count} open`}>{count}</span>}
    </Link>
  );
}

/** The sidebar: groups of nav items under small-caps labels. */
export function Sidebar({ groups, footer }: { groups: { label?: string; items: React.ReactNode }[]; footer?: React.ReactNode }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 py-4 h-full" style={{ width: 248, background: "var(--nl-nav)" }}>
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col">
          {g.label && <span className="nl-caps px-4 pb-2">{g.label}</span>}
          {g.items}
        </div>
      ))}
      {footer && <div className="mt-auto">{footer}</div>}
    </nav>
  );
}

/** The 64 px icon rail used inside a production: icons only, the label as a tooltip. */
export function IconRail({ items }: { items: { href: string; icon: LucideIcon; label: string; active?: boolean }[] }) {
  return (
    <nav aria-label="Main" className="nl-rail">
      {items.map(i => (
        <Link key={i.label} href={i.href} aria-label={i.label} aria-current={i.active ? "page" : undefined}>
          <Icon icon={i.icon} muted={!i.active} />
          <span className="nl-tip" aria-hidden="true">{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** A grouped section menu (inside a production): small-caps group labels, the active section marked
 *  in the production's own colour. */
export function SectionMenu({ groups, active, hrefFor, color = "var(--nl-accent)", back }: {
  groups: { label: string; sections: { key: string; label: string }[] }[]; active: string; hrefFor: (key: string) => string; color?: string; back?: { href: string; label: string };
}) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-4 py-4" style={{ width: 220, background: "var(--nl-nav)", borderRight: "1px solid var(--nl-border)" }}>
      {back && <Link href={back.href} className="nl-navitem" style={{ minHeight: 32 }}>← {back.label}</Link>}
      {groups.map(g => (
        <div key={g.label} className="flex flex-col">
          <span className="nl-caps px-4 pb-1.5">{g.label}</span>
          {g.sections.map(s => (
            <Link key={s.key} href={hrefFor(s.key)} className="nl-navitem" aria-current={s.key === active ? "page" : undefined}
              style={{ minHeight: 36, fontSize: 13, ...(s.key === active ? { borderLeftColor: color } : {}) }}>
              {s.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

// ── Page furniture ────────────────────────────────────────────────────────────

/** Round initials (or photo) for a person; the only round thing in the new look. */
export function Avatar({ name, src, size = 28, color }: { name: string; src?: string | null; size?: number; color?: string | null }) {
  const initials = name.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span title={name} className="inline-flex items-center justify-center overflow-hidden shrink-0 font-bold"
      style={{ width: size, height: size, borderRadius: "50%", fontSize: size * 0.38, background: color ?? "var(--nl-panel-active)", color: "var(--nl-text)", border: "2px solid var(--nl-nav)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- our own avatars */}
      {src ? <img src={src} alt="" width={size} height={size} style={{ objectFit: "cover", width: size, height: size }} /> : initials}
    </span>
  );
}

/** A small status chip. tone: warn (amber), good, bad, or plain. */
export function Chip({ children, tone, dot }: { children: React.ReactNode; tone?: "warn" | "good" | "bad"; dot?: string }) {
  return (
    <span className={`nl-chip${tone ? ` nl-chip-${tone}` : ""}`}>
      {dot && <span className="nl-dot" style={{ background: dot, width: 8, height: 8 }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A page header: title, status chips, team avatars and actions. */
export function PageHeader({ title, eyebrow, chips, team, actions, art }: {
  title: string; eyebrow?: React.ReactNode; chips?: React.ReactNode; team?: { name: string; src?: string | null }[]; actions?: React.ReactNode; art?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 px-6 py-5" style={{ background: "var(--nl-nav)", borderBottom: "1px solid var(--nl-border)" }}>
      {art}
      <div className="flex flex-col gap-1.5 min-w-0">
        {eyebrow && <span className="nl-caps">{eyebrow}</span>}
        <h1 className="m-0 truncate" style={{ fontSize: 26, lineHeight: "32px", fontWeight: 800 }}>{title}</h1>
        {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
      </div>
      {team && team.length > 0 && (
        <div className="flex items-center" aria-label={`Team: ${team.map(t => t.name).join(", ")}`}>
          {team.slice(0, 5).map((t, i) => <span key={t.name} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={t.name} src={t.src} /></span>)}
          {team.length > 5 && <span className="nl-caps ml-2">+{team.length - 5}</span>}
        </div>
      )}
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** A panel: title, an optional "more →" link, and its body. */
export function Panel({ title, more, children, pad = true }: { title?: string; more?: { href: string; label?: string }; children: React.ReactNode; pad?: boolean }) {
  return (
    <section className="nl-panel flex flex-col min-w-0" aria-label={title}>
      {(title || more) && (
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          {title && <h2 className="nl-caps m-0">{title}</h2>}
          {more && <Link href={more.href} className="ml-auto text-xs font-semibold nl-focus" style={{ color: "var(--nl-accent)" }}>{more.label ?? "More"} →</Link>}
        </div>
      )}
      <div className={pad ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

/** A stat tile: label, value, one line under it. */
export function StatTile({ label, value, line, href, tone }: { label: string; value: React.ReactNode; line?: React.ReactNode; href?: string; tone?: "good" | "bad" | "warn" }) {
  const body = (
    <>
      <span className="nl-caps">{label}</span>
      <span style={{ fontSize: 28, lineHeight: "34px", fontWeight: 800, color: tone ? `var(--nl-${tone})` : "var(--nl-text)" }}>{value}</span>
      {line && <span className="text-[13px] truncate" style={{ color: "var(--nl-text-muted)" }}>{line}</span>}
    </>
  );
  const style: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, padding: 16, minWidth: 0, textDecoration: "none", color: "inherit" };
  return href ? <Link href={href} className="nl-panel nl-focus" style={style}>{body}</Link> : <div className="nl-panel" style={style}>{body}</div>;
}

/** A list row: colour dot, title, a line under it, a status chip and a link. */
export function ListRow({ href, dot, title, line, chip, end }: { href?: string; dot?: string | null; title: React.ReactNode; line?: React.ReactNode; chip?: React.ReactNode; end?: React.ReactNode }) {
  const body = (
    <>
      {dot !== undefined && <span className="nl-dot" style={{ background: dot ?? "var(--nl-border)" }} aria-hidden="true" />}
      <span className="flex flex-col min-w-0">
        <span className="font-semibold truncate">{title}</span>
        {line && <span className="text-xs truncate" style={{ color: "var(--nl-text-muted)" }}>{line}</span>}
      </span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {chip}
        {end}
        {href && <Icon icon={ChevronRight} size={16} muted />}
      </span>
    </>
  );
  return href ? <Link href={href} className="nl-row">{body}</Link> : <div className="nl-row">{body}</div>;
}

/** "Needs you": the amber strip of things waiting for this person. Renders nothing when empty. */
export function NeedsYou({ items }: { items: { href: string; text: React.ReactNode; when?: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Needs you" style={{ background: "var(--nl-warn-bg)", border: "1px solid var(--nl-warn-border)" }}>
      <h2 className="nl-caps m-0 px-4 pt-3 pb-1" style={{ color: "var(--nl-warn)" }}>Needs you · {items.length}</h2>
      <ul className="m-0 p-0 list-none">
        {items.map((it, i) => (
          <li key={i}>
            <Link href={it.href} className="nl-row nl-focus" style={{ borderTopColor: "rgba(201,154,58,0.35)", color: "var(--nl-warn)" }}>
              <span className="min-w-0 truncate font-semibold">{it.text}</span>
              {it.when && <span className="ml-auto text-xs shrink-0">{it.when}</span>}
              <Icon icon={ChevronRight} size={16} className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A company space card (PSG, The Workshop Stoke…): its own colours, one line and a link. */
export function SpaceCard({ href, name, line, logo, ground = "var(--nl-panel)", ink = "var(--nl-text)", rule }: {
  href: string; name: string; line: string; logo?: React.ReactNode; ground?: string; ink?: string; rule?: string;
}) {
  return (
    <Link href={href} className="nl-focus flex items-center gap-4 p-4 min-w-0" style={{ background: ground, color: ink, border: "1px solid var(--nl-border)", borderBottom: rule ? `4px solid ${rule}` : undefined, textDecoration: "none" }}>
      {logo}
      <span className="flex flex-col min-w-0">
        <span className="font-extrabold truncate">{name}</span>
        <span className="text-[13px] truncate" style={{ opacity: 0.85 }}>{line}</span>
      </span>
      <ChevronRight size={18} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" className="ml-auto shrink-0" />
    </Link>
  );
}

/** A pinned shortcut. */
export function PinnedShortcut({ href, icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return <Link href={href} className="nl-pin"><Icon icon={icon} />{label}</Link>;
}

// ── Controls ──────────────────────────────────────────────────────────────────

/** A segmented control (a few options, one chosen). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="nl-seg" role="group" aria-label={label}>
      {options.map(o => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/** The search field (⌘K / Ctrl K opens search in the shell). */
export function SearchField({ value, onChange, placeholder = "Search", onFocus, shortcut = true, label = "Search" }: {
  value?: string; onChange?: (v: string) => void; placeholder?: string; onFocus?: () => void; shortcut?: boolean; label?: string;
}) {
  return (
    <label className="nl-search">
      <Icon icon={SearchIcon} muted />
      <span className="sr-only">{label}</span>
      <input type="search" value={value} onChange={onChange ? e => onChange(e.target.value) : undefined} onFocus={onFocus} placeholder={placeholder} readOnly={!onChange} />
      {shortcut && <span className="nl-kbd" aria-hidden="true">⌘K</span>}
    </label>
  );
}

/** Buttons: primary (one per page) and outline. A link when given href. */
export function Button({ kind = "primary", href, children, icon, ...rest }: { kind?: "primary" | "outline"; href?: string; icon?: LucideIcon; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `nl-btn nl-btn-${kind}`;
  const I = icon; // in the button's own text colour (the accent icon would vanish on a primary button)
  const inner = <>{I && <I size={16} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" />}{children}</>;
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

/** An empty state that says what will appear, and how to add it. */
export function EmptyState({ title, line, action }: { title: string; line?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-6">
      <span className="font-bold">{title}</span>
      {line && <span className="text-sm" style={{ color: "var(--nl-text-muted)" }}>{line}</span>}
      {action}
    </div>
  );
}
