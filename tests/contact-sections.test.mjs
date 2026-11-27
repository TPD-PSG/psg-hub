import { run } from "./lib.mjs";

export default () => run("contact-sections", async ({ db, users, login, check, results }) => {
  const f = await login(users[0].email), c = await login(users[1].email), a = await login(users[3].email);
  const before = await db.setting.findUnique({ where: { key: "contact_sections" } });
  const prodBefore = (await db.production.findUnique({ where: { id: 1 }, select: { contactSections: true } })).contactSections;
  try {
    await check("admin", "save company defaults", a("/api/settings", { method: "PUT", body: JSON.stringify({ key: "contact_sections", value: JSON.stringify(["General", "Cast", "Orchestra"]) }) }), 200);
    const st = await (await a("/api/settings")).json();
    results.push(`${st.contact_sections === '["General","Cast","Orchestra"]' ? "PASS" : "FAIL"}  settings returns defaults`);
    await check("freelancer", "can't change company defaults", f("/api/settings", { method: "PUT", body: JSON.stringify({ key: "contact_sections", value: "[]" }) }), 403);
    const r = await f("/api/productions/1/contacts/sections", { method: "PUT", body: JSON.stringify({ sections: [" Wardrobe ", "wardrobe", "Orchestra", 5, ""] }) });
    const d = await r.json();
    results.push(`${r.status === 200 && JSON.stringify(d.sections) === '["Wardrobe","Orchestra"]' ? "PASS" : "FAIL"}  team member sets production sections (cleaned: ${JSON.stringify(d.sections)})`);
    const p = await (await f("/api/productions/1")).json();
    results.push(`${p.contactSections === '["Wardrobe","Orchestra"]' ? "PASS" : "FAIL"}  production payload carries sections`);
    await check("client", "not on team: can't set sections", c("/api/productions/1/contacts/sections", { method: "PUT", body: JSON.stringify({ sections: ["x"] }) }), 403);
    await check("admin", "bad body rejected", a("/api/productions/1/contacts/sections", { method: "PUT", body: JSON.stringify({ sections: "x" }) }), 400);
  } finally {
    if (before) await db.setting.update({ where: { key: "contact_sections" }, data: { value: before.value } });
    else await db.setting.deleteMany({ where: { key: "contact_sections" } });
    await db.production.update({ where: { id: 1 }, data: { contactSections: prodBefore } });
  }
});
