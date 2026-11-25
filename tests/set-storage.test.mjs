import { run } from "./lib.mjs";

// Set storage: built pieces and where they've been put (no charges). Locations per space; pieces
// put in from a build, moved, sent out, brought back; every move logged; only the space's staff.
export default () => run("set-storage", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const made = { e: null, other: null, job: null, otherJob: null };
  try {
    made.e = await db.entity.create({ data: { name: "Store test workshop", slug: "store-test", hasSpace: true } });
    made.other = await db.entity.create({ data: { name: "Store other co", slug: "store-other", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-991", title: "ST palace", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    made.otherJob = await db.job.create({ data: { number: "J-2099-992", title: "ST elsewhere", jobType: "workshop", entityId: made.other.id } });
    const S = "/api/spaces/store-test/storage";
    const post = (who, url, body) => who(url, { method: "POST", body: JSON.stringify(body) });
    const patch = (who, url, body) => who(url, { method: "PATCH", body: JSON.stringify(body) });

    // Locations
    let d = await json(await post(a, `${S}/locations`, { name: "Bay 3" }));
    d = await json(await post(a, `${S}/locations`, { name: "Container  1" }));
    const bay = d.locations.find(l => l.name === "Bay 3"), box = d.locations.find(l => l.name === "Container 1");
    ok(bay && box, "locations are added (spaces tidied)");
    ok((await post(a, `${S}/locations`, { name: "Bay 3" })).status === 409, "the same name twice is refused");
    ok((await post(f, `${S}/locations`, { name: "Sneaky" })).status === 403 && (await c(S)).status === 403, "freelancers can't change it and clients can't see it");

    // Put pieces in
    ok((await post(a, S, { pieces: [], jobId: made.job.id })).status === 400, "at least one piece");
    ok((await post(a, S, { pieces: [{ name: "x" }], jobId: made.otherJob.id })).status === 400, "only this workshop's builds");
    const otherLoc = await db.storageLocation.create({ data: { entityId: made.other.id, name: "Their bay" } });
    ok((await post(a, S, { pieces: [{ name: "x" }], locationId: otherLoc.id })).status === 400, "only this workshop's locations");
    let r = await post(a, S, { pieces: [{ name: "Palace flats", quantity: 2 }, { name: "Staircase truck" }], jobId: made.job.id, locationId: bay.id, notes: "Wrapped" });
    d = await json(r);
    const flats = d.pieces.find(p => p.name === "Palace flats"), truck = d.pieces.find(p => p.name === "Staircase truck");
    ok(r.status === 201 && flats.quantity === 2 && flats.location.name === "Bay 3" && flats.job.title === "ST palace" && flats.notes === "Wrapped" && !flats.outAt, "two pieces go into Bay 3 from the build in one go");
    ok(flats.moves[0].kind === "in" && flats.moves[0].location === "Bay 3", "putting it in is logged");
    ok(d.locations.find(l => l.id === bay.id).inStore === 2, "Bay 3 shows 2 pieces");

    // Move, out, back
    const P = id => `/api/stored-pieces/${id}`;
    ok((await patch(a, P(flats.id), { action: "move", locationId: bay.id })).status === 400, "moving needs a different location");
    d = await json(await patch(a, P(flats.id), { action: "move", locationId: box.id, note: "Room for the panto" }));
    let fl = d.pieces.find(p => p.id === flats.id);
    ok(fl.location.name === "Container 1" && fl.moves[0].kind === "move" && fl.moves[0].note === "Room for the panto", "moved to Container 1, with the reason logged");
    ok((await patch(a, P(truck.id), { action: "out" })).status === 400, "going out needs to say where");
    d = await json(await patch(a, P(truck.id), { action: "out", note: "Delivered to the Lyceum" }));
    let tr = d.pieces.find(p => p.id === truck.id);
    ok(tr.outAt && tr.outNote === "Delivered to the Lyceum" && d.locations.find(l => l.id === bay.id).inStore === 0, "the truck goes out and Bay 3 is empty");
    ok((await patch(a, P(truck.id), { action: "move", locationId: box.id })).status === 400, "a piece that's gone out can't be moved");
    d = await json(await patch(a, P(truck.id), { action: "back", locationId: bay.id, note: "Back after the run" }));
    tr = d.pieces.find(p => p.id === truck.id);
    ok(!tr.outAt && tr.location.name === "Bay 3" && tr.moves.map(m => m.kind).join(",") === "back,out,in", "it comes back into Bay 3; history reads back, out, in");

    // Locations: rename, retire only when empty
    d = await json(await patch(a, `/api/storage-locations/${box.id}`, { name: "Container 1 (yard)" }));
    ok(d.pieces.find(p => p.id === flats.id).location.name === "Container 1 (yard)", "renaming a location shows on its pieces");
    ok((await patch(a, `/api/storage-locations/${box.id}`, { archived: true })).status === 400, "a location with pieces in can't be retired");
    await patch(a, P(flats.id), { action: "move", locationId: bay.id });
    d = await json(await patch(a, `/api/storage-locations/${box.id}`, { archived: true }));
    ok(d.locations.find(l => l.id === box.id).archived === true, "an empty one can");
    ok((await patch(a, P(flats.id), { action: "move", locationId: box.id })).status === 400, "pieces can't go into a retired location");

    // Build view and page
    const jb = await json(await a(`${S}?jobId=${made.job.id}`));
    ok(jb.pieces.length === 2 && jb.pieces.every(p => p.jobId === made.job.id), "a build's page lists just its pieces");
    const page = await html(await a("/spaces/store-test/storage", { headers: { accept: "text/html" } }));
    ok(page.includes("Set storage") && page.includes("Palace flats") && page.includes('href="/spaces/store-test/storage"'), "the Storage page and its menu link");
    const before = await db.user.findUnique({ where: { id: member.id }, select: { permissions: true } });
    await db.user.update({ where: { id: member.id }, data: { permissions: JSON.stringify({ ...JSON.parse(before.permissions ?? "{}"), entityIds: [made.other.id] }) } });
    const m = await login(member.email);
    ok((await m(S)).status === 403, "someone limited to another company can't open it");
    await db.user.update({ where: { id: member.id }, data: { permissions: before.permissions } });
    ok((await a(P(truck.id), { method: "DELETE" })).status === 200, "an admin can delete a piece added by mistake");
  } finally {
    for (const j of [made.job, made.otherJob]) if (j) await db.job.delete({ where: { id: j.id } }).catch(() => {});
    for (const e of [made.e, made.other]) if (e) await db.entity.delete({ where: { id: e.id } }).catch(() => {});
  }
});
