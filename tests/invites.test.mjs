import { run } from "./lib.mjs";

// Admin → Users "Invited": invites not yet accepted (latest per email, not people who already
// have an account), resend (new link, old one stops) and cancel. Local runs have no email set
// up, so a resend makes the new link and reports the email failure; nothing is sent.
export default () => run("invites", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email);
  const json = r => r.json();
  const day = 86400e3, now = Date.now();
  const tag = "invite-test";
  const mk = (email, name, expiresIn, createdAgo, extra = {}) => db.userInvite.create({ data: { token: `${tag}-${Math.random().toString(36).slice(2)}`, email, name, role: "freelancer", expiresAt: new Date(now + expiresIn * day), createdAt: new Date(now - createdAgo * day), ...extra } });
  try {
    await mk(`${tag}-a@example.test`, "Old Ann", -3, 10);
    const ann = await mk(`${tag}-a@example.test`, "Ann Carpenter", 5, 2);
    const bob = await mk(`${tag}-b@example.test`, "Bob Welder", -1, 8);
    await mk(admin.email, "Already Here", 5, 1);
    await mk(`${tag}-c@example.test`, "Used Cath", 5, 1, { usedAt: new Date() });

    ok((await m("/api/user-invites")).status === 403, "only admins see invites");
    let list = (await json(await a("/api/user-invites"))).filter(i => i.email.startsWith(tag) || i.email === admin.email);
    ok(list.length === 2, "latest invite per email, leaving out accepted ones and people with an account");
    ok(list.find(i => i.id === ann.id)?.expired === false && list.find(i => i.id === bob.id)?.expired === true, "shows which links are still valid and which expired");

    const before = ann.token;
    const r = await a(`/api/user-invites/${bob.id}`, { method: "POST" });
    const after = await db.userInvite.findUnique({ where: { id: bob.id } });
    ok((r.status === 200 || (r.status === 500 && /email failed/.test((await json(r)).error))) && after.expiresAt > new Date(now + 6 * day) && after.token !== bob.token, "resend makes a new 7-day link (the old one stops)");
    ok((await m(`/api/user-invites/${ann.id}`, { method: "POST" })).status === 403, "only admins resend");
    ok((await m(`/api/user-invites/${ann.id}`, { method: "DELETE" })).status === 403, "only admins cancel");
    list = await json(await a(`/api/user-invites/${ann.id}`, { method: "DELETE" }));
    ok(!list.some(i => i.email === `${tag}-a@example.test`) && (await db.userInvite.count({ where: { email: `${tag}-a@example.test` } })) === 0, "cancel removes every unused invite for that email");
    ok((await db.userInvite.count({ where: { token: before } })) === 0, "the cancelled link no longer exists");
    const page = await (await a("/admin/users", { headers: { accept: "text/html" } })).text();
    ok(page.includes("Invited (") && page.includes("Bob Welder"), "Users page lists who's been invited");
  } finally {
    await db.userInvite.deleteMany({ where: { OR: [{ email: { startsWith: tag } }, { token: { startsWith: tag } }] } });
    await db.userInvite.deleteMany({ where: { email: admin.email } });
  }
});
