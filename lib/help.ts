// Help guides (28 Nov 2026, as in x-over): one Markdown file per guide in content/help/<slug>.md
// with a short header:
//   ---
//   title: Budget
//   summary: Lines, spend, variations and overspend alerts
//   section: Productions
//   order: 3
//   paths: /productions/*?section=budget
//   ---
// `paths` are the Hub pages the guide is about, so Help can suggest the right guides for the page
// someone came from. "/finance" matches /finance and its sub-pages; * stands for one part of the
// address (an id or a space); ?key=value must also be on the page's address.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cache } from "react";

export type HelpGuide = { slug: string; title: string; summary: string; section: string; order: number; paths: string[]; body: string };

const DIR = path.join(process.cwd(), "content", "help");
export const HELP_SECTIONS = ["Getting started", "Productions", "Money", "Business development", "The Workshop Stoke", "Rentals & Crew", "Company", "Your account", "Admin"];

function parse(slug: string, raw: string): HelpGuide {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return {
    slug, title: meta.title ?? slug, summary: meta.summary ?? "", section: meta.section ?? "Getting started",
    order: Number(meta.order ?? 99), paths: (meta.paths ?? "").split(",").map(p => p.trim()).filter(Boolean),
    body: (m?.[2] ?? raw).trim(),
  };
}

export const helpGuides = cache((): HelpGuide[] => {
  let files: string[] = [];
  try { files = readdirSync(DIR).filter(f => f.endsWith(".md")); } catch { return []; }
  return files.map(f => parse(f.replace(/\.md$/, ""), readFileSync(path.join(DIR, f), "utf8")))
    .sort((a, b) => HELP_SECTIONS.indexOf(a.section) - HELP_SECTIONS.indexOf(b.section) || a.order - b.order || a.title.localeCompare(b.title));
});

export const helpGuide = (slug: string) => helpGuides().find(a => a.slug === slug) ?? null;

/** Does one of a guide's paths cover this page ("/productions/12?section=budget")? */
export function pathMatches(pattern: string, page: string) {
  const [pPath, pQuery] = pattern.split("?");
  const [path, query = ""] = page.split("?");
  const here = new URLSearchParams(query);
  if (pQuery && ![...new URLSearchParams(pQuery)].every(([k, v]) => here.get(k) === v)) return false;
  const re = pPath.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+");
  // A path covers itself and the pages under it; "/" only covers Home
  return pPath === "/" ? path === "/" : new RegExp(`^${re}(/.*)?$`).test(path);
}

/** Guides about the page someone came from, most specific first. */
export function guidesForPath(from: string | undefined) {
  if (!from) return [];
  return helpGuides()
    .map(g => ({ g, best: Math.max(-1, ...g.paths.filter(p => pathMatches(p, from)).map(p => p.length)) }))
    .filter(x => x.best >= 0)
    .sort((a, b) => b.best - a.best)
    .map(x => x.g);
}

/** Simple word search over titles, summaries and text. */
export function searchHelp(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return helpGuides()
    .map(a => {
      const title = a.title.toLowerCase(), rest = `${a.summary} ${a.body}`.toLowerCase();
      const score = words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0), 0);
      return { a, score, all: words.every(w => title.includes(w) || rest.includes(w)) };
    })
    .filter(x => x.all)
    .sort((x, y) => y.score - x.score)
    .map(x => x.a);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, (_m, t, href) => `<a href="${href}"${href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`);
}

/** The small Markdown subset guides use: headings, paragraphs, lists, bold, italic, code, links. */
export function renderHelp(md: string) {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (!line.trim()) { flushPara(); closeList(); continue; }
    if (h) { flushPara(); closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      continue;
    }
    closeList();
    para.push(line.trim());
  }
  flushPara(); closeList();
  return out.join("\n");
}
