import { run, BASE } from "./lib.mjs";

// Overdue meeting actions are chased with whoever ran the meeting, one reminder per meeting, by
// the daily notification job (it needs NOTIFY_SECRET for the server and the tests, like CI has).
export default () => run("meeting-chase", async ({ db, users, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) { results.push("PASS  skipped: NOTIFY_SECRET isn't set here (it is in CI)"); return; }
  const [, , member, admin] = users;
  const made = { prod: null };
  const since = new Date();
  try {
    made.prod = await db.production.create({ data: { name: "Chase test show", type: "Other" } });
    const mt = await db.meeting.create({ data: { productionId: made.prod.id, title: "Chase PM 1", meetingDate: new Date(Date.now() - 10 * 86400e3), createdByUserId: admin.id } });
    const past = d => new Date(Date.now() - d * 86400e3);
    await db.task.createMany({ data: [
      { productionId: made.prod.id, meetingId: mt.id, title: "Send revised plot", assigneeName: "Sam (venue)", dueDate: past(3), createdByUserId: admin.id },
      { productionId: made.prod.id, meetingId: mt.id, title: "Book the follow spot op", assigneeUserId: member.id, dueDate: past(1), createdByUserId: admin.id },
      { productionId: made.prod.id, meetingId: mt.id, title: "Done already", assigneeName: "Jo", status: "done", dueDate: past(5), createdByUserId: admin.id },
      { productionId: made.prod.id, meetingId: mt.id, title: "Not due yet", assigneeName: "Jo", dueDate: new Date(Date.now() + 5 * 86400e3), createdByUserId: admin.id },
    ] });
    const runJob = () => fetch(`${BASE}/api/notify/daily`, { method: "POST", headers: { "x-notify-secret": secret } });
    ok((await fetch(`${BASE}/api/notify/daily`, { method: "POST" })).status === 401, "the job needs its secret");
    const r = await runJob();
    ok(r.status === 200, "the daily job runs");
    const link = `/productions/${made.prod.id}?section=meetings&meeting=${mt.id}`;
    const n = await db.notification.findMany({ where: { userId: admin.id, link, createdAt: { gte: since } } });
    ok(n.length === 1 && n[0].title.startsWith("2 overdue actions from Chase PM 1"), "whoever ran the meeting gets one reminder: 2 overdue actions");
    ok(n[0].body.includes("Send revised plot (Sam (venue), due") && n[0].body.includes("Book the follow spot op") && !n[0].body.includes("Done already") && !n[0].body.includes("Not due yet"), "it lists each overdue action and who has it, not done or future ones");
    ok((await db.notification.count({ where: { userId: member.id, createdAt: { gte: since }, title: { contains: "Book the follow spot op" } } })) === 1, "the assignee with a login still gets their own reminder");
    await runJob();
    ok((await db.notification.count({ where: { userId: admin.id, link, createdAt: { gte: since } } })) === 1, "running again the same day doesn't repeat it");
  } finally {
    if (made.prod) {
      await db.notification.deleteMany({ where: { createdAt: { gte: since }, OR: [{ link: { contains: `/productions/${made.prod.id}` } }, { body: { contains: "Chase test show" } }] } }).catch(() => {});
      await db.production.delete({ where: { id: made.prod.id } }).catch(() => {});
    }
  }
});
