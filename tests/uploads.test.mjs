import { run, BASE } from "./lib.mjs";

// A 15 MB upload (above Next's old 10 MB proxy limit) must arrive whole and download identically,
// whether files are kept in R2 or (when R2 isn't configured) in the database.
export default () => run("uploads", async ({ db, users, login, results }) => {
  const a = await login(users[3].email);
  const before = await db.productionDocument.findMany({ where: { productionId: 1 }, select: { id: true } });
  try {
    const size = 15 * 1024 * 1024;
    const bytes = new Uint8Array(size); for (let i = 0; i < size; i += 4096) bytes[i] = i % 251;
    const fd = new FormData(); fd.append("file", new Blob([bytes], { type: "application/pdf" }), "big-drawing.pdf");
    const r = await fetch(BASE + "/api/productions/1/documents", { method: "POST", body: fd, headers: { cookie: a.cookie } });
    const doc = await r.json().catch(() => ({}));
    results.push(`${r.status === 201 ? "PASS" : "FAIL"}  admin      upload 15 MB document                        got ${r.status} want 201`);
    if (doc.id) {
      const back = Buffer.from(await (await fetch(`${BASE}/api/production-documents/${doc.id}`, { headers: { cookie: a.cookie } })).arrayBuffer());
      results.push(`${back.length === size && Buffer.compare(back, Buffer.from(bytes)) === 0 ? "PASS" : "FAIL"}  admin      download matches upload byte-for-byte        got ${back.length} bytes`);
      const del = await fetch(`${BASE}/api/production-documents/${doc.id}`, { method: "DELETE", headers: { cookie: a.cookie } });
      results.push(`${del.status === 200 ? "PASS" : "FAIL"}  admin      delete the document                          got ${del.status} want 200`);
    }
  } finally {
    await db.productionDocument.deleteMany({ where: { productionId: 1, id: { notIn: before.map(b => b.id) } } });
  }
});
