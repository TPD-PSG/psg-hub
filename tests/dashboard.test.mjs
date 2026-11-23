import { run } from "./lib.mjs";

// The dashboard arrives complete from the server, and only shows each person what their modules allow
export default () => run("dashboard", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const a = await login(users[3].email), f = await login(users[0].email);
  const inv = await db.companyInvoice.create({ data: { type: "sales", party: "Dashboard Test Client", description: "dashboard-test", netAmount: 98765, status: "sent" } });
  try {
    const ah = await (await a("/", { headers: { accept: "text/html" } })).text();
    ok(ah.includes("Business Dev") && ah.includes("All Productions") && !/>Loading…</.test(ah), "admin: tiles in the first HTML, no Loading…");
    ok(/£98,765/.test(ah), "admin: unpaid invoice total computed on the server");
    const fh = await (await f("/", { headers: { accept: "text/html" } })).text();
    ok(fh.includes("My Tasks") && !fh.includes("Business Dev"), "freelancer: own tiles only");
    ok(!fh.includes("Dashboard Test Client") && !fh.includes("98,765"), "freelancer: no invoice data in the page");
  } finally {
    await db.companyInvoice.delete({ where: { id: inv.id } }).catch(() => {});
  }
});
