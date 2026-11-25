import { run } from "./lib.mjs";

// The variation PDF's data: staff (with prices) and the client (sent or decided ones on their own
// builds), prices only, never our cost.
export default () => run("variation-pdf", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email);
  const json = r => r.json();
  const made = { e: null, co: null, job: null };
  try {
    made.e = await db.entity.create({ data: { name: "VP workshop", slug: "vp-test", hasSpace: true } });
    made.co = await db.client.create({ data: { name: "VP Theatre", type: "promoter", billingAddress: "1 Stage Door" } });
    made.job = await db.job.create({ data: { number: "J-2099-999", title: "VP coach", jobType: "workshop", entityId: made.e.id, clientId: made.co.id } });
    const mk = (number, status) => db.jobVariation.create({ data: { jobId: made.job.id, number, title: `Extra ${number}`, status, notes: "Stage left", lines: { create: [{ description: "Flat", quantity: 2, unitCost: 50, unitPrice: 80 }] } } });
    const draft = await mk(1, "draft"), sent = await mk(2, "sent");
    await db.user.update({ where: { id: client.id }, data: { clientId: made.co.id } });

    let d = await json(await a(`/api/jobs/${made.job.id}/variations/${draft.id}`));
    ok(d.label === "V1" && d.jobNumber === "J-2099-999" && d.client.billingAddress === "1 Stage Door" && d.lines[0].unitPrice === 80, "staff get the PDF data: job, client, lines");
    ok(d.lines[0].unitCost === undefined && JSON.stringify(d).indexOf("unitCost") === -1, "with prices only, never our cost");
    ok((await m(`/api/jobs/${made.job.id}/variations/${draft.id}`)).status === 403, "not for people who can't see prices");
    const c = await login(client.email);
    ok((await c(`/api/my-builds/variations/${draft.id}`)).status === 404, "the client can't get a draft");
    d = await json(await c(`/api/my-builds/variations/${sent.id}`));
    ok(d.label === "V2" && d.notes === "Stage left" && JSON.stringify(d).indexOf("unitCost") === -1, "the client gets a sent one, prices only");
  } finally {
    await db.user.update({ where: { id: client.id }, data: { clientId: null } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.co) await db.client.delete({ where: { id: made.co.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
