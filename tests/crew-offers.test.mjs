import { run, BASE } from "./lib.mjs";

// Crew offers (Rentals & Crew stage 4): crew jobs on a hire or a production, offered to people from
// the crew directory by a private link (no login), answered available / can't, booked by the team.
// Booking keeps the hire's crew charge in step, and puts people on a production's crew.
export default () => run("crew-offers", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const m = await login(member.email), f = await login(free.email), a = await login(admin.email);
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const anon = (path, init = {}) => fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, redirect: "manual" });
  let entity = null, prod = null;
  const crewIds = [];
  try {
    entity = await db.entity.create({ data: { name: "Crew offers co", slug: "crew-offers", hasSpace: true, spaceKind: "rentals", phone: "01782 111222" } });
    prod = await db.production.create({ data: { name: "Crew offers test show", type: "musical", status: "planning" } });
    const hire = await db.rentalHire.create({ data: { entityId: entity.id, number: "H-2099-777", title: "Gala", outDate: new Date("2099-06-01"), returnDate: new Date("2099-06-03"), status: "confirmed", clientName: "Lowry" } });
    const mk = (name, email) => db.crew.create({ data: { name, discipline: "Lighting", email } }).then(c => (crewIds.push(c.id), c));
    const ann = await mk("Ann Sparks", member.email), bob = await mk("Bob Rigger", null), cat = await mk("Cat Lamp", "cat@example.test");

    // ── Jobs ─────────────────────────────────────────────────────────────────
    ok((await send(f, "/api/crew-jobs", "POST", { hireId: hire.id, role: "Tech", date: "2099-06-01" })).status === 403, "a freelancer can't set up crew jobs");
    ok((await send(m, "/api/crew-jobs", "POST", { role: "Tech", date: "2099-06-01" })).status === 400, "a crew job is on a hire or a production");
    ok((await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, productionId: prod.id, role: "Tech", date: "2099-06-01" })).status === 400, "…not both");
    ok((await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, role: "Tech", date: "2099-06-01", callTime: "8am" })).status === 400, "times look like 08:00");
    ok((await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, role: "Tech", date: "2099-06-01", places: 0 })).status === 400, "a job needs at least one person");
    ok((await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, role: "Tech", date: "2099-06-01", payUnit: "week" })).status === 400, "pay is by the day, hour or job");
    let r = await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, role: "Lighting technician", date: "2099-06-01", callTime: "08:00", endTime: "18:00", places: 2, payRate: 180, payUnit: "day", chargeRate: 250, location: "The Lowry, Salford", notes: "Blacks, steel toes" });
    const job = await json(r);
    ok(r.status === 201 && job.summary.open === 2, "a crew job for 2 lighting techs on the hire");

    // ── Offers ───────────────────────────────────────────────────────────────
    ok((await send(m, `/api/crew-jobs/${job.id}/offers`, "POST", { crewIds: [] })).status === 400, "pick who to ask");
    ok((await send(m, `/api/crew-jobs/${job.id}/offers`, "POST", { crewIds: [999999] })).status === 400, "only people in the crew directory");
    r = await send(m, `/api/crew-jobs/${job.id}/offers`, "POST", { crewIds: [ann.id, bob.id, cat.id] });
    let j = await json(r);
    ok(r.status === 201 && j.sent.length === 3 && j.sent.every(s => s.link.startsWith("/crew-offer/")), "three people asked, each with their own link");
    r = await send(m, `/api/crew-jobs/${job.id}/offers`, "POST", { crewIds: [ann.id] });
    ok((await json(r)).skipped === 1, "asking someone twice doesn't make a second offer");
    const offers = Object.fromEntries((await db.crewOffer.findMany({ where: { jobId: job.id }, include: { crew: true } })).map(o => [o.crew.name.split(" ")[0], o]));
    ok((await db.notification.count({ where: { userId: member.id, link: `/crew-offer/${offers.Ann.token}` } })) === 1, "a crew member with a Hub login (same email) gets it in their notifications");
    const mine = await json(await m("/api/my-crew-offers"));
    ok(mine.offers.some(o => o.link === `/crew-offer/${offers.Ann.token}` && o.role === "Lighting technician"), "…and on My crew offers");

    // ── The private link (no login) ──────────────────────────────────────────
    ok((await anon("/api/crew-offer/not-a-real-token-at-all-123")).status === 404, "a made-up link doesn't work");
    r = await anon(`/api/crew-offer/${offers.Bob.token}`);
    let v = await json(r);
    ok(r.status === 200 && v.canAnswer && v.job.role === "Lighting technician" && v.job.pay === "£180 a day" && v.job.time === "Call 08:00 to 18:00" && v.job.phone === "01782 111222", "the link shows the job, times, pay and who to call, without a login");
    ok(!JSON.stringify(v).includes("250"), "it never shows what the client is charged");
    const page = await anon(`/crew-offer/${offers.Bob.token}`);
    ok(page.status === 200 && (await page.text()).includes("Lighting technician"), "the offer page opens without a login");
    ok((await anon(`/api/crew-offer/${offers.Bob.token}`, { method: "POST", body: JSON.stringify({ answer: "maybe" }) })).status === 400, "the answer is yes or no");
    r = await anon(`/api/crew-offer/${offers.Bob.token}`, { method: "POST", body: JSON.stringify({ answer: "available", note: "Free from 07:30" }) });
    v = await json(r);
    ok(r.status === 200 && v.status === "available" && /available/.test(v.message), "Bob says he's available, with a note");
    await anon(`/api/crew-offer/${offers.Cat.token}`, { method: "POST", body: JSON.stringify({ answer: "unavailable" }) });
    const jobs = await json(await m(`/api/crew-jobs?hireId=${hire.id}`));
    const seen = jobs.jobs[0];
    ok(seen.summary.available === 1 && seen.summary.waiting === 1 && seen.offers.find(o => o.crew.name === "Bob Rigger").reply === "Free from 07:30", "the team sees who's available, who can't, and who hasn't answered");

    // ── Booking ──────────────────────────────────────────────────────────────
    const offerOf = n => seen.offers.find(o => o.crew.name.startsWith(n));
    ok((await send(m, `/api/crew-offers/${offerOf("Cat").id}`, "PATCH", { action: "book" })).status === 409, "someone who said they can't isn't booked");
    r = await send(m, `/api/crew-offers/${offerOf("Bob").id}`, "PATCH", { action: "book" });
    j = await json(r);
    ok(r.status === 200 && j.summary.booked === 1, "Bob is booked");
    let charge = await db.rentalHireCharge.findFirst({ where: { hireId: hire.id, crewJobId: job.id } });
    ok(charge?.quantity === 1 && charge.unitPrice === 250 && /Crew: Lighting technician/.test(charge.description), "the hire gets a crew charge: 1 × £250");
    await send(m, `/api/crew-offers/${offerOf("Ann").id}`, "PATCH", { action: "book" });
    charge = await db.rentalHireCharge.findFirst({ where: { hireId: hire.id, crewJobId: job.id } });
    ok(charge?.quantity === 2, "booking Ann (who hadn't answered, but said yes on the phone) makes it 2 × £250");
    ok((await send(m, `/api/crew-offers/${offerOf("Cat").id}`, "PATCH", { action: "answer", status: "available" })).status === 200, "Cat's changed her mind (noted by the team)");
    ok((await send(m, `/api/crew-offers/${offerOf("Cat").id}`, "PATCH", { action: "book" })).status === 409, "but both places are booked");
    v = await json(await anon(`/api/crew-offer/${offers.Cat.token}`));
    ok(!v.canAnswer && /filled/.test(v.message), "Cat's link now says the job's been filled");
    v = await json(await anon(`/api/crew-offer/${offers.Bob.token}`));
    ok(v.status === "booked" && !v.canAnswer && /booked/.test(v.message), "Bob's link says he's booked");
    ok((await send(m, `/api/crew-jobs/${job.id}`, "PATCH", { places: 1 })).status === 409, "places can't drop below who's booked");
    // Saving the hire's own charges leaves the crew charge alone
    await send(m, `/api/rentals/hires/${hire.id}`, "PATCH", { charges: [{ description: "Transport", quantity: 1, unitPrice: 100 }] });
    ok((await db.rentalHireCharge.count({ where: { hireId: hire.id } })) === 2, "editing the hire's other charges keeps the crew charge");
    const h = await json(await m(`/api/rentals/hires/${hire.id}`));
    ok(h.totals.charges === 600, "the hire's totals include the crew (£500) and transport (£100)");
    await send(m, `/api/crew-jobs/${job.id}`, "PATCH", { chargeRate: 275 });
    ok((await db.rentalHireCharge.findFirst({ where: { crewJobId: job.id } })).unitPrice === 275, "changing the job's charge updates the hire");
    r = await send(m, `/api/crew-offers/${offerOf("Bob").id}`, "PATCH", { action: "release" });
    ok(r.status === 200 && (await db.rentalHireCharge.findFirst({ where: { crewJobId: job.id } })).quantity === 1, "releasing Bob takes the charge back to 1");
    ok((await json(await anon(`/api/crew-offer/${offers.Bob.token}`))).status === "released", "Bob's link says he's no longer needed");
    ok((await send(m, `/api/crew-offers/${offerOf("Ann").id}`, "DELETE")).status === 400, "a booked offer can't be withdrawn");

    // ── On a production ──────────────────────────────────────────────────────
    r = await send(a, "/api/crew-jobs", "POST", { productionId: prod.id, role: "Stagehand", date: "2099-07-10", payRate: 160, chargeRate: 999 });
    const pjob = await json(r);
    ok(r.status === 201, "a crew job on a production");
    await send(a, `/api/crew-jobs/${pjob.id}/offers`, "POST", { crewIds: [bob.id] });
    const po = (await json(await a(`/api/crew-jobs?productionId=${prod.id}`))).jobs[0].offers[0];
    await send(a, `/api/crew-offers/${po.id}`, "PATCH", { action: "book" });
    const pc = await db.productionCrew.findFirst({ where: { productionId: prod.id, crewId: bob.id } });
    ok(pc?.role === "Stagehand" && pc.dayRate === 160, "booking on a production puts them on its crew, with the role and day rate");
    await send(a, `/api/crew-offers/${po.id}`, "PATCH", { action: "release" });
    ok((await db.productionCrew.count({ where: { productionId: prod.id, crewId: bob.id } })) === 0, "releasing takes them off the production's crew");

    // Removing a job takes its charge (and offers) with it
    r = await send(m, `/api/crew-jobs/${job.id}`, "DELETE");
    ok(r.status === 200 && (await db.rentalHireCharge.count({ where: { crewJobId: job.id } })) === 0 && (await db.crewOffer.count({ where: { jobId: job.id } })) === 0, "removing a job removes its offers and its hire charge");
  } finally {
    if (entity) { await db.rentalHire.deleteMany({ where: { entityId: entity.id } }); await db.entity.delete({ where: { id: entity.id } }).catch(() => {}); }
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
    await db.crew.deleteMany({ where: { id: { in: crewIds } } });
  }
});
