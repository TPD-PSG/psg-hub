import { run, BASE } from "./lib.mjs";

export default () => run("uploads", async ({ db, users, login, anon, check, results }) => {
  const a = await login(users[3].email);
  const before = await db.productionDocument.findMany({ where: { productionId: 1 }, select: { id: true } });
  try {
    const size = 15 * 1024 * 1024;
    const bytes = new Uint8Array(size); for (let i = 0; i < size; i += 4096) bytes[i] = i % 251;
    const fd = new FormData(); fd.append("files", new Blob([bytes], { type: "application/pdf" }), "big-drawing.pdf"); fd.append("file", new Blob([bytes], { type: "application/pdf" }), "big-drawing.pdf");
      const r = await fetch(BASE + "/api/productions/1/documents", { method: "POST", body: fd, headers: { cookie: a.cookie } });
    results.push(`upload 15 MB → status ${r.status}`);
    const after = await db.productionDocument.findMany({ where: { productionId: 1, id: { notIn: before.map(b => b.id) } }, select: { id: true, name: true, data: true } });
    for (const d of after) results.push(`${d.data && Buffer.from(d.data, "base64").length === size ? "PASS" : "INFO"}  stored ${d.name}: ${d.data ? Buffer.from(d.data, "base64").length : 0} bytes (sent ${size})`);
  } finally {
    await db.productionDocument.deleteMany({ where: { productionId: 1, id: { notIn: before.map(b => b.id) } } });
  }
});
