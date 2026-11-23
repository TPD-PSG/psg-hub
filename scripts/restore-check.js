// Proves the newest R2 backup can actually be restored: downloads it to a temp file, runs
// SQLite's integrity check, and compares row counts table by table with the live database
// (opened read-only). Nothing live is changed; the temp copy is deleted afterwards.
//
//   railway ssh -- node scripts/restore-check.js            (on the server)
//   node scripts/restore-check.js backups/2026-11-23T...db  (a specific backup)
//
// To actually restore after a disaster: stop the app, download the chosen backup the same
// way, copy it over /data/prod.db, and start the app again (start.sh runs any migrations).
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { databaseUrl } = require("../lib/database-url");

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "psg-hub-backups";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

async function main() {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) throw new Error("Missing R2 credentials");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: !!process.env.R2_ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });

  let key = process.argv[2];
  if (!key) {
    const keys = [];
    let token;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "backups/", ContinuationToken: token }));
      for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    keys.sort();
    key = keys.at(-1);
    console.log(`${keys.length} hourly/daily backups in R2; newest ${key}`);
    if (!key) throw new Error("No backups found");
  }

  const file = path.join(os.tmpdir(), `restore-check-${Date.now()}.db`);
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    fs.writeFileSync(file, Buffer.from(await obj.Body.transformToByteArray()));
    console.log(`Downloaded ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB`);

    const backup = new Database(file, { readonly: true });
    const integrity = backup.pragma("integrity_check", { simple: true });
    console.log(`Integrity check: ${integrity}`);

    const live = new Database(databaseUrl().replace(/^file:/, ""), { readonly: true, fileMustExist: true });
    const tables = backup.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name").all().map(r => r.name);
    const count = (db, t) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n; } catch { return null; } };
    let rowsBackup = 0, differ = 0;
    for (const t of tables) {
      const b = count(backup, t), l = count(live, t);
      rowsBackup += b ?? 0;
      if (b !== l) { differ++; console.log(`  ${t}: backup ${b}, live ${l ?? "missing"}`); }
    }
    console.log(`${tables.length} tables, ${rowsBackup} rows in the backup; ${differ ? `${differ} table(s) differ (changes since the backup was taken)` : "every table matches live"}`);
    backup.close(); live.close();
    if (integrity !== "ok") process.exitCode = 1;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

main().catch(err => { console.error("Restore check failed:", err.message); process.exit(1); });
