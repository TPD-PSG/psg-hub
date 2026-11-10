const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "/data/prod.db";
const BUCKET = "psg-hub-backups";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

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

  const fileBuffer = fs.readFileSync(DB_PATH);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: "application/octet-stream",
  }));

  console.log(`Backup uploaded: ${key} (${fileBuffer.length} bytes)`);
}

backup().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
