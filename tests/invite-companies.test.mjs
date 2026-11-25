import { run, BASE } from "./lib.mjs";
import crypto from "crypto";

// Invites carry the person's home company and, for client logins, their client company, so the
// new account is linked as soon as they set a password. (No email is sent here: invites are made
// directly; the create route is only checked for the cases it refuses before emailing.)
export default () => run("invite-companies", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  const a = await login(admin.email);
  const made = { e: null, co: null, emails: [] };
  try {
    made.e = await db.entity.create({ data: { name: "Invite test workshop", slug: "invite-ws", hasSpace: true } });
    made.co = await db.client.create({ data: { name: "Invite Test Theatre", type: "promoter" } });
    const post = body => a("/api/invites", { method: "POST", body: JSON.stringify(body) });
    ok((await post({ name: "X", email: "inv-x@example.test", role: "member", homeEntityId: 9999999 })).status === 400, "an unknown home company is refused");
    ok((await post({ name: "Y", email: "inv-y@example.test", role: "client", clientId: 9999999 })).status === 400, "an unknown client company is refused");

    const pw = crypto.randomBytes(9).toString("hex");
    const mk = async (email, role, extra) => {
      made.emails.push(email);
      const token = `inv-co-${crypto.randomBytes(8).toString("hex")}`;
      await db.userInvite.create({ data: { token, email, name: email.split("@")[0], role, expiresAt: new Date(Date.now() + 86400e3), ...extra } });
      return fetch(`${BASE}/api/invites/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    };
    let r = await mk("inv-staff@example.test", "member", { homeEntityId: made.e.id });
    let u = await db.user.findUnique({ where: { email: "inv-staff@example.test" } });
    ok(r.status === 200 && u?.homeEntityId === made.e.id && u.clientId === null, "a staff invite with a home company: the new account belongs to it");
    r = await mk("inv-client@example.test", "client", { clientId: made.co.id });
    u = await db.user.findUnique({ where: { email: "inv-client@example.test" } });
    ok(r.status === 200 && u?.clientId === made.co.id && u.role === "client", "a client invite: linked to the client company straight away");
    r = await mk("inv-plain@example.test", "member", {});
    u = await db.user.findUnique({ where: { email: "inv-plain@example.test" } });
    ok(r.status === 200 && u?.homeEntityId === null && u.clientId === null, "without companies, nothing is linked");
  } finally {
    await db.user.deleteMany({ where: { email: { in: made.emails } } }).catch(() => {});
    await db.userInvite.deleteMany({ where: { email: { in: [...made.emails, "inv-x@example.test", "inv-y@example.test"] } } }).catch(() => {});
    if (made.co) await db.client.delete({ where: { id: made.co.id } }).catch(() => {});
    if (made.e) await db.entity.delete({ where: { id: made.e.id } }).catch(() => {});
  }
});
