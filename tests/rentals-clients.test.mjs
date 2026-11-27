import { run } from "./lib.mjs";

// PSG Rentals & Crew stage 5: client logins (their hires, accepting a sent quote, asking for one),
// the rate card, and the space's Crew page (diary, who's free).
export default () => run("rentals-clients", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const json = r => r.json();
  const send = (who, url, method, body) => who(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  let entity = null, other = null;
  const clientIds = [], crewIds = [];
  try {
    entity = await db.entity.create({ data: { name: "Rentals clients co", slug: "rentals-cl", hasSpace: true, spaceKind: "rentals", sortOrder: -100 } });
    other = await db.entity.create({ data: { name: "Rentals clients other co", slug: "rentals-cl2", hasSpace: false, spaceKind: "rentals" } });
    const acme = await db.client.create({ data: { name: "Acme Events (test)", type: "corporate", billingEmail: "accounts@acme.example.test" } });
    const rival = await db.client.create({ data: { name: "Rival Co (test)", type: "corporate" } });
    clientIds.push(acme.id, rival.id);
    await db.user.update({ where: { id: client.id }, data: { clientId: acme.id } });
    const c = await login(client.email), m = await login(member.email), f = await login(free.email), a = await login(admin.email);
    const S = "/api/spaces/rentals-cl/rentals";
    const mega = await json(await send(m, `${S}/products`, "POST", { name: "MegaPointe", category: "Lighting", dayRate: 85, weekRate: 255, count: 4 }));
    await send(m, `${S}/products`, "POST", { name: "No price", category: "Lighting", count: 1 });
    await send(m, `${S}/products`, "POST", { name: "Flight case", category: "Cases", isCase: true, dayRate: 5, count: 1 });
    const gone = await json(await send(m, `${S}/products`, "POST", { name: "Old desk", dayRate: 50, count: 1 }));
    await send(m, `/api/rentals/units/${gone.units[0].id}`, "PATCH", { status: "retired" });
    const theirs = await db.rentalProduct.create({ data: { entityId: other.id, name: "Not ours", dayRate: 1 } });

    // ── Staff link a hire to a client company ────────────────────────────────
    let r = await send(m, `${S}/hires`, "POST", { title: "Acme gala", clientId: acme.id, outDate: "2099-08-01", returnDate: "2099-08-03", lines: [{ productId: mega.id, quantity: 2 }], notes: "Internal: they haggle", validUntil: "2099-07-01" });
    const gala = await json(r);
    ok(r.status === 201 && gala.clientId === acme.id && gala.clientName === "Acme Events (test)" && gala.clientEmail === "accounts@acme.example.test", "a hire linked to a client company takes its name and billing email");
    ok((await send(m, `${S}/hires`, "POST", { title: "X", clientId: 999999, outDate: "2099-08-01", returnDate: "2099-08-02" })).status === 400, "only real client companies");
    await db.rentalSubHire.create({ data: { hireId: gala.id, description: "Secret sub-hire", quantity: 1, cost: 123 } });

    // ── The client's view ────────────────────────────────────────────────────
    ok((await f("/api/my-hires")).status === 403 && (await m("/api/my-hires")).status === 403, "My hires is for client logins only");
    let mine = await json(await c("/api/my-hires"));
    ok(!mine.hires.some(h => h.id === gala.id), "a quote the team hasn't sent isn't shown to the client");
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { quoteSent: true });
    mine = await json(await c("/api/my-hires"));
    let h = mine.hires.find(x => x.id === gala.id);
    ok(h && h.priced && h.totals.net === 510 && h.canAccept, "once sent, the client sees the quote with its totals (2 × £255 for 3 days) and can accept it");
    const raw = JSON.stringify(mine);
    ok(!raw.includes("haggle") && !raw.includes("Secret sub-hire") && !raw.includes("123"), "never internal notes, sub-hires or our costs");
    ok(mine.companies.some(x => x.id === entity.id) && !mine.companies.some(x => x.id === other.id), "the client sees rentals companies that have a space");
    const rivalHire = await db.rentalHire.create({ data: { entityId: entity.id, number: "H-2099-901", title: "Rival", clientId: rival.id, status: "confirmed", outDate: new Date("2099-08-01"), returnDate: new Date("2099-08-02") } });
    ok(!(await json(await c("/api/my-hires"))).hires.some(x => x.id === rivalHire.id), "another company's hires stay hidden");
    ok((await send(c, `/api/my-hires/${rivalHire.id}/accept`, "POST")).status === 404, "…and can't be accepted");

    // Accepting
    const before = await db.notification.count({ where: { userId: admin.id } });
    r = await send(c, `/api/my-hires/${gala.id}/accept`, "POST");
    h = (await json(r)).hires.find(x => x.id === gala.id);
    ok(r.status === 200 && h.acceptedAt && /client/.test(h.acceptedBy), "the client accepts the quote");
    ok((await db.rentalHire.findUnique({ where: { id: gala.id } })).status === "quote", "accepting doesn't confirm it: the team does");
    ok((await db.notification.count({ where: { userId: admin.id } })) > before, "PSG is told (the space's people, else admins)");
    ok((await send(c, `/api/my-hires/${gala.id}/accept`, "POST")).status === 409, "a quote is accepted once");
    const list = await json(await m(S));
    ok(list.hires.find(x => x.id === gala.id)?.acceptedAt, "the team's hire list shows it's been accepted");
    const old = await db.rentalHire.create({ data: { entityId: entity.id, number: "H-2099-902", title: "Old quote", clientId: acme.id, status: "quote", quoteSentAt: new Date("2020-01-01"), validUntil: new Date("2020-02-01"), outDate: new Date("2099-09-01"), returnDate: new Date("2099-09-02") } });
    ok((await send(c, `/api/my-hires/${old.id}/accept`, "POST")).status === 409, "a quote past its valid-until date can't be accepted");

    // Asking for a quote
    const R = "/api/my-hires/request";
    ok((await send(c, R, "POST", { companyId: entity.id, outDate: "2099-10-01", returnDate: "2099-10-02", lines: [{ productId: mega.id, quantity: 1 }] })).status === 400, "a request needs a name");
    ok((await send(c, R, "POST", { companyId: entity.id, title: "Past", outDate: "2020-01-01", returnDate: "2020-01-02", notes: "x" })).status === 400, "a request is for dates from today on");
    ok((await send(c, R, "POST", { companyId: entity.id, title: "Odd", outDate: "2099-10-01", returnDate: "2099-10-02", lines: [{ productId: theirs.id, quantity: 1 }] })).status === 400, "only kit on that company's rate card");
    ok((await send(c, R, "POST", { companyId: entity.id, title: "Empty", outDate: "2099-10-01", returnDate: "2099-10-02" })).status === 400, "a request needs kit or a note");
    r = await send(c, R, "POST", { companyId: entity.id, title: "Acme summer party", outDate: "2099-10-01", returnDate: "2099-10-02", delivery: "delivery", deliveryTo: "Acme HQ", notes: "Also need a hazer", lines: [{ productId: mega.id, quantity: 3 }] });
    const reqd = await json(r);
    const made = await db.rentalHire.findFirst({ where: { number: reqd.number }, include: { lines: true } });
    ok(r.status === 201 && made.status === "quote" && made.requestedAt && made.clientId === acme.id && made.lines[0].quantity === 3 && made.lines[0].dayRate === 85 && /hazer/.test(made.notes), `the request arrives as a quote marked requested (${reqd.number}), with the kit at list rates and their note`);
    h = reqd.hires.find(x => x.number === reqd.number);
    ok(h && !h.priced && h.totals === null && !h.canAccept, "the client sees it as being priced (no totals until it's sent)");
    ok((await send(f, R, "POST", { title: "x" })).status === 403, "only client logins ask for quotes this way");

    // ── Rate card ────────────────────────────────────────────────────────────
    r = await c(`/api/rate-card?companyId=${entity.id}`);
    const card = await json(r);
    const names = card.products.map(p => p.name);
    ok(r.status === 200 && names.includes("MegaPointe") && !names.includes("No price") && !names.includes("Flight case") && !names.includes("Old desk"), "the rate card lists priced kit that's in service (not unpriced, cases or retired)");
    ok(!JSON.stringify(card).includes("replacementCost") && !JSON.stringify(card).includes("units"), "it shows rates, never costs or stock");
    ok((await m(`/api/rate-card?companyId=${entity.id}`)).status === 200, "staff see it too");
    ok((await f(`/api/rate-card?companyId=${entity.id}`)).status === 403, "a freelancer doesn't");
    ok((await c(`/api/rate-card?companyId=${other.id}`)).status === 404, "a company without a space has no rate card");

    // ── Where a client login lands ───────────────────────────────────────────
    const home = await c("/");
    ok(/\/my-hires$/.test(home.headers.get("location") ?? ""), "a client who only hires kit lands on their hires");

    // ── The space's Crew page ────────────────────────────────────────────────
    const ann = await db.crew.create({ data: { name: "Ann Crewpage", discipline: "Lighting" } }), bob = await db.crew.create({ data: { name: "Bob Crewpage", discipline: "Sound" } });
    crewIds.push(ann.id, bob.id);
    await send(m, `/api/rentals/hires/${gala.id}`, "PATCH", { status: "confirmed" });
    // The diary covers the next three months
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), after = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);
    const job = await json(await send(m, "/api/crew-jobs", "POST", { hireId: gala.id, role: "Lighting tech", date: soon, places: 2 }));
    await send(m, `/api/crew-jobs/${job.id}/offers`, "POST", { crewIds: [ann.id] });
    const offer = (await json(await m(`/api/crew-jobs?hireId=${gala.id}`))).jobs[0].offers[0];
    await send(m, `/api/crew-offers/${offer.id}`, "PATCH", { action: "book", tell: false });
    r = await m(`${S}/crew?date=${soon}`);
    let crewData = await json(r);
    const d = crewData.diary.find(x => x.id === job.id);
    ok(r.status === 200 && d && d.booked[0]?.name === "Ann Crewpage" && d.places === 2, "the crew diary shows the job, who's booked and the places");
    ok(crewData.crew.find(x => x.id === ann.id).busy.length === 1 && crewData.crew.find(x => x.id === bob.id).busy.length === 0, "who's free that day: Ann's booked, Bob's free");
    crewData = await json(await m(`${S}/crew?date=${after}`));
    ok(crewData.crew.find(x => x.id === ann.id).busy.length === 0, "the next day Ann's free again");
    ok((await f(`${S}/crew`)).status === 403, "the Crew page is for staff");

    // ── The pages open ───────────────────────────────────────────────────────
    const page = async (who, path, text) => { const res = await who(path, { headers: { accept: "text/html" } }); const t = (await res.text()).replace(/<!-- -->/g, ""); return res.status === 200 && t.includes(text); };
    ok(await page(c, "/my-hires", "Acme gala"), "the client's Hires page opens with their hires");
    ok(await page(c, "/my-builds", "/my-hires"), "Builds links across to Hires");
    ok(await page(m, "/spaces/rentals-cl/rates", "Rate card"), "the space's Rate card page opens");
    ok(await page(m, "/spaces/rentals-cl/crew", "Lighting tech"), "the space's Crew page opens with the diary");
  } finally {
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    for (const e of [entity, other]) if (e) { await db.rentalHire.deleteMany({ where: { entityId: e.id } }); await db.entity.delete({ where: { id: e.id } }).catch(() => {}); }
    await db.crew.deleteMany({ where: { id: { in: crewIds } } });
    await db.client.deleteMany({ where: { id: { in: clientIds } } });
  }
});
