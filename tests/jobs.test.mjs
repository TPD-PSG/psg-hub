import { run } from "./lib.mjs";

// Jobs: won deals open jobs (with quotes attached); days at each person's rate + costs + PSG
// expenses give the actual; money only for admins/BD/finance; staff log their own days.
export default () => run("jobs", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const made = { jobs: [], deals: [], quotes: [], prods: [] };
  try {
    ok((await a(`/api/users/${admin.id}`, { method: "PUT", body: JSON.stringify({ name: "test-admin", email: admin.email, role: "admin", costDayRate: 400 }) })).status === 200, "admin sets a day rate");
    ok((await f("/api/jobs")).status === 403, "freelancer can't see jobs");

    // A job opened by hand, with time and a cost
    let r = await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "Jobs test build", jobType: "workshop", price: "10000" }) });
    const job = await json(r); made.jobs.push(job.id);
    ok(r.status === 201 && /^J-\d{4}-\d{3}$/.test(job.number), `job opened (${job.number})`);
    ok((await a(`/api/jobs/${job.id}/time`, { method: "POST", body: JSON.stringify({ date: "2026-11-20", days: 2 }) })).status === 201, "admin logs 2 days");
    ok((await a(`/api/jobs/${job.id}/time`, { method: "POST", body: JSON.stringify({ date: "2026-11-20", days: 0.3 }) })).status === 400, "days must be in halves");
    ok((await a(`/api/jobs/${job.id}/costs`, { method: "POST", body: JSON.stringify({ description: "Timber", amount: 500, category: "Materials" }) })).status === 201, "admin logs a cost");
    let d = (await json(await a(`/api/jobs/${job.id}`))).job;
    ok(d.figures.timeCost === 800 && d.figures.costs === 500 && d.figures.actual === 1300 && d.figures.margin === 8700 && d.figures.priceFrom === "agreed", "actual £1,300 (2 days × £400 + £500), margin £8,700");

    // A member (no BD/finance) sees the job but no money, and can log only their own days
    const ml = await json(await m("/api/jobs"));
    ok(ml.seeMoney === false && ml.jobs.find(j => j.id === job.id)?.figures === null, "member: jobs listed without money");
    r = await m(`/api/jobs/${job.id}/time`, { method: "POST", body: JSON.stringify({ date: "2026-11-21", days: 1 }) });
    const mt = await json(r);
    ok(r.status === 201 && mt.dayRate === null, "member logs own day; rate not shown to them");
    ok((await m(`/api/jobs/${job.id}/time`, { method: "POST", body: JSON.stringify({ date: "2026-11-21", days: 1, userId: admin.id }) })).status === 403, "member can't log someone else's time");
    const md = (await json(await m(`/api/jobs/${job.id}`))).job;
    ok(md.figures === null && md.costs.length === 0 && md.time.every(t => t.dayRate === null), "member's job view has no costs, rates or figures");
    ok((await m(`/api/jobs/${job.id}/costs`, { method: "POST", body: JSON.stringify({ description: "x", amount: 1 }) })).status === 403, "member can't log costs");
    const adminEntry = d.time.find(t => t.userId === admin.id);
    ok((await m(`/api/jobs/${job.id}/time/${adminEntry.id}`, { method: "DELETE" })).status === 403, "member can't remove someone else's time");
    d = (await json(await a(`/api/jobs/${job.id}`))).job;
    ok(d.figures.unratedDays === 1, "member's day flagged as unrated (no day rate set)");

    // Won deal → job, taking its accepted quote's price
    const deal = await db.opportunity.create({ data: { title: "Jobs test deal", type: "scenic", stage: "won", value: 5000 } }); made.deals.push(deal.id);
    const q = await db.quote.create({ data: { number: "Q-2099-901", title: "Jobs test quote", status: "accepted", opportunityId: deal.id, vatRate: 20,
      lines: { create: [{ description: "Build", quantity: 1, unitCost: 3000, unitPrice: 7000 }] } } }); made.quotes.push(q.id);
    r = await a(`/api/opportunities/${deal.id}/job`, { method: "POST", body: "{}" });
    const dj = await json(r); made.jobs.push(dj.id);
    ok(r.status === 201 && dj.jobType === "workshop", "won scenic deal opens a workshop job");
    ok(dj.stage === "confirmation", "a won deal's workshop build starts at Confirmation");
    const djd = (await json(await a(`/api/jobs/${dj.id}`))).job;
    ok(djd.figures.price === 7000 && djd.figures.priceFrom === "quote" && djd.figures.quotedCost === 3000, "job price and quoted cost come from the accepted quote");
    ok((await a(`/api/opportunities/${deal.id}/job`, { method: "POST", body: "{}" })).status === 409, "a deal opens only one job");

    // Won PM deal → production also opens the PM job; PSG expenses on its budget count as cost
    const pmDeal = await db.opportunity.create({ data: { title: "Jobs test PM deal", type: "production", stage: "won", value: 30000 } }); made.deals.push(pmDeal.id);
    r = await a(`/api/opportunities/${pmDeal.id}/convert`, { method: "POST", body: JSON.stringify({ name: "Jobs test show", pmFee: 30000, stages: [] }) });
    const prod = await json(r); made.prods.push(prod.id);
    const pmJob = await db.job.findUnique({ where: { productionId: prod.id } });
    if (pmJob) made.jobs.push(pmJob.id);
    ok(pmJob && pmJob.jobType === "pm" && pmJob.opportunityId === pmDeal.id, "production from a won deal opens its PM job");
    const line = await db.budgetLine.create({ data: { productionId: prod.id, department: "Other", description: "PSG", budgeted: 0,
      expenses: { create: [{ description: "Train to MK", isPSGExpense: true, spent: 120, committed: 120 }, { description: "Show spend", spent: 9999 }] } } });
    const pj = (await json(await a(`/api/jobs/${pmJob.id}`))).job;
    ok(pj.figures.psgExpenses === 120 && pj.figures.price === 30000 && pj.figures.priceFrom === "pm fee", "PM job: only PSG expenses count (not show spend); price from the PM fee");
    void line;

    const page = await (await a(`/jobs/${job.id}`, { headers: { accept: "text/html" } })).text();
    ok(page.includes("Jobs test build") && page.includes("Timber"), "job page arrives with its costs");
    const list = await (await a("/jobs", { headers: { accept: "text/html" } })).text();
    ok(list.includes("By company") && list.includes("Jobs test build"), "jobs list shows the margin summary to admins");
    const mlist = await (await m("/jobs", { headers: { accept: "text/html" } })).text();
    ok(!mlist.includes("By company") && mlist.includes("Jobs test build"), "member sees jobs but no margin summary");
    const fpage = await f("/jobs", { headers: { accept: "text/html" } });
    ok(!(await fpage.text()).includes("Jobs test build"), "freelancer's jobs page shows nothing");
  } finally {
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    for (const id of made.quotes) await db.quote.delete({ where: { id } }).catch(() => {});
    for (const id of made.prods) await db.production.delete({ where: { id } }).catch(() => {});
    for (const id of made.deals) await db.opportunity.delete({ where: { id } }).catch(() => {});
  }
});
