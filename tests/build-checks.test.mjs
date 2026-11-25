import { run } from "./lib.mjs";

// TWS build page checklists (snags & tasks, ready-to-collect) and the Build jobs list.
export default () => run("build-checks", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, ""); // React splits text with these markers
  const made = { e: null, jobs: [] };
  try {
    made.e = await db.entity.create({ data: { name: "Checks test co", slug: "checks-test", hasSpace: true } });
    const live = await db.job.create({ data: { number: "J-2099-996", title: "CK live build", jobType: "workshop", entityId: made.e.id, stage: "build", price: 5000 } });
    const done = await db.job.create({ data: { number: "J-2099-997", title: "CK finished build", jobType: "workshop", entityId: made.e.id, stage: "delivery", status: "complete" } });
    made.jobs.push(live.id, done.id);
    const C = `/api/jobs/${live.id}/checks`;
    ok((await f(C, { method: "POST", body: JSON.stringify({ text: "x" }) })).status === 403, "a freelancer can't add checks");
    ok((await m(C, { method: "POST", body: JSON.stringify({ text: " " }) })).status === 400, "a check needs words");
    let list = await json(await m(C, { method: "POST", body: JSON.stringify({ text: "Trial fit of flats", kind: "snag" }) }));
    ok(list.length === 1 && list[0].kind === "snag", "a snag is added");
    list = await json(await m(C, { method: "POST", body: JSON.stringify({ standard: "collect" }) }));
    ok(list.filter(c => c.kind === "collect").length === 5, "the standard ready-to-collect checks are added");
    list = await json(await m(C, { method: "POST", body: JSON.stringify({ standard: "collect" }) }));
    ok(list.filter(c => c.kind === "collect").length === 5, "adding them again doesn't double up");
    const snag = list.find(c => c.kind === "snag");
    const t = await json(await m(`${C}/${snag.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) }));
    ok(t.done && t.doneBy?.name && t.doneAt, "ticked, with who and when");
    ok((await m(`/api/jobs/${done.id}/checks/${snag.id}`, { method: "PATCH", body: JSON.stringify({ done: false }) })).status === 404, "a check only changes on its own build");
    ok((await m(`${C}/${snag.id}`, { method: "DELETE" })).status === 200 && (await json(await m(C))).length === 5, "a check is removed");
    const page = await html(await m(`/spaces/checks-test/jobs/${live.id}`, { headers: { accept: "text/html" } }));
    ok(page.includes("Snags &amp; tasks") && page.includes("Ready-to-collect check: 0 of 5 done"), "the build page shows the checklists");

    const jobsPage = await html(await a("/spaces/checks-test/jobs", { headers: { accept: "text/html" } }));
    ok(jobsPage.includes("Build jobs") && jobsPage.includes("CK live build") && jobsPage.includes("1 live · 1 complete") && jobsPage.includes("Margin"), "Build jobs lists the space's builds, with money for those who see it");
    const memberJobs = await html(await m("/spaces/checks-test/jobs", { headers: { accept: "text/html" } }));
    ok(memberJobs.includes("CK live build") && !memberJobs.includes(">Margin<"), "…and without money for others");
  } finally {
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
