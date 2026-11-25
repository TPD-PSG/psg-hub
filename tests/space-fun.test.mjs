import { run, BASE } from "./lib.mjs";

// Fun Corner inside a company space: the shared stories in the space's look; stories posted from
// the space carry its badge (in PSG's Fun Corner too); only people who can open the space can tag it.
export default () => run("space-fun", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), f = await login(free.email), c = await login(client.email), m = await login(member.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const post = (who, fields) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fetch(`${BASE}/api/fun/submissions`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
  };
  const made = { e: null, subs: [] };
  try {
    made.e = await db.entity.create({ data: { name: "Fun test co", slug: "fun-test", hasSpace: true, shortName: "FTC" } });
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: made.e.id } });
    let r = await post(f, { title: "FT dock door saga", story: "It did not fit.", spaceSlug: "fun-test" });
    const s1 = await json(r); made.subs.push(s1.id);
    ok(r.status === 201 && s1.entity?.id === made.e.id && s1.entity?.shortName === "FTC", "a story posted from the space carries its company");
    r = await post(c, { title: "FT sneaky", story: "x", spaceSlug: "fun-test" });
    ok(r.status === 403, "someone from another company can't post as that space");
    r = await post(a, { title: "FT PSG story", story: "y" });
    const s2 = await json(r); made.subs.push(s2.id);
    ok(r.status === 201 && !s2.entity, "stories from the main Fun Corner have no company");

    const page = await html(await f("/spaces/fun-test/fun", { headers: { accept: "text/html" } }));
    ok(page.includes("Fun Corner") && page.includes("Add something funny") && page.includes("FT dock door saga") && page.includes("Build of the month"), "the space's Fun Corner: add form, your waiting story, build of the month");
    ok(page.includes(">Fun Corner<") && page.includes('href="/spaces/fun-test/fun"'), "Fun Corner is in the space's own sidebar");
    const memberPage = await html(await m("/spaces/fun-test/fun", { headers: { accept: "text/html" } }));
    ok(memberPage.includes("needs the Fun Corner module"), "without the Fun Corner module it says why");
    const psg = await html(await a("/fun", { headers: { accept: "text/html" } }));
    ok(psg.includes("FT dock door saga") && psg.includes("From FTC"), "PSG's Fun Corner shows the story with the space's badge");
  } finally {
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: null } }).catch(() => {});
    for (const id of made.subs) if (id) await db.funSubmission.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
