import { run } from "./lib.mjs";

// BD pipeline & revenue, part 1: entities and targets (admin-only writes), deal fields, stage
// changes logged automatically, the activity log and follow-up dates.
export default () => run("bd-pipeline", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = (r) => r.json();
  const NAME = "BD Test Entity", year = new Date().getFullYear();
  let entityId, oppId;
  try {
    // Entities and targets
    let r = await a("/api/entities", { method: "POST", body: JSON.stringify({ name: NAME }) });
    const en = await json(r); entityId = en.id;
    ok(r.status === 201 && en.name === NAME, "admin adds an entity");
    ok((await a("/api/entities", { method: "POST", body: JSON.stringify({ name: NAME }) })).status === 409, "duplicate entity name refused");
    ok((await m("/api/entities", { method: "POST", body: JSON.stringify({ name: "Member entity" }) })).status === 403, "member can't add entities");
    ok((await f("/api/entities")).status === 200, "freelancer (productions access) can read entities");
    r = await a(`/api/entities/${entityId}/targets`, { method: "PUT", body: JSON.stringify({ year, amount: "600000" }) });
    ok(r.status === 200 && (await json(r)).amount === 600000, "admin sets this year's target");
    ok((await m(`/api/entities/${entityId}/targets`, { method: "PUT", body: JSON.stringify({ year, amount: 1 }) })).status === 403, "member can't set targets");
    const listed = (await json(await a("/api/entities"))).find(e => e.id === entityId);
    ok(listed?.targets?.[0]?.amount === 600000, "entities list includes targets");

    // A deal: owner defaults to whoever adds it; the API logs "Deal added"
    r = await a("/api/opportunities", { method: "POST", body: JSON.stringify({ title: "BD test deal", value: "40000", entityId: String(entityId), ownerUserId: "", leadSource: "Referral", competitor: "Rival Ltd" }) });
    const opp = await json(r); oppId = opp.id;
    ok(r.status === 201 && opp.ownerUserId === admin.id && opp.entity?.name === NAME && opp.leadSource === "Referral", "new deal: entity, lead source, owner defaults to creator");
    ok(opp.stage === "lead" && opp.lastActivityAt, "new deal starts as a lead with its creation logged");

    // Stage change: stamped and logged; a partial update leaves other fields alone
    r = await a(`/api/opportunities/${oppId}`, { method: "PUT", body: JSON.stringify({ stage: "proposal" }) });
    const moved = await json(r);
    ok(moved.stage === "proposal" && moved.stageChangedAt && moved.title === "BD test deal" && moved.value === 40000 && moved.competitor === "Rival Ltd", "stage change keeps the other fields");
    let acts = await json(await a(`/api/opportunities/${oppId}/activities`));
    ok(acts.some(x => x.kind === "stage" && x.text === "Lead → Proposal"), "stage change logged as 'Lead → Proposal'");
    r = await a(`/api/opportunities/${oppId}`, { method: "PUT", body: JSON.stringify({ probability: 150 }) });
    ok((await json(r)).probability === 100, "own % is capped at 100");

    // Activity log and follow-up date
    r = await a(`/api/opportunities/${oppId}/activities`, { method: "POST", body: JSON.stringify({ kind: "call", text: "Spoke to the producer", followUpDate: "2030-01-15" }) });
    ok(r.status === 201 && (await json(r)).user?.id === admin.id, "admin logs a call");
    const after = (await json(await a("/api/opportunities"))).find(o => o.id === oppId);
    ok(after.followUpDate?.startsWith("2030-01-15"), "logging an activity sets the next follow-up");
    ok((await a(`/api/opportunities/${oppId}/activities`, { method: "POST", body: JSON.stringify({ text: "  " }) })).status === 400, "empty activity refused");
    ok((await f(`/api/opportunities/${oppId}/activities`, { method: "POST", body: JSON.stringify({ text: "x" }) })).status === 403, "freelancer can't log activity");
    acts = await json(await a(`/api/opportunities/${oppId}/activities`));
    ok(acts[0]?.text === "Spoke to the producer" && acts[0]?.kind === "call", "newest activity first");

    // An entity in use can't be deleted, only archived
    ok((await a(`/api/entities/${entityId}`, { method: "DELETE" })).status === 409, "entity in use can't be deleted");
    r = await a(`/api/entities/${entityId}`, { method: "PUT", body: JSON.stringify({ archived: true }) });
    ok((await json(r)).archived === true, "entity can be archived");

    // Pages: BD shows the deal's entity; Hub Settings lists entities
    const bd = await (await a("/bd", { headers: { accept: "text/html" } })).text();
    ok(bd.includes("BD test deal") && bd.includes(NAME), "/bd: deal and its entity in the first HTML");
    const hs = await (await a("/admin/settings", { headers: { accept: "text/html" } })).text();
    ok(hs.includes("Entities &amp; revenue targets") && hs.includes(NAME), "Hub Settings lists entities");
  } finally {
    if (oppId) await db.opportunity.delete({ where: { id: oppId } }).catch(() => {});
    if (entityId) await db.entity.delete({ where: { id: entityId } }).catch(() => {});
  }
});
