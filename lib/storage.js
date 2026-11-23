// Uploaded files live in Cloudflare R2 (same account/bucket as backups, under files/).
// If R2 isn't configured (e.g. local dev), files stay in the database as base64, as before.
// Plain JS so the one-off move script (scripts/move-files-to-r2.js) can use it too.
const crypto = require("crypto");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_FILES_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || "psg-hub-backups";
  // R2_ENDPOINT only exists for tests against a local stand-in
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

let client = null;
function s3() {
  const c = config();
  if (!c) return null;
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: c.endpoint,
      forcePathStyle: !!process.env.R2_ENDPOINT,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return { client, bucket: c.bucket };
}

function storageEnabled() {
  return config() !== null;
}

// files/<area>/<yyyy-mm>/<random>-<safe name>
function makeKey(area, filename) {
  const safe = String(filename || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);
  const month = new Date().toISOString().slice(0, 7);
  return `files/${area}/${month}/${crypto.randomBytes(8).toString("hex")}-${safe}`;
}

async function putObject(key, buffer, mime) {
  const r = s3();
  if (!r) throw new Error("R2 is not configured");
  await r.client.send(new PutObjectCommand({ Bucket: r.bucket, Key: key, Body: buffer, ContentType: mime || "application/octet-stream" }));
}

/**
 * Store an uploaded file. Returns what to save on the row:
 * R2 configured → { key, base64: null }; otherwise → { key: null, base64 } (the old behaviour).
 */
async function saveFile(area, filename, buffer, mime) {
  if (!storageEnabled()) return { key: null, base64: Buffer.from(buffer).toString("base64") };
  const key = makeKey(area, filename);
  await putObject(key, Buffer.from(buffer), mime);
  return { key, base64: null };
}

/** The file's bytes, from R2 when it has a key, otherwise from the base64 column. Null if neither. */
async function loadFile(key, base64) {
  if (key) {
    const r = s3();
    if (!r) throw new Error("This file is stored in R2 but R2 isn't configured");
    const out = await r.client.send(new GetObjectCommand({ Bucket: r.bucket, Key: key }));
    return Buffer.from(await out.Body.transformToByteArray());
  }
  return base64 ? Buffer.from(base64, "base64") : null;
}

async function loadBase64(key, base64) {
  if (!key) return base64 || null;
  const buf = await loadFile(key, null);
  return buf ? buf.toString("base64") : null;
}

/** Size in bytes of an object in R2 (used to verify uploads before clearing the database copy). */
async function objectSize(key) {
  const r = s3();
  if (!r) throw new Error("R2 is not configured");
  const out = await r.client.send(new HeadObjectCommand({ Bucket: r.bucket, Key: key }));
  return Number(out.ContentLength);
}

/** Delete from R2 (no-op for files still in the database). Never throws: a leftover object is harmless. */
async function removeFile(key) {
  if (!key) return;
  const r = s3();
  if (!r) return;
  try {
    await r.client.send(new DeleteObjectCommand({ Bucket: r.bucket, Key: key }));
  } catch (err) {
    console.error(`[storage] couldn't delete ${key}:`, err && err.message);
  }
}

module.exports = { storageEnabled, saveFile, loadFile, loadBase64, removeFile, putObject, objectSize, makeKey };
