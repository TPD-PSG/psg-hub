// Shared setup for the API tests: creates throwaway users (…@example.test) with a random password,
// signs them in, and deletes everything afterwards. Runs only against a local dev server.
import { createRequire } from "module";
import crypto from "crypto";
const require = createRequire(process.cwd() + "/package.json");
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run tests against ${BASE}: they create and delete users. Use a local dev server.`);
  process.exit(2);
}

export async function run(name, body) {
  const db = new PrismaClient();
  const pw = crypto.randomBytes(12).toString("hex");
  const users = [
    { email: "test-freelancer@example.test", role: "freelancer", perms: null, team: [1] },
    { email: "test-client@example.test", role: "client", perms: null, team: [] },
    { email: "test-member@example.test", role: "member", perms: JSON.stringify({ modules: ["productions"], allProductions: false }), team: [] },
    { email: "test-admin@example.test", role: "admin", perms: null, team: [] },
  ];
  const results = [];
  const login = async email => {
    const jar = new Map();
    const keep = res => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); jar.set(k, v.join("=")); } };
    const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    let r = await fetch(`${BASE}/api/auth/csrf`); keep(r);
    const { csrfToken } = await r.json();
    r = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie() },
      body: new URLSearchParams({ csrfToken, email, password: pw, callbackUrl: BASE }),
    });
    keep(r);
    const fn = (path, init = {}) => fetch(BASE + path, { ...init, redirect: "manual", headers: { ...(init.headers || {}), cookie: cookie(), "Content-Type": "application/json" } });
    Object.defineProperty(fn, "cookie", { get: cookie });
    return fn;
  };
  const anon = (path, init = {}) => fetch(BASE + path, { ...init, redirect: "manual" });
  const check = async (who, label, p, expect) => {
    const r = await p;
    results.push(`${r.status === expect ? "PASS" : "FAIL"}  ${who.padEnd(10)} ${label.padEnd(44)} got ${r.status} want ${expect}`);
  };
  try {
    const passwordHash = await hash(pw, 10);
    for (const u of users) {
      const row = await db.user.upsert({ where: { email: u.email }, update: { passwordHash, role: u.role, permissions: u.perms }, create: { email: u.email, name: u.email.split("@")[0], role: u.role, permissions: u.perms, passwordHash } });
      u.id = row.id;
      for (const pid of u.team) await db.productionTeam.upsert({ where: { productionId_userId: { productionId: pid, userId: row.id } }, create: { productionId: pid, userId: row.id }, update: {} });
    }
    await body({ db, users, login, anon, check, results });
  } catch (err) {
    results.push(`FAIL  ${name} crashed: ${err?.message ?? err}`);
  } finally {
    const ids = users.map(u => u.id).filter(Boolean);
    await db.notification.deleteMany({ where: { userId: { in: ids } } });
    await db.productionTeam.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
  return results;
}
