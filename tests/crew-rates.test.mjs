import { run } from "./lib.mjs";
import { crewRateFields, jobFromRate, rateLabel, forRateCard } from "../lib/crewRates.ts";

// Crew rates (Rentals & Crew, 28 Nov 2026): each role's usual pay and client charge in a rentals
// space. Picking one fills in a hire's crew job; the charge can go on the rate card, never the pay.
export default () => run("crew-rates", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member] = users;
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  let entity = null, other = null, acme = null;
  try {
    // ── The rules ────────────────────────────────────────────────────────────
    ok("error" in crewRateFields({}, true), "a rate needs a role");
    ok("error" in crewRateFields({ role: "Tech", unit: "week" }, true), "a rate is by the day, hour or job");
    ok("error" in crewRateFields({ role: "Tech", payRate: -5 }, true), "pay can't be negative");
    ok("error" in crewRateFields({ role: "Tech", hours: 30 }, true), "hours are 0 to 24");
    const f = crewRateFields({ role: "  Lighting   technician ", payRate: "180.456", chargeRate: "", notes: " 10-hour day " }, true);
    ok(f.data?.role === "Lighting technician" && f.data.payRate === 180.46 && f.data.chargeRate === null && f.data.unit === "day" && f.data.notes === "10-hour day", "fields are tidied: spaces, pennies, blanks, by the day unless said");
    ok(rateLabel(250, "day") === "£250 a day" && rateLabel(32.5, "hour", 10) === "£32.50 an hour (10 hours)" && rateLabel(400, "job") === "£400 for the job" && rateLabel(null, "day") === null, "rates read as £250 a day, £32.50 an hour (10 hours), £400 for the job");
    const day = jobFromRate({ role: "Stagehand", unit: "day", hours: null, payRate: 150, chargeRate: 210 });
    ok(day.role === "Stagehand" && day.payRate === 150 && day.payUnit === "day" && day.hours === null && day.chargeRate === 210, "a day rate fills the job's pay and charge as they are");
    const hourly = { role: "Sound No.1", unit: "hour", hours: 10, payRate: 25, chargeRate: 38.5 };
    ok(jobFromRate(hourly).chargeRate === 385 && jobFromRate(hourly).hours === 10, "by the hour, the job's charge is the hourly charge × the usual hours (10 × £38.50 = £385)");
    ok(jobFromRate(hourly, 8).chargeRate === 308 && jobFromRate(hourly, 8).payRate === 25, "…or × the job's own hours, with pay staying hourly");
    ok(jobFromRate({ ...hourly, hours: null }).chargeRate === null, "…and left blank until the hours are known");
    const card = forRateCard([
      { id: 1, role: "A", unit: "day", hours: null, payRate: 1, chargeRate: 2, notes: null, onRateCard: true, archived: false },
      { id: 2, role: "B", unit: "day", hours: null, payRate: 1, chargeRate: 2, notes: null, onRateCard: false, archived: false },
      { id: 3, role: "C", unit: "day", hours: null, payRate: 1, chargeRate: null, notes: null, onRateCard: true, archived: false },
      { id: 4, role: "D", unit: "day", hours: null, payRate: 1, chargeRate: 2, notes: null, onRateCard: true, archived: true },
    ]);
    ok(card.length === 1 && card[0].role === "A" && !("payRate" in card[0]), "the rate card shows only roles marked for it, with a charge, in use, and never the pay");

    // ── Setting them up in the space ─────────────────────────────────────────
    entity = await db.entity.create({ data: { name: "Crew rates co", slug: "crew-rates", hasSpace: true, spaceKind: "rentals", sortOrder: -100 } });
    other = await db.entity.create({ data: { name: "Crew rates workshop", slug: "crew-rates-ws", hasSpace: true, spaceKind: "workshop" } });
    const m = await login(member.email), fr = await login(free.email);
    const R = `/api/spaces/${entity.slug}/rentals/crew-rates`;
    ok((await send(fr, R, "POST", { role: "Tech" })).status === 403, "a freelancer can't set crew rates");
    ok((await send(m, `/api/spaces/${other.slug}/rentals/crew-rates`, "POST", { role: "Tech" })).status === 404, "a workshop space has no crew rates");
    ok((await send(m, R, "POST", { role: "" })).status === 400, "a rate needs a role (API)");
    let r = await send(m, R, "POST", { role: "Lighting technician", payRate: 180, chargeRate: 250, notes: "10-hour day" });
    const lx = await json(r);
    ok(r.status === 201 && lx.unit === "day" && lx.onRateCard, "a lighting technician rate: £180 pay, £250 charge, a day, on the rate card");
    ok((await send(m, R, "POST", { role: "LIGHTING TECHNICIAN" })).status === 409, "one rate per role (any case)");
    r = await send(m, R, "POST", { role: "Sound No.1", unit: "hour", hours: 10, payRate: 25, chargeRate: 38.5, onRateCard: false });
    const snd = await json(r);
    ok(r.status === 201 && snd.unit === "hour" && snd.hours === 10, "an hourly sound rate, kept off the rate card");
    const stage = await json(await send(m, R, "POST", { role: "Stagehand", payRate: 140, chargeRate: 195 }));
    let list = await json(await m(R));
    ok(list.rates.length === 3 && list.rates.map(x => x.role).join() === "Lighting technician,Sound No.1,Stagehand", "the space lists its crew rates");
    ok((await send(m, `/api/rentals/crew-rates/${snd.id}`, "PATCH", { role: "Stagehand" })).status === 409, "renaming can't clash with another role");
    r = await send(m, `/api/rentals/crew-rates/${lx.id}`, "PATCH", { chargeRate: 260 });
    ok(r.status === 200 && (await json(r)).chargeRate === 260, "a rate can be changed");
    ok((await send(fr, `/api/rentals/crew-rates/${lx.id}`, "PATCH", { chargeRate: 1 })).status === 403, "…but not by a freelancer");
    await send(m, `/api/rentals/crew-rates/${stage.id}`, "PATCH", { archived: true });
    const crewPage = await json(await m(`/api/spaces/${entity.slug}/rentals/crew`));
    ok(crewPage.rates.length === 3 && crewPage.rates[2].archived, "the Crew page has them too, with ones not in use last");

    // ── Picking on a hire ────────────────────────────────────────────────────
    const hire = await db.rentalHire.create({ data: { entityId: entity.id, number: "H-2099-888", title: "Rates gala", outDate: new Date("2099-07-01"), returnDate: new Date("2099-07-02"), status: "confirmed", clientName: "Lowry" } });
    r = await m(`/api/rentals/hires/${hire.id}/crew-rates`);
    const onHire = await json(r);
    ok(r.status === 200 && onHire.rates.map(x => x.role).join() === "Lighting technician,Sound No.1", "a hire's crew job can pick from its space's rates in use");
    ok((await fr(`/api/rentals/hires/${hire.id}/crew-rates`)).status === 403, "…staff only");
    // The form fills the job in from the rate; the job keeps its own figures after
    const filled = jobFromRate(onHire.rates[0]);
    r = await send(m, "/api/crew-jobs", "POST", { hireId: hire.id, date: "2099-07-01", ...filled });
    const job = await json(r);
    ok(r.status === 201 && job.role === "Lighting technician" && job.payRate === 180 && job.chargeRate === 260, "a crew job filled in from the rate");
    await send(m, `/api/rentals/crew-rates/${lx.id}`, "PATCH", { chargeRate: 999 });
    ok((await db.crewJob.findUnique({ where: { id: job.id } })).chargeRate === 260, "changing the rate later doesn't change the job");
    await send(m, `/api/rentals/crew-rates/${lx.id}`, "PATCH", { chargeRate: 260 });

    // ── The rate card ────────────────────────────────────────────────────────
    acme = await db.client.create({ data: { name: "Crew rates client (test)", type: "corporate" } });
    await db.user.update({ where: { id: client.id }, data: { clientId: acme.id } });
    const c = await login(client.email);
    r = await c(`/api/rate-card?companyId=${entity.id}`);
    const rc = await json(r);
    ok(r.status === 200 && rc.crew.length === 1 && rc.crew[0].role === "Lighting technician" && rc.crew[0].chargeRate === 260 && rc.crew[0].notes === "10-hour day", "clients see the lighting technician's charge on the rate card (not the hidden or unused roles)");
    ok(!JSON.stringify(rc.crew).includes("180") && !JSON.stringify(rc.crew).includes("payRate"), "…and never what crew are paid");
    ok((await send(c, R, "POST", { role: "Mine" })).status === 403 && (await c(R)).status === 403, "a client can't see or change crew rates");

    // ── Deleting ─────────────────────────────────────────────────────────────
    ok((await send(m, `/api/rentals/crew-rates/${lx.id}`, "DELETE")).status === 200, "a rate can be deleted");
    ok((await db.crewJob.findUnique({ where: { id: job.id } }))?.payRate === 180, "…and the job set up from it keeps its pay and charge");
    ok((await send(m, `/api/rentals/crew-rates/${lx.id}`, "DELETE")).status === 404, "…once");
  } finally {
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    for (const e of [entity, other]) if (e) { await db.rentalHire.deleteMany({ where: { entityId: e.id } }); await db.entity.delete({ where: { id: e.id } }).catch(() => {}); }
    if (acme) await db.client.delete({ where: { id: acme.id } }).catch(() => {});
  }
});
