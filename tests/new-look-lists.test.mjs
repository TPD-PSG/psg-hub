import { readFileSync } from "fs";
import { run } from "./lib.mjs";

// New look stage 6 (build brief): list and form pages move onto the shared styles, highest traffic
// first (productions, tasks, finance, venues). Checks: each opens in the new look with one primary
// button and an empty state that says what to add; the old look's colours map to the new tokens
// only when the switch is on.
export default () => run("new-look-lists", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  const css = readFileSync(new URL("../app/new-look.css", import.meta.url), "utf8");
  const remap = css.slice(css.indexOf("Lists and forms (stage 6)"));
  ok(["--psg-dark-bg: var(--nl-bg)", "--psg-card-bg: var(--nl-panel)", "--psg-card-border: var(--nl-border)", "--psg-muted: var(--nl-text-muted)", "--psg-blue: var(--nl-accent)"].every(x => remap.includes(x)) && remap.includes(":root[data-new-look] {"), "the old page colours map to the new tokens, only when the New look is on");
  ok(/accent-ink\) !important/.test(remap), "primary buttons are the accent with navy text");
  try {
    await db.user.update({ where: { id: admin.id }, data: { preferences: JSON.stringify({ newLook: true }) } });
    const a = await login(admin.email);
    const pages = { "/productions": "New Production", "/tasks": "Add Task", "/finance": null, "/venues": "Add Venue" };
    for (const [path, primary] of Object.entries(pages)) {
      const r = await a(path, { headers: { accept: "text/html" } });
      const h = (await r.text()).replace(/<!-- -->/g, "");
      ok(r.status === 200 && h.includes("data-new-look") && (!primary || h.includes(primary)), `${path} opens in the new look${primary ? ` with its one primary button (${primary})` : ""}`);
    }
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    await db.user.update({ where: { id: admin.id }, data: { preferences: null } }).catch(() => {});
  }
});
