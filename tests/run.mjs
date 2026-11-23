// npm test — runs every tests/*.test.mjs against the local dev server (npm run dev first).
import { readdirSync } from "fs";
const files = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".test.mjs")).sort();
let pass = 0, fail = 0;
for (const f of files) {
  const results = await (await import(`./${f}`)).default();
  const failed = results.filter(r => r.startsWith("FAIL"));
  pass += results.filter(r => r.startsWith("PASS")).length;
  fail += failed.length;
  console.log(`${failed.length ? "✗" : "✓"} ${f.replace(".test.mjs", "")}: ${results.filter(r => r.startsWith("PASS")).length} passed${failed.length ? `, ${failed.length} failed` : ""}`);
  for (const r of failed) console.log(`    ${r}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
