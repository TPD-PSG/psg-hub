import { run, BASE } from "./lib.mjs";

// A build's design side: contacts (designer, PM…), designer drawings and model box photos.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

export default () => run("job-design", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email);
  const json = r => r.json();
  const up = (who, jobId, kind, buf, type, name) => {
    const fd = new FormData(); fd.append("kind", kind); fd.append("files", new Blob([buf], { type }), name);
    return fetch(`${BASE}/api/jobs/${jobId}/files`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
  };
  const made = { e: null, job: null, other: null };
  try {
    made.e = await db.entity.create({ data: { name: "Design test co", slug: "design-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-998", title: "DT revolve", jobType: "workshop", entityId: made.e.id } });
    made.other = await db.job.create({ data: { number: "J-2099-999", title: "DT other", jobType: "workshop", entityId: made.e.id } });
    const C = `/api/jobs/${made.job.id}/contacts`;
    ok((await f(C, { method: "POST", body: JSON.stringify({ name: "x" }) })).status === 403, "a freelancer can't add contacts");
    ok((await m(C, { method: "POST", body: JSON.stringify({ name: "" }) })).status === 400, "a contact needs a name");
    ok((await m(C, { method: "POST", body: JSON.stringify({ name: "Ann", email: "nope" }) })).status === 400, "email is checked");
    let list = await json(await m(C, { method: "POST", body: JSON.stringify({ role: "designer", name: "Ann Designer", company: "Studio A", email: "ann@example.test", phone: "07700 900123" }) }));
    ok(list.length === 1 && list[0].role === "designer" && list[0].email === "ann@example.test", "the set designer is added with their details");
    ok((await m(`/api/jobs/${made.other.id}/contacts/${list[0].id}`, { method: "DELETE" })).status === 404, "a contact only changes on its own build");

    ok((await up(m, made.job.id, "design", Buffer.from("<svg/>"), "image/svg+xml", "x.svg")).status === 400, "SVG drawings refused");
    ok((await up(m, made.job.id, "modelbox", PDF, "application/pdf", "m.pdf")).status === 400, "model box takes photos only");
    let r = await up(m, made.job.id, "design", PDF, "application/pdf", "Ground plan.pdf");
    let files = await json(r);
    ok(r.status === 201 && files[0].kind === "design" && files[0].name === "Ground plan.pdf", "the designer's PDF drawing is uploaded");
    files = await json(await up(m, made.job.id, "modelbox", PNG, "image/png", "model.png"));
    const pdf = files.find(x => x.kind === "design"), photo = files.find(x => x.kind === "modelbox");
    const open = await m(pdf.url);
    ok(open.status === 200 && open.headers.get("content-type") === "application/pdf" && (open.headers.get("content-disposition") ?? "").startsWith("inline"), "drawings open in the browser for staff");
    ok((await f(pdf.url)).status === 403, "not for freelancers");
    ok((await a(`/api/job-files/${photo.id}`, { method: "DELETE" })).status === 200, "an admin deletes a model box photo");
    ok((await db.spacePhoto.count({ where: { jobId: made.job.id } })) === 0, "model box photos aren't build photos (no build of the month)");
    const page = (await (await m(`/spaces/design-test/jobs/${made.job.id}`, { headers: { accept: "text/html" } })).text()).replace(/<!-- -->/g, "");
    ok(page.includes("Design &amp; contacts") && page.includes("Ann Designer") && page.includes("Ground plan.pdf") && page.includes("Designer: Ann Designer"), "the build page shows the designer, contacts and drawings");
  } finally {
    for (const j of [made.job, made.other]) if (j) await db.job.delete({ where: { id: j.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
