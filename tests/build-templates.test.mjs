import { run } from "./lib.mjs";

// Build templates: save a build's parts and materials per unit, add them to another build scaled
// (days and whole-unit materials round up; pencilled while quoting), replace and delete.
export default () => run("build-templates", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  const made = { e: null, jobs: [] };
  try {
    made.e = await db.entity.create({ data: { name: "BT workshop", slug: "bt-test", hasSpace: true } });
    const j1 = await db.job.create({ data: { number: "J-2099-901", title: "BT six flats", jobType: "workshop", entityId: made.e.id, stage: "build" } });
    const j2 = await db.job.create({ data: { number: "J-2099-902", title: "BT new show", jobType: "workshop", entityId: made.e.id, stage: "quote" } });
    made.jobs.push(j1.id, j2.id);
    const post = (who, url, body) => who(url, { method: "POST", body: JSON.stringify(body) });

    ok((await post(a, `/api/jobs/${j1.id}/build-template`, { name: "Flat", units: 6 })).status === 400, "a template needs the build's parts first");
    const p = await db.buildPart.create({ data: { jobId: j1.id, label: "Frames and skins", days: 3, userId: member.id } });
    await db.buildPartMaterial.createMany({ data: [
      { partId: p.id, description: "18mm ply", quantity: 6, unit: "sheets", unitCost: 31.5 },
      { partId: p.id, description: "Pine 3x1", quantity: 60, unit: "m", unitCost: 1.85 },
    ] });
    await db.buildPart.create({ data: { jobId: j1.id, label: "Paint", days: 1, hours: 6 } });
    ok((await post(f, `/api/jobs/${j1.id}/build-template`, { name: "Flat", units: 6 })).status === 403, "freelancers can't save templates");
    let r = await post(a, `/api/jobs/${j1.id}/build-template`, { name: "Standard flat", unitName: "flat", units: 6, notes: "Hard-covered" });
    ok(r.status === 201, "saved as 'Standard flat', per flat (the build was 6)");
    ok((await post(a, `/api/jobs/${j1.id}/build-template`, { name: "Standard flat", units: 6 })).status === 409, "the same name twice asks first");
    ok((await post(a, `/api/jobs/${j1.id}/build-template`, { name: "Standard flat", unitName: "flat", units: 6, replace: true })).status === 200, "and can replace it");

    const list = await json(await a("/api/spaces/bt-test/build-templates"));
    const t = list.find(x => x.name === "Standard flat");
    ok(t && t.unitName === "flat" && t.materials === 2 && t.materialsCost === 50 && t.parts.includes("Frames and skins"), "the list shows it per flat: £50 of materials (£31.50 ply + £18.50 pine)");

    // Add 8 flats to the new show
    let parts = await json(await post(a, `/api/jobs/${j2.id}/apply-template`, { templateId: t.id, units: 8 }));
    const frames = parts.find(x => x.label.startsWith("Frames and skins"));
    const paint = parts.find(x => x.label.startsWith("Paint"));
    ok(frames.label === "Frames and skins (8 flat)" && frames.days === 4 && frames.userId === null && frames.pencilled === true, "8 flats: frames take 4 days (3 ÷ 6 × 8), nobody planned, pencilled while quoting");
    ok(paint.hours === 8 && paint.days === 2, "hours scale too (6 ÷ 6 × 8 = 8); 1 ÷ 6 × 8 days rounds up to 2");
    ok(frames.materials.find(m => m.description === "18mm ply").quantity === 8 && frames.materials.find(m => m.description === "Pine 3x1").quantity === 80, "ply 8 sheets, pine 80 m");
    parts = await json(await post(a, `/api/jobs/${j2.id}/apply-template`, { templateId: t.id, units: 2.5 }));
    ok(parts.find(x => x.label === "Frames and skins (2.5 flat)").materials.find(m => m.description === "18mm ply").quantity === 3, "whole sheets round up (2.5 flats → 3 sheets)");
    ok((await post(a, `/api/jobs/${j2.id}/apply-template`, { templateId: t.id, units: 0 })).status === 400, "how many must be more than 0");

    // Another space can't use it
    const other = await db.entity.create({ data: { name: "BT other", slug: "bt-other", hasSpace: true } });
    const j3 = await db.job.create({ data: { number: "J-2099-903", title: "BT other job", jobType: "workshop", entityId: other.id } });
    ok((await post(a, `/api/jobs/${j3.id}/apply-template`, { templateId: t.id, units: 1 })).status === 400, "another workshop's builds can't use it");
    await db.job.delete({ where: { id: j3.id } }); await db.entity.delete({ where: { id: other.id } });

    ok((await a(`/api/build-templates/${t.id}`, { method: "DELETE" })).status === 200 && !(await db.buildTemplate.findUnique({ where: { id: t.id } })), "an admin can delete it");
  } finally {
    for (const id of made.jobs) await db.job.delete({ where: { id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
