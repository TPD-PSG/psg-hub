const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const { snapshotDatabase } = require("../lib/db-snapshot");

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "/data/prod.db";
// Same variables as /api/backup, with the older R2_* names still accepted
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "psg-hub-backups";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing R2 credentials");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

async function backup() {
  if (!fs.existsSync(DB_PATH)) {
    console.log(`Database not found at ${DB_PATH}, skipping backup`);
    return;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const key = `backups/${timestamp}.db`;

  const fileBuffer = await snapshotDatabase();

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: "application/octet-stream",
  }));

  console.log(`Backup uploaded: ${key} (${fileBuffer.length} bytes)`);
  await prune(now);
}

// Keep every backup from the last 48 hours, then the first backup of each day for 30 days.
// Only touches backups/ (uploaded files live under files/, the daily route's under db-backup-).
async function prune(now) {
  const keys = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "backups/", ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  // Keys look like backups/2026-11-23T19-59-30-123Z.db, so sorting them sorts by time
  keys.sort();
  const keepDays = new Set();
  const toDelete = [];
  for (const key of keys) {
    const m = key.match(/^backups\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!m) continue; // not one of ours: leave it alone
    const at = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
    const ageH = (now - at) / 3600e3;
    if (ageH <= 48) continue;
    if (ageH <= 30 * 24 && !keepDays.has(m[1])) { keepDays.add(m[1]); continue; }
    toDelete.push(key);
  }
  for (const key of toDelete) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  if (toDelete.length) console.log(`Pruned ${toDelete.length} old backup(s)`);
}

backup().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
