import { run, BASE } from "./lib.mjs";

// Live security check (27 Nov 2026): the public toolbox-talk form no longer lets anyone list show
// names and tours by trying numbers. New QR codes use a private token; old numeric links only
// open shows in production (not NDA); the QR image needs a login; the sidebar has its own route.
export default () => run("toolbox-links", async ({ db, users, login, anon, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, , admin] = users;
  const sigBody = JSON.stringify({ signeeName: "Toolbox link test", signeeDate: "2026-11-27", signature: "data:image/png;base64,AAAA" });
  const post = (key) => anon(`/api/productions/${key}/toolbox-signatures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: sigBody });
  const p1 = await db.production.findUnique({ where: { id: 1 }, select: { status: true, announcementStatus: true, toolboxToken: true } });
  try {
    // Numbers: a planning or NDA show is invisible and can't be signed for
    ok((await anon("/api/productions/1/toolbox-info")).status === 404, "a planning/NDA show can't be looked up by number");
    ok((await post(1)).status === 404, "nor signed for by number");
    ok((await anon("/api/productions/999999/toolbox-info")).status === 404 && (await anon("/api/productions/abc/toolbox-info")).status === 404, "unknown numbers and made-up links get not found");
    // The QR image and its link need a login, and access to the show
    ok((await anon("/api/productions/1/toolbox-qr", { redirect: "manual" })).status >= 300, "the QR image needs a login");
    const c = await login(client.email);
    ok((await c("/api/productions/1/toolbox-qr")).status === 403, "someone without access to the show can't get its QR code");
    const f = await login(free.email);
    const qr = await f("/api/productions/1/toolbox-qr");
    ok(qr.status === 200 && (qr.headers.get("content-type") || "").includes("image/png"), "the show's team gets the QR image");
    const go = await f("/api/productions/1/toolbox-qr?go=1&stopId=5", { redirect: "manual" });
    const loc = go.headers.get("location") || "";
    const token = (loc.match(/\/toolbox-talk\/([A-Za-z0-9_-]+)/) || [])[1];
    ok(go.status >= 300 && go.status < 400 && token && !/^\d+$/.test(token) && loc.includes("stopId=5"), "'Open form' goes to the private link, keeping the venue");
    ok((await db.production.findUnique({ where: { id: 1 }, select: { toolboxToken: true } })).toolboxToken === token, "the token is kept on the show, so printed codes keep working");
    // The private link works for any live show, even planning/NDA
    const info = await anon(`/api/productions/${token}/toolbox-info`);
    ok(info.status === 200 && typeof (await info.json()).name === "string", "the private link opens the form");
    const s = await post(token);
    const sig = s.ok ? await s.json() : null;
    ok(s.status === 201 && sig?.productionId === 1, "a sign-off through the private link lands on the right show");
    if (sig) await db.toolboxTalkSignature.delete({ where: { id: sig.id } });
    ok((await fetch(`${BASE}/toolbox-talk/${token}`)).status === 200, "the form page opens from the private link, signed out");
    // An archived show's private link stops working
    await db.production.update({ where: { id: 1 }, data: { archived: true } });
    ok((await anon(`/api/productions/${token}/toolbox-info`)).status === 404, "an archived show's link stops working");
    await db.production.update({ where: { id: 1 }, data: { archived: false } });
    // The sidebar look-up needs a login and access
    ok((await (await f("/api/productions/1/summary")).json()).name !== undefined, "the sidebar gets the show's name from its own route");
    ok((await c("/api/productions/1/summary")).status === 403 && (await anon("/api/productions/1/summary", { redirect: "manual" })).status >= 300, "but only for people with access");
    const a = await login(admin.email);
    ok((await a("/api/productions/1/summary")).ok, "admins too");
  } finally {
    await db.production.update({ where: { id: 1 }, data: { archived: false, toolboxToken: p1?.toolboxToken ?? null } }).catch(() => {});
    await db.toolboxTalkSignature.deleteMany({ where: { signeeName: "Toolbox link test" } }).catch(() => {});
  }
});
