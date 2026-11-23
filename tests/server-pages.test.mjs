import { run } from "./lib.mjs";

// Pages that arrive with their data from the server (no empty flash), with the same access rules as the API
export default () => run("server-pages", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const a = await login(users[3].email), f = await login(users[0].email);
  const html = async (who, path) => (await who(path, { headers: { accept: "text/html" } })).text();
  const venue = await db.venue.findFirst({ orderBy: { name: "asc" }, select: { name: true } });
  if (venue) ok((await html(a, "/venues")).includes(venue.name.replace(/&/g, "&amp;")), `venues: "${venue.name}" in the first HTML`);

  const prod1 = await db.production.findUnique({ where: { id: 1 }, select: { name: true } });
  const assignment = await db.staffAssignment.create({ data: { userId: users[3].id, productionId: 1, startDate: new Date(), endDate: new Date(), notes: "staff-only-assignment-note" } });
  try {
    const ac = await html(a, "/calendar");
    ok(ac.includes("staff-only-assignment-note") || ac.includes(prod1.name), "calendar (admin): data in the first HTML");
    const fc = await html(f, "/calendar");
    ok(!fc.includes("staff-only-assignment-note"), "calendar (freelancer): no staff assignments in the page");
  } finally {
    await db.staffAssignment.delete({ where: { id: assignment.id } }).catch(() => {});
  }
});
