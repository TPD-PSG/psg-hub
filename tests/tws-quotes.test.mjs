import { run } from "./lib.mjs";

// TWS: "+ New build job" in the space (any PSG staff who can open it; no price) and Quotes in
// the space (quotes for that company, needing Business Dev access as elsewhere).
export default () => run("tws-quotes", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, other: null, jobs: [], quotes: [] };
  try {
    made.e = await db.entity.create({ data: { name: "TWS quotes test", slug: "twsq-test", hasSpace: true, shortName: "TQT" } });
    made.other = await db.entity.create({ data: { name: "TWS quotes other" } });
    const J = "/api/spaces/twsq-test/jobs";
    ok((await f(J, { method: "POST", body: JSON.stringify({ title: "x" }) })).status === 403, "a freelancer can't start a build");
    ok((await m(J, { method: "POST", body: JSON.stringify({ title: " " }) })).status === 400, "a build needs a name");
    let r = await m(J, { method: "POST", body: JSON.stringify({ title: "TQ flats", startDate: "2026-12-01", dueOut: "2026-12-12", deliveryMethod: "delivery", notes: "Portal too" }) });
    const job = await json(r); made.jobs.push(job.id);
    const saved = await db.job.findUnique({ where: { id: job.id } });
    ok(r.status === 201 && saved.entityId === made.e.id && saved.jobType === "workshop" && saved.stage === "quote" && saved.price === null, "a member starts a build in the space: this company, workshop, Quote stage, no price");
    ok(saved.endDate?.toISOString().startsWith("2026-12-12") && saved.deliveryMethod === "delivery" && saved.notes === "Portal too", "with its dates, delivery and notes");
    const home = await (await m("/spaces/twsq-test", { headers: { accept: "text/html" } })).text();
    ok(home.includes("+ New build job"), "the space home offers + New build job to staff");

    // Quotes
    r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "TQ quote", jobType: "workshop", entityId: made.e.id }) });
    const q = await json(r); made.quotes.push(q.id);
    const q2 = await json(await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "TQ other quote", entityId: made.other.id }) })); made.quotes.push(q2.id);
    const list = await json(await a(`/api/quotes?entityId=${made.e.id}`));
    ok(list.some(x => x.id === q.id) && !list.some(x => x.id === q2.id), "quotes can be listed for one company");
    const page = await (await a("/spaces/twsq-test/quotes", { headers: { accept: "text/html" } })).text();
    ok(page.includes("TQ quote") && !page.includes("TQ other quote") && page.includes("+ New quote"), "the space's Quotes page lists its quotes");
    const memberPage = await (await m("/spaces/twsq-test/quotes", { headers: { accept: "text/html" } })).text();
    ok(memberPage.includes("Quoting needs Business Dev access"), "without Business Dev it says why");
    const qp = await (await a(`/spaces/twsq-test/quotes/${q.id}`, { headers: { accept: "text/html" } })).text();
    ok(qp.includes(q.number) && qp.includes("PDF for client") && qp.includes(`/spaces/twsq-test/quotes`), "a quote opens inside the space, links staying there");
    const other = await a(`/spaces/twsq-test/quotes/${q2.id}`, { headers: { accept: "text/html" }, redirect: "manual" });
    ok([303, 307, 308].includes(other.status) || (await other.text()).includes("NEXT_REDIRECT"), "another company's quote goes to Business Dev instead");
    const qd = await json(await a(`/api/quotes/${q.id}`));
    ok(qd.entity?.hasSpace === true && qd.entity?.slug === "twsq-test", "a quote carries its company's branding for the PDF");
  } finally {
    for (const id of made.quotes) await db.quote.delete({ where: { id } }).catch(() => {});
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    for (const e of [made.e, made.other]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
