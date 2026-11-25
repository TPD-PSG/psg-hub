import { run } from "./lib.mjs";

// TWS builds: six stages on workshop jobs, due-out date, collection or delivery, the show it's
// for, and links to VectorWorks files. Any PSG staff can change these; nobody else.
export default () => run("builds", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  const made = { jobs: [], entity: null, prod: null };
  try {
    let r = await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "Builds test flat", jobType: "workshop" }) });
    const job = await json(r); made.jobs.push(job.id);
    ok(job.stage === "quote" && job.stageChangedAt, "a workshop job opened by hand starts at Quote");
    r = await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "Builds test PM job", jobType: "pm" }) });
    const pm = await json(r); made.jobs.push(pm.id);
    ok(!pm.stage, "other kinds of job have no build stage");

    const patch = (body, who = m, id = job.id) => who(`/api/jobs/${id}/build`, { method: "PATCH", body: JSON.stringify(body) });
    ok((await patch({ stage: "build" }, f)).status === 403, "a freelancer can't move a build");
    ok((await patch({ stage: "build" }, c)).status === 403, "a client can't move a build");
    ok((await patch({ stage: "painting" })).status === 400, "unknown stage refused");
    r = await patch({ stage: "technical_design" });
    let d = (await json(r)).job;
    ok(r.status === 200 && d.stage === "technical_design", "a member moves the build to Technical Design");

    made.prod = await db.production.create({ data: { name: "Builds test show", type: "play" } });
    ok((await patch({ forProductionId: 999999 })).status === 400, "unknown production refused");
    ok((await patch({ deliveryMethod: "teleport" })).status === 400, "collection or delivery only");
    r = await patch({ dueOut: "2026-12-04", deliveryMethod: "delivery", deliveryNotes: "  7.5t, get-in 8am  ", forProductionId: made.prod.id });
    d = (await json(r)).job;
    ok(d.endDate?.startsWith("2026-12-04") && d.deliveryMethod === "delivery" && d.deliveryNotes === "7.5t, get-in 8am" && d.forProduction?.name === "Builds test show",
      "due-out date, delivery, notes and the show it's for saved");
    const before = d.stageChangedAt;
    d = (await json(await patch({ stage: "technical_design", deliveryMethod: "" }))).job;
    ok(d.stageChangedAt === before && d.deliveryMethod === null, "same stage keeps its date; delivery can be cleared");

    // File links
    const link = (body, who = m) => who(`/api/jobs/${job.id}/links`, { method: "POST", body: JSON.stringify(body) });
    ok((await link({ label: "Set model", url: "https://x.sharepoint.com/a.vwx" }, f)).status === 403, "a freelancer can't add links");
    ok((await link({ label: "Set model", url: "javascript:alert(1)" })).status === 400, "only https links");
    ok((await link({ label: "", url: "https://x.sharepoint.com/a.vwx" })).status === 400, "a link needs a name");
    r = await link({ label: "Set model v3", url: "https://x.sharepoint.com/a.vwx" });
    const l = await json(r);
    ok(r.status === 201 && l.kind === "vectorworks", "member adds a VectorWorks link");
    d = (await json(await a(`/api/jobs/${job.id}`))).job;
    ok(d.links?.length === 1 && d.links[0].label === "Set model v3", "the job shows its links");
    ok((await m(`/api/jobs/${pm.id}/links/${l.id}`, { method: "DELETE" })).status === 404, "a link can only be removed from its own job");
    ok((await m(`/api/jobs/${job.id}/links/${l.id}`, { method: "DELETE" })).status === 200, "member removes the link");

    // The space board sees stage and delivery
    made.entity = await db.entity.create({ data: { name: "Builds test co", slug: "builds-test", hasSpace: true } });
    await db.job.update({ where: { id: job.id }, data: { entityId: made.entity.id } });
    await patch({ deliveryMethod: "collection" });
    const sd = await json(await m("/api/spaces/builds-test"));
    const sj = sd.jobs?.find(j => j.id === job.id);
    ok(sj?.stage === "technical_design" && sj.deliveryMethod === "collection" && sj.forProduction?.id === made.prod.id, "space data carries stage, collection and the show");
    const board = await (await m("/spaces/builds-test/board", { headers: { accept: "text/html" } })).text();
    ok(board.includes("Build board") && board.includes("Builds test flat") && board.includes("Technical Design"), "build board page renders the build in its stage");
    // Parts and the planner
    const part = (body, who = m, id = job.id) => who(`/api/jobs/${id}/parts`, { method: "POST", body: JSON.stringify(body) });
    ok((await part({ label: "Frames", days: 2 }, f)).status === 403, "a freelancer can't add parts");
    ok((await part({ label: "", days: 2 })).status === 400, "a part needs a name");
    ok((await part({ label: "Frames", days: 0 })).status === 400, "days from 1 up");
    const p1 = await json(await part({ label: "Truck frames", days: 3, hours: 24, userId: member.id, startDate: "2026-12-07" }));
    const p2 = await json(await part({ label: "Load-out", days: 1 }));
    ok(p1.user?.id === member.id && p1.startDate?.startsWith("2026-12-07") && p1.days === 3 && p2.userId === null, "parts added, one planned and one to plan");
    ok((await m(`/api/jobs/${pm.id}/parts/${p2.id}`, { method: "PATCH", body: JSON.stringify({ done: true }) })).status === 404, "a part can only be changed on its own job");
    let pr = await json(await m(`/api/jobs/${job.id}/parts/${p2.id}`, { method: "PATCH", body: JSON.stringify({ userId: member.id, startDate: "2026-12-08" }) }));
    ok(pr.userId === member.id && pr.startDate?.startsWith("2026-12-08"), "a part is planned onto a person and day");
    const plan = await json(await m("/api/spaces/builds-test/planner?from=2026-12-09"));
    ok(plan.from === "2026-12-07" && plan.days === 14, "planner starts on the Monday of the week asked for");
    ok(plan.parts?.length === 2 && plan.crew?.some(c => c.id === member.id) && plan.jobs?.some(j => j.id === job.id) && plan.canEdit, "planner has the parts, the crew planned on them and the builds");
    ok(!JSON.stringify(plan).includes("price"), "no money in the planner");
    ok((await c("/api/spaces/builds-test/planner")).status === 403, "someone from another company can't open the planner");
    const pp = await (await m("/spaces/builds-test/planner", { headers: { accept: "text/html" } })).text();
    ok(pp.includes("Workshop planner") && pp.includes("Truck frames"), "planner page renders");
    const jp = await (await m(`/spaces/builds-test/jobs/${job.id}`, { headers: { accept: "text/html" } })).text();
    ok(jp.includes("Parts of this build") && jp.includes("Truck frames") && jp.includes("Builds test flat"), "the build's page inside the space renders");
    const other = await m(`/spaces/builds-test/jobs/${pm.id}`, { headers: { accept: "text/html" }, redirect: "manual" });
    ok([303, 307, 308].includes(other.status) || (await other.text()).includes("NEXT_REDIRECT"), "a job from another company goes to the normal Jobs page");
    ok((await m(`/api/jobs/${job.id}/parts/${p2.id}`, { method: "DELETE" })).status === 200, "a part is deleted");
    const list = await json(await m("/api/jobs"));
    ok((Array.isArray(list) ? list : list.jobs ?? []).find(j => j.id === job.id)?.stage === "technical_design", "jobs list carries the stage");
  } finally {
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    if (made.prod) await db.production.delete({ where: { id: made.prod.id } }).catch(() => {});
    if (made.entity) await db.entity.delete({ where: { id: made.entity.id } }).catch(() => {});
  }
});
