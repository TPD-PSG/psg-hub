// Moves uploaded files that are still stored in the database (base64) into Cloudflare R2.
// Safe to run any number of times: each file is uploaded, its size checked in R2, and only
// then is the database copy cleared. Does nothing if R2 isn't configured.
// Runs in the background on every start (see railway.json); `node scripts/move-files-to-r2.js` by hand works too.
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { storageEnabled, putObject, objectSize, makeKey } = require("../lib/storage");

// table, area in R2, the base64 column, the key column, what "cleared" means for that column, how to name it
const TABLES = [
  { model: "productionDocument", area: "production-documents", blob: "data", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "hSDocument", area: "hs-documents", blob: "data", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "venueDocument", area: "venue-documents", blob: "file", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "spendDocument", area: "spend-documents", blob: "file", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "productionExpenseDocument", area: "expense-documents", blob: "file", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "knowledgeDoc", area: "knowledge-docs", blob: "file", key: "fileKey", cleared: "", name: r => r.name, mime: r => r.mime },
  { model: "showReport", area: "show-reports", blob: "rawPdf", key: "pdfKey", cleared: null, name: r => `${r.emailSubject || "show-report-" + r.id}.pdf`, mime: () => "application/pdf" },
  { model: "venue", area: "venue-tech-specs", blob: "techSpecFile", key: "techSpecFileKey", cleared: null, name: r => r.techSpecName || `tech-spec-${r.id}`, mime: r => r.techSpecMime },
];

async function main() {
  if (!storageEnabled()) {
    console.log("[move-files] R2 isn't configured; files stay in the database.");
    return;
  }
  const db = new PrismaClient();
  let moved = 0, bytes = 0, failed = 0;
  try {
    for (const t of TABLES) {
      const shared = new Map(); // content hash → key, so identical files (e.g. one PDF, two reports) share one object
      const skip = []; // rows that failed this run: left in the database, retried next start
      for (;;) {
        // A few at a time: each row holds a whole file
        const rows = await db[t.model].findMany({
          where: {
            [t.key]: null,
            // nullable columns (show-report PDF, venue tech spec) also need a null check
            ...(t.cleared === null ? { [t.blob]: { not: null } } : {}),
            NOT: { [t.blob]: "" },
            id: { notIn: skip },
          },
          take: 10,
          orderBy: { id: "asc" },
        });
        if (!rows.length) break;
        for (const row of rows) {
          try {
            const buf = Buffer.from(row[t.blob], "base64");
            const hash = crypto.createHash("sha256").update(buf).digest("hex");
            let key = shared.get(hash);
            if (!key) {
              key = makeKey(t.area, t.name(row));
              await putObject(key, buf, t.mime(row));
              const size = await objectSize(key);
              if (size !== buf.length) throw new Error(`size mismatch in R2 (${size} vs ${buf.length})`);
              shared.set(hash, key);
              bytes += buf.length;
            }
            // Only now that R2 holds it is the database copy cleared
            await db[t.model].update({ where: { id: row.id }, data: { [t.key]: key, [t.blob]: t.cleared } });
            moved++;
          } catch (err) {
            failed++;
            skip.push(row.id);
            console.error(`[move-files] ${t.model} ${row.id} not moved (kept in the database): ${err.message}`);
          }
        }
      }
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`[move-files] moved ${moved} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB to R2${failed ? `; ${failed} left in the database, retried next start` : ""}.`);
}

main().catch(err => {
  console.error("[move-files] failed:", err.message);
  process.exitCode = 1;
});
