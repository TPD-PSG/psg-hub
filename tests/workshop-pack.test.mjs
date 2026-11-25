import { run, BASE } from "./lib.mjs";

// FR certificates, piece sizes and weights, QR labels and piece pages, and the collection pack.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

export default () => run("workshop-pack", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, , admin] = users;
  const a = await login(admin.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  const html = async r => (await r.text()).replace(/<!-- -->/g, "");
  const made = { e: null, job: null };
  try {
    made.e = await db.entity.create({ data: { name: "Pack test workshop", slug: "pack-test", hasSpace: true, shortName: "PTW" } });
    made.job = await db.job.create({ data: { number: "J-2099-993", title: "PK coach", jobType: "workshop", entityId: made.e.id, stage: "finish", deliveryMethod: "delivery", endDate: new Date("2099-05-01") } });
    const J = made.job.id;
    const cert = (who, fields, file = true) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      if (file) fd.append("file", new Blob([PDF], { type: "application/pdf" }), "cert.pdf");
      return fetch(`${BASE}/api/jobs/${J}/certificates`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
    };

    // Certificates
    ok((await cert(a, { title: "" })).status === 400, "a certificate needs to say what it covers");
    ok((await cert(a, { title: "FR MDF" }, false)).status === 400, "and needs the file");
    ok((await cert(f, { title: "FR MDF" })).status === 403, "freelancers can't add them");
    let certs = await json(await cert(a, { title: "18mm FR MDF", standard: "EN 13501-1 B-s1,d0", supplier: "Stoke Timber", issuedAt: "2099-01-10", expiresAt: "2100-01-10" }));
    certs = await json(await cert(a, { title: "Old serge", standard: "BS 5867-2 Type B", expiresAt: "2001-01-01" }));
    ok(certs.length === 2 && certs.find(x => x.title === "Old serge").expired === true && certs.find(x => x.title === "18mm FR MDF").expired === false, "two certificates; an out-of-date one is flagged expired");
    const files = await json(await a(`/api/jobs/${J}/files`));
    ok(Array.isArray(files) && files.length === 0, "certificates don't show up as reference drawings");
    const certFile = await a(certs[0].url);
    ok(certFile.status === 200 && certFile.headers.get("content-type") === "application/pdf", "the certificate file opens");

    // Pieces with size and weight
    const S = "/api/spaces/pack-test/storage";
    const loc = await db.storageLocation.create({ data: { entityId: made.e.id, name: "Bay 1" } });
    let d = await json(await a(S, { method: "POST", body: JSON.stringify({ pieces: [{ name: "Coach body" }, { name: "Wheels", quantity: 4 }], jobId: J, locationId: loc.id }) }));
    const body = d.pieces.find(p => p.name === "Coach body"), wheels = d.pieces.find(p => p.name === "Wheels");
    const P = id => `/api/stored-pieces/${id}`;
    ok((await a(P(body.id), { method: "PATCH", body: JSON.stringify({ action: "edit", weightKg: -3 }) })).status === 400, "a weight must be more than 0");
    d = await json(await a(P(body.id), { method: "PATCH", body: JSON.stringify({ action: "edit", lengthMm: 2400, widthMm: 1200, heightMm: 1800, weightKg: 85.5 }) }));
    await a(P(wheels.id), { method: "PATCH", body: JSON.stringify({ action: "edit", weightKg: 12 }) });
    ok(d.pieces.find(p => p.id === body.id).weightKg === 85.5 && d.pieces.find(p => p.id === body.id).lengthMm === 2400, "size and weight are saved");

    // Piece page data, QR and labels
    const pc = await json(await a(P(body.id)));
    ok(pc.piece.name === "Coach body" && pc.piece.location.name === "Bay 1" && pc.certs.length === 2 && pc.space.slug === "pack-test", "a piece's page has its location, build and certificates");
    ok((await c(P(body.id))).status === 403, "clients can't open it");
    const qr = await a(`${P(body.id)}/qr`);
    ok(qr.status === 200 && qr.headers.get("content-type") === "image/png", "each piece has a QR code");
    const page = await html(await a(`/spaces/pack-test/pieces/${body.id}`, { headers: { accept: "text/html" } }));
    ok(page.includes("Coach body") && page.includes("Bay 1") && page.includes("2400×1200×1800mm"), "the piece page shows where it is and its size");
    const labels = await html(await a(`/spaces/pack-test/labels?job=${J}`, { headers: { accept: "text/html" } }));
    ok(labels.includes("5 labels for 2 pieces") && labels.includes("4 of 4") && labels.includes(`/api/stored-pieces/${wheels.id}/qr`), "labels: one per item (wheels ×4 gives four), each with its QR");

    // Collection pack data
    const pack = await json(await a(`/api/jobs/${J}/collection-pack`));
    ok(pack.number === "J-2099-993" && pack.storedPieces.length === 2 && pack.certs.length === 2 && pack.deliveryMethod === "delivery", "the collection pack has the pieces, weights and certificates");
    ok(pack.price === undefined && JSON.stringify(pack).indexOf("unitCost") === -1, "and no money");

    // Removing a certificate removes its file
    const fileId = (await db.frCertificate.findFirst({ where: { jobId: J, title: "Old serge" } })).fileId;
    certs = await json(await a(`/api/jobs/${J}/certificates/${certs.find(x => x.title === "Old serge").id}`, { method: "DELETE" }));
    ok(certs.length === 1 && !(await db.jobFile.findUnique({ where: { id: fileId } })), "removing a certificate removes its file");
  } finally {
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
