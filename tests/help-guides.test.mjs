import { readdirSync, readFileSync, existsSync } from "fs";
import { run } from "./lib.mjs";

// Help guides (28 Nov 2026, as in x-over): every guide is well formed (title, summary, a known
// section, the pages it covers), links between guides go to guides that exist, every page a guide
// names is a real page, Help suggests the right guides for the page you came from, search finds
// them, and the pages open.
const SECTIONS = ["Getting started", "Productions", "Money", "Business development", "The Workshop Stoke", "Rentals & Crew", "Company", "Your account", "Admin"];

export default () => run("help-guides", async ({ users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  const dir = new URL("../content/help/", import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith(".md"));
  const slugs = new Set(files.map(f => f.replace(/\.md$/, "")));
  ok(files.length >= 40, `there are guides for every part of the Hub (${files.length})`);
  const bad = [], badLinks = [], badPaths = [];
  const appDir = new URL("../app/", import.meta.url);
  // Does a guide's page exist under app/ (matching [param] folders for * and ids)?
  const routeExists = path => {
    const parts = path.split("?")[0].split("/").filter(Boolean);
    const walk = (base, i) => {
      if (i === parts.length) return existsSync(new URL("page.tsx", base));
      if (!existsSync(base)) return false;
      const dirs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
      const next = [parts[i] === "*" ? null : parts[i], ...dirs.filter(d => d.startsWith("["))].filter(Boolean);
      return next.some(d => dirs.includes(d) && walk(new URL(`${d}/`, base), i + 1));
    };
    return path === "/" ? true : walk(appDir, 0);
  };
  for (const f of files) {
    const raw = readFileSync(new URL(f, dir), "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const meta = Object.fromEntries((m?.[1] ?? "").split("\n").map(l => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
    if (!meta.title || !meta.summary || !SECTIONS.includes(meta.section) || !meta.paths || (m?.[2] ?? "").trim().length < 300) bad.push(f);
    for (const [, slug] of (m?.[2] ?? "").matchAll(/\]\(\/help\/([a-z0-9-]+)\)/g)) if (!slugs.has(slug)) badLinks.push(`${f} → ${slug}`);
    for (const p of (meta.paths ?? "").split(",").map(s => s.trim()).filter(Boolean)) if (!routeExists(p)) badPaths.push(`${f}: ${p}`);
  }
  ok(bad.length === 0, `every guide has a title, summary, known section, pages and real text${bad.length ? ` (not: ${bad.join(", ")})` : ""}`);
  ok(badLinks.length === 0, `links between guides go to guides that exist${badLinks.length ? ` (not: ${badLinks.join(", ")})` : ""}`);
  ok(badPaths.length === 0, `every page a guide names is a real page${badPaths.length ? ` (not: ${badPaths.join("; ")})` : ""}`);

  const help = await import("../lib/help.ts");
  ok(help.pathMatches("/productions/*?section=budget", "/productions/12?section=budget") && !help.pathMatches("/productions/*?section=budget", "/productions/12?section=crew") && help.pathMatches("/finance", "/finance?tab=expenses") && help.pathMatches("/spaces/*/calendar", "/spaces/tws/calendar") && !help.pathMatches("/", "/tasks"), "page matching: ids, sections and sub-pages");
  ok(help.guidesForPath("/productions/12?section=budget")[0]?.slug === "budget", "Help suggests the Budget guide on a production's budget");
  ok(help.guidesForPath("/spaces/tws/calendar")[0]?.slug === "workshop-calendar", "and the Workshop calendar guide on the calendar");
  ok(help.searchHelp("call sheet").some(g => g.slug === "call-sheets"), "search finds guides");

  const a = await login(admin.email);
  const page = await a("/help?from=%2Fproductions%2F1%3Fsection%3Dbudget", { headers: { accept: "text/html" } });
  const html = (await page.text()).replace(/<!-- -->/g, "");
  ok(page.status === 200 && html.includes("For the page you were on") && html.includes('href="/help/budget"'), "the Guides page opens with the guides for the page you came from");
  ok((await a("/help/call-sheets", { headers: { accept: "text/html" } })).status === 200 && (await a("/help/no-such-guide", { headers: { accept: "text/html" } })).status === 404, "a guide opens; a missing one is not found");
  const hits = (await (await a("/api/search?q=overspend")).json()).results;
  ok(hits.some(h => h.type === "Guides"), "⌘K search finds guides");
});
