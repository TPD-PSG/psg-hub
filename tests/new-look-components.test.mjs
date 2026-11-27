import { readFileSync } from "fs";

// New look stage 2 checks (build brief): no emoji anywhere in the new components, and text passes
// 4.5:1 contrast on its background, read from the tokens themselves (app/new-look.css).
export default async () => {
  const results = [];
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const files = ["components/nl/index.tsx", "components/Icon.tsx", "app/admin/new-look/Gallery.tsx", "app/new-look.css"];
  const emoji = /\p{Extended_Pictographic}/u;
  const found = files.filter(f => emoji.test(read(f)));
  ok(found.length === 0, `no emoji in the new components${found.length ? ` (found in ${found.join(", ")})` : ""}`);

  const css = read("app/new-look.css");
  const tok = name => (css.match(new RegExp(`--nl-${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1];
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [];
  for (const fg of ["text", "text-muted", "accent", "good", "bad"]) for (const bg of ["bg", "nav", "panel", "panel-raised", "panel-active"]) pairs.push([fg, bg]);
  pairs.push(["accent-ink", "accent"], ["warn", "warn-bg"]);
  const low = pairs.filter(([f, b]) => !tok(f) || !tok(b) || ratio(tok(f), tok(b)) < 4.5).map(([f, b]) => `${f} on ${b}`);
  ok(low.length === 0, `every text colour passes 4.5:1 on every background it's used on${low.length ? ` (fails: ${low.join(", ")})` : ""}`);
  return results;
};
