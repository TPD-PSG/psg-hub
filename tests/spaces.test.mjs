import { run, BASE } from "./lib.mjs";

// Company spaces: admins set them up; people with that home company land on the space and see
// its theme; staff can open any space, others only their own.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export default () => run("spaces", async ({ db, users, login, anon, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), f = await login(free.email), c = await login(client.email), m = await login(member.email);
  const json = r => r.json();
  const SLUG = "tws-test";
  let entity, other, job;
  try {
    entity = await db.entity.create({ data: { name: "Workshop Space Test" } });
    other = await db.entity.create({ data: { name: "Other Space Test", slug: "other-space-test" } });
    const put = (body, who = a) => who(`/api/entities/${entity.id}`, { method: "PUT", body: JSON.stringify(body) });
    ok((await put({ hasSpace: true })).status === 400, "a space needs a web address first");
    ok((await put({ slug: "Not OK!" })).status === 400, "bad web address refused");
    ok((await put({ slug: "admin" })).status === 400, "reserved web address refused");
    ok((await put({ slug: "other-space-test" })).status === 409, "web address already in use refused");
    ok((await put({ color: "red" })).status === 400, "colour must be a hex code");
    ok((await put({ slug: SLUG }, m)).status === 403, "member can't set up a space");
    let r = await put({ slug: SLUG, shortName: "TWS-T", color: "#E4572E" });
    ok(r.status === 200, "admin sets web address, short name and colour");
    r = await put({ hasSpace: true });
    const e = await json(r);
    ok(e.hasSpace && e.slug === SLUG && e.color === "#e4572e" && e.shortName === "TWS-T", "space switched on");

    // Logo
    const up = (who, body, type = "image/png") => {
      const fd = new FormData(); fd.append("logo", new Blob([body], { type }), "logo.png");
      return fetch(`${BASE}/api/entities/${entity.id}/logo`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
    };
    ok((await up(m, PNG)).status === 403, "member can't upload a logo");
    ok((await up(a, Buffer.from("<svg/>"), "image/svg+xml")).status === 400, "SVG logos refused");
    ok((await up(a, PNG)).status === 200, "admin uploads a PNG logo");
    const logo = await f(`/api/spaces/${SLUG}/logo`);
    ok(logo.status === 200 && logo.headers.get("content-type") === "image/png", "signed-in people can load the logo");
    ok((await anon(`/api/spaces/${SLUG}/logo`)).status !== 200, "signed-out can't");

    // A job in the space
    job = await db.job.create({ data: { number: "J-2099-950", title: "Space test build", jobType: "workshop", entityId: entity.id, endDate: new Date(Date.now() + 5 * 86400e3) } });

    // Home company: the freelancer works for the space's company
    ok((await a(`/api/users/${free.id}`, { method: "PUT", body: JSON.stringify({ name: "test-freelancer", email: free.email, role: "freelancer", homeEntityId: entity.id }) })).status === 200, "admin sets a home company");
    const home = await f("/", { headers: { accept: "text/html" } });
    ok([302, 303, 307, 308].includes(home.status) && (home.headers.get("location") ?? "").endsWith(`/spaces/${SLUG}`), "home company with a space → lands on the space");
    ok((await f("/?all=1", { headers: { accept: "text/html" } })).status === 200, "?all=1 still opens PSG Hub home");
    const sd = await json(await f(`/api/spaces/${SLUG}`));
    ok(sd.space?.name === "Workshop Space Test" && sd.jobs?.some(j => j.id === job.id) && sd.dueOut?.some(j => j.id === job.id), "space shows its live jobs and what's due out");
    ok(sd.team?.some(t => t.id === free.id), "space lists its team");
    ok(!JSON.stringify(sd).includes("price"), "no money on the space page");
    ok((await c(`/api/spaces/${SLUG}`)).status === 403, "someone from another company can't open it");
    ok((await m(`/api/spaces/${SLUG}`)).status === 200, "PSG staff can open any space");
    ok((await a("/api/spaces/other-space-test")).status === 404, "a company without its space switched on has no space");
    const page = await (await f(`/spaces/${SLUG}`, { headers: { accept: "text/html" } })).text();
    ok(page.includes("Space test build") && page.includes("TWS-T · PSG Hub") && page.includes("#e4572e"), "space page in the first HTML, top bar in the company's colours and name");
    const adminHome = await (await a("/", { headers: { accept: "text/html" } })).text();
    ok(adminHome.includes(`/spaces/${SLUG}`), "Home links to the space (tile and Companies row)");
    ok(!adminHome.includes("TWS-T · PSG Hub"), "people from other companies keep the PSG top bar");
  } finally {
    await db.user.updateMany({ where: { homeEntityId: entity?.id }, data: { homeEntityId: null } }).catch(() => {});
    if (job) await db.job.delete({ where: { id: job.id } }).catch(() => {});
    for (const x of [entity, other]) if (x) await db.entity.delete({ where: { id: x.id } }).catch(() => {});
  }
});
