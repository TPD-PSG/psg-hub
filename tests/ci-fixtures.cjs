// Minimal data the API tests expect (productions 1 and 2, venues, a tour stop, a show report
// and budget lines on each), for a fresh database in CI. Does nothing if any production exists,
// so it can never touch a real database.
const { createPrismaClient } = require("../lib/prisma-client");

(async () => {
  const db = createPrismaClient();
  try {
    if (await db.production.count()) { console.log("Productions exist; fixtures skipped"); return; }
    const [v1, v2] = await Promise.all([
      db.venue.create({ data: { name: "Alpha Theatre", type: "theatre", city: "Testtown" } }),
      db.venue.create({ data: { name: "Beta Playhouse", type: "theatre", city: "Testville" } }),
    ]);
    for (const [id, name, venue] of [[1, "CI Production One", v1], [2, "CI Production Two", v2]]) {
      await db.production.create({ data: { id, name, type: "play" } });
      await db.tourStop.create({ data: { productionId: id, venueId: venue.id } });
      await db.budgetLine.create({ data: { productionId: id, department: "Set", description: "CI line", budgeted: 1000 } });
      await db.showReport.create({ data: { productionId: id, reportDate: new Date("2026-01-10"), performanceNumber: 1, venue: venue.name } });
    }
    console.log("CI fixtures created");
  } finally {
    await db.$disconnect();
  }
})();
