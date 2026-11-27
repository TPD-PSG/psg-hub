import { run } from "./lib.mjs";

// A quote's items are the build's parts (28 Nov 2026): on a quote linked to a build, each item is
// one of the build's parts (labour lines → time, material lines → materials), pencilled until the
// quote is accepted, kept in step on each save, renamed with its item, and taken off the build when
// the item goes, unless someone has started on it.
export default () => run("quote-parts", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  let e = null;
  const a = await login(admin.email);
  const json = r => r.json();
  try {
    e = await db.entity.create({ data: { name: "QP test workshop", slug: "qp-test", hasSpace: true } });
    const carp = await db.labourType.create({ data: { entityId: e.id, name: "Carpenter", dayRate: 200 } });
    const job = await json(await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "QP build", jobType: "workshop", entityId: e.id }) }));
    const L = (section, description, quantity, unit, kind, extra = {}) => ({ section, description, quantity, unit, unitCost: 10, unitPrice: 20, kind, ...extra });
    const lines = [
      L("Coffin Refit", "Carpenter", 2, "days", "labour"), L("Coffin Refit", "Paint", 4, "hours", "labour"), L("Coffin Refit", "18mm ply", 4, "sheets", "material"),
      L("Coffin Lid", "Hinges", 2, "each", "material"),
      L("Option", "Velvet", 3, "m", "material", { leaveOut: true }),
    ];
    const q = await json(await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "QP quote", entityId: e.id, jobId: job.id, lines }) }));
    const parts = () => db.buildPart.findMany({ where: { jobId: job.id }, include: { materials: true }, orderBy: { id: "asc" } });
    let ps = await parts();
    const refit = ps.find(p => p.label === "Coffin Refit");
    ok(ps.length === 2 && refit && ps.some(p => p.label === "Coffin Lid"), "each item on a quote for a build becomes one of its parts (not the left-out item)");
    ok(refit.hours === 20 && refit.days === 3 && refit.labourTypeId === carp.id && refit.pencilled, "labour lines set the part's time (2 days + 4 h = 20 h, 3 days) and labour type; pencilled while quoting");
    ok(refit.materials.length === 1 && refit.materials[0].description === "18mm ply" && refit.materials[0].quantity === 4 && refit.materials[0].fromQuote, "material lines become the part's materials");

    // Change, rename and remove items
    const next = [
      L("Coffin Refit (big)", "Carpenter", 2, "days", "labour"), L("Coffin Refit (big)", "18mm ply", 6, "sheets", "material"),
      L("Coffin Lid", "Hinges", 2, "each", "material"),
    ];
    await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines: next, renamedItems: { "Coffin Refit": "Coffin Refit (big)" } }) });
    ps = await parts();
    const big = ps.find(p => p.id === refit.id);
    ok(big?.label === "Coffin Refit (big)" && big.hours === 16 && big.materials.length === 1 && big.materials[0].quantity === 6, "renaming the item renames the same part; its time and materials follow the quote");

    // Someone starts on the lid, then the lid comes off the quote: it stays (unlinked). A fresh item removed: gone.
    const lid = ps.find(p => p.label === "Coffin Lid");
    await db.buildPart.update({ where: { id: lid.id }, data: { userId: admin.id, startDate: new Date("2099-01-05") } });
    await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines: [...next.slice(0, 2), L("Base", "Castors", 4, "each", "material")] }) });
    ps = await parts();
    ok(ps.some(p => p.id === lid.id && p.quoteId === null) && ps.some(p => p.label === "Base"), "an item removed after someone started on its part leaves the part on the build");
    await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ lines: next.slice(0, 2) }) });
    ok(!(await parts()).some(p => p.label === "Base"), "an item removed before anyone started on it takes its part off the build");

    // Accepting firms the parts up and leaves them to the planner
    await a(`/api/quotes/${q.id}`, { method: "PUT", body: JSON.stringify({ status: "accepted" }) });
    ok((await parts()).filter(p => p.quoteId === q.id).every(p => !p.pencilled), "accepting the quote firms up its parts");

    // Quote this build: parts drafted into a quote are linked, so saving it doesn't double them
    const job2 = await json(await a("/api/jobs", { method: "POST", body: JSON.stringify({ title: "QP build 2", jobType: "workshop", entityId: e.id }) }));
    await db.buildPart.create({ data: { jobId: job2.id, label: "Frame", days: 2, labourTypeId: carp.id, materials: { create: [{ description: "Steel box", quantity: 3, unit: "lengths", unitCost: 30 }] } } });
    const q2 = await json(await a(`/api/jobs/${job2.id}/quote`, { method: "POST", body: JSON.stringify({ markupPct: 30, group: "part" }) }));
    const full = await json(await a(`/api/quotes/${q2.id}`));
    await a(`/api/quotes/${q2.id}`, { method: "PUT", body: JSON.stringify({ lines: full.lines }) });
    const p2 = await db.buildPart.findMany({ where: { jobId: job2.id }, include: { materials: true } });
    ok(p2.length === 1 && p2[0].quoteId === q2.id && p2[0].materials.length === 1, "Quote this build links the parts to its items: saving it adds no copies");

    // A draft quote deleted: its parts nobody started on go too
    const q3 = await json(await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "QP quote 3", entityId: e.id, jobId: job2.id, lines: [L("Extra", "Bracket", 1, "each", "material")] }) }));
    ok((await db.buildPart.count({ where: { quoteId: q3.id } })) === 1, "a second quote's items are parts too");
    await a(`/api/quotes/${q3.id}`, { method: "DELETE" });
    ok((await db.buildPart.count({ where: { jobId: job2.id, label: "Extra" } })) === 0, "deleting a draft quote takes its untouched parts with it");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (e) {
      await db.quote.deleteMany({ where: { entityId: e.id } });
      await db.job.deleteMany({ where: { entityId: e.id } });
      await db.entity.delete({ where: { id: e.id } }).catch(() => {});
    }
  }
});
