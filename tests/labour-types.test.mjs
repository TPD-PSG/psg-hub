import { run } from "./lib.mjs";

// Labour types: a workshop's list with day cost rates, searched in the quote lookup, picked on
// parts and used to price them (person's rate first), kept by templates; and quotes drafted by
// part show one price per item on the client's PDF.
export default () => run("labour-types", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, jobs: [], quotes: [] };
  try {
    made.e = await db.entity.create({ data: { name: "LT workshop", slug: "lt-test", hasSpace: true } });
    const L = "/api/spaces/lt-test/labour-types";
    const post = (who, url, body) => who(url, { method: "POST", body: JSON.stringify(body) });
    ok((await post(f, L, { name: "X" })).status === 403, "freelancers can't add labour types");
    let list = await json(await post(a, L, { usual: true }));
    ok(list.length === 8 && list.every(l => l.dayRate === null) && list.some(l => l.name === "Carpenter"), "the usual eight added, rates to fill in");
    ok((await json(await post(a, L, { usual: true }))).length === 8, "adding the usual ones twice doesn't duplicate");
    ok((await post(a, L, { name: "Carpenter" })).status === 409, "names are unique");
    const carp = list.find(l => l.name === "Carpenter");
    list = await json(await a(`/api/labour-types/${carp.id}`, { method: "PATCH", body: JSON.stringify({ dayRate: 220 }) }));
    ok(list.find(l => l.id === carp.id).dayRate === 220, "a day rate is set");
    ok((await a(`/api/labour-types/${carp.id}`, { method: "PATCH", body: JSON.stringify({ dayRate: -5 }) })).status === 400, "rates can't be negative");
    list = await json(await post(a, L, { name: "Upholsterer", dayRate: 200 }));
    const uph = list.find(l => l.name === "Upholsterer");

    // Lookup
    let d = await json(await a(`/api/quotes/lookup?q=carp&entityId=${made.e.id}`));
    ok(d.labour?.[0]?.name === "Carpenter" && d.labour[0].dayRate === 220, "searching 'carp' finds Carpenter at £220/day");
    await a(`/api/labour-types/${uph.id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
    d = await json(await a(`/api/quotes/lookup?q=uphol&entityId=${made.e.id}`));
    ok(d.labour.length === 0, "retired types don't come up");

    // Parts priced by labour type
    const j = await db.job.create({ data: { number: "J-2099-904", title: "LT build", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    made.jobs.push(j.id);
    let part = await json(await post(a, `/api/jobs/${j.id}/parts`, { label: "Frames", days: 2, labourTypeId: carp.id }));
    ok(part.labourType?.name === "Carpenter", "a part can be a labour type");
    await db.user.update({ where: { id: member.id }, data: { costDayRate: 260 } });
    await post(a, `/api/jobs/${j.id}/parts`, { label: "Truck", days: 1, labourTypeId: carp.id, userId: member.id });
    d = await json(await post(a, `/api/jobs/${j.id}/quote`, { markupPct: 25, group: "type" }));
    made.quotes.push(d.id);
    let q = await json(await a(`/api/quotes/${d.id}`));
    const frames = q.lines.find(l => l.description.startsWith("Frames")), truck = q.lines.find(l => l.description.startsWith("Truck"));
    ok(frames.description === "Frames (Carpenter)" && frames.unitCost === 220 && frames.unitPrice === 275, "nobody planned: costed at the Carpenter rate (£220 + 25%)");
    ok(truck.unitCost === 260, "a planned person's own rate wins");
    ok(q.pdfDetail === "lines", "Labour / Materials quotes show the full breakdown");
    d = await json(await post(a, `/api/jobs/${j.id}/quote`, { markupPct: 25, group: "part" }));
    made.quotes.push(d.id);
    q = await json(await a(`/api/quotes/${d.id}`));
    ok(q.pdfDetail === "items", "quotes drafted by part show one price per item");
    q = await json(await a(`/api/quotes/${d.id}`, { method: "PUT", body: JSON.stringify({ pdfDetail: "lines" }) }));
    ok(q.pdfDetail === "lines", "and can be switched to the full breakdown");

    // Templates keep the labour type
    await post(a, `/api/jobs/${j.id}/build-template`, { name: "LT flat", unitName: "flat", units: 2 });
    const t = (await json(await a("/api/spaces/lt-test/build-templates"))).find(x => x.name === "LT flat");
    const j2 = await db.job.create({ data: { number: "J-2099-905", title: "LT build 2", jobType: "workshop", entityId: made.e.id } });
    made.jobs.push(j2.id);
    const parts = await json(await post(a, `/api/jobs/${j2.id}/apply-template`, { templateId: t.id, units: 4 }));
    ok(parts.every(p => p.labourType?.name === "Carpenter"), "parts added from a template keep their labour type");
  } finally {
    await db.user.update({ where: { id: member.id }, data: { costDayRate: null } }).catch(() => {});
    for (const id of made.quotes) if (id) await db.quote.delete({ where: { id } }).catch(() => {});
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
