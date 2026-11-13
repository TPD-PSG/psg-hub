import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Railway cron daily — backs up the SQLite database file to Cloudflare R2.
// Protected by the same NOTIFY_SECRET used by the daily notify route.
export async function POST(req: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (secret) {
    const auth = req.headers.get("x-notify-secret");
    if (auth !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET ?? "psg-hub-backups";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return NextResponse.json({ error: "Cloudflare R2 env vars not set (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY)" }, { status: 500 });
  }

  // Resolve the SQLite file path from DATABASE_URL (e.g. "file:/data/db.sqlite" or "file:./dev.db")
  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbPath = dbUrl.startsWith("file:")
    ? resolve(dbUrl.replace("file:", ""))
    : resolve("./dev.db");

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(dbPath);
  } catch (err) {
    return NextResponse.json({ error: `Cannot read DB file at ${dbPath}: ${err}` }, { status: 500 });
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `db-backup-${dateStr}.sqlite`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: "application/octet-stream",
    Metadata: {
      "backup-date": now.toISOString(),
      "db-size-bytes": String(fileBuffer.byteLength),
    },
  }));

  // Prune: keep only the 30 most recent backups
  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "db-backup-" }));
  const objects = (list.Contents ?? [])
    .filter(o => o.Key && o.Key !== key)
    .sort((a, b) => (a.LastModified?.getTime() ?? 0) - (b.LastModified?.getTime() ?? 0));

  const toDelete = objects.slice(0, Math.max(0, objects.length - 29)); // keep 29 + today = 30
  for (const obj of toDelete) {
    if (obj.Key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    }
  }

  return NextResponse.json({
    ok: true,
    key,
    sizeBytes: fileBuffer.byteLength,
    sizeMB: (fileBuffer.byteLength / 1024 / 1024).toFixed(2),
    pruned: toDelete.length,
    backupsRetained: objects.length - toDelete.length + 1,
  });
}
