import { run } from "./lib.mjs";

// Minutes → tasks: saving accepted actions as linked tasks, and who may do it. (The suggest step
// calls Claude, so these tests only check it refuses when it should.)
export default () => run("meeting-actions", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, , , admin] = users;
  const a = await login(admin.email), f = await login(free.email);
  const json = r => r.json();
  let prod, meeting, empty;
  try {
    prod = await db.production.create({ data: { name: "Actions test show", type: "Other" } });
    meeting = await db.meeting.create({ data: { productionId: prod.id, title: "Production meeting 1", meetingDate: new Date("2026-11-24T10:00:00Z"), minutes: "Toby to send the revised plot to the venue by Friday." } });
    empty = await db.meeting.create({ data: { productionId: prod.id, title: "No minutes yet", meetingDate: new Date() } });

    ok((await a(`/api/meetings/${empty.id}/actions/suggest`, { method: "POST" })).status === 400, "can't look for actions before minutes are saved");
    ok((await f(`/api/meetings/${meeting.id}/actions/suggest`, { method: "POST" })).status === 403, "freelancer can't run the suggestion");
    ok((await f(`/api/meetings/${meeting.id}/actions`, { method: "POST", body: JSON.stringify({ actions: [{ title: "x" }] }) })).status === 403, "freelancer can't create tasks from minutes");
    ok((await a(`/api/meetings/${meeting.id}/actions`, { method: "POST", body: JSON.stringify({ actions: [{ title: "" }] }) })).status === 400, "an action needs a title");
    ok((await a(`/api/meetings/${meeting.id}/actions`, { method: "POST", body: JSON.stringify({ actions: [{ title: "x", assigneeUserId: 99999999 }] }) })).status === 400, "unknown owner refused");

    let r = await a(`/api/meetings/${meeting.id}/actions`, { method: "POST", body: JSON.stringify({ actions: [
      { title: "Send revised plot to the venue", assigneeUserId: admin.id, dueDate: "2026-11-27", priority: "high", detail: "Agreed at the meeting" },
      { title: "Book the follow spot op", assigneeName: "Sam (venue)", priority: "medium" },
    ] }) });
    const tasks = await json(r);
    ok(r.status === 201 && tasks.length === 2, "two tasks created from the minutes");
    const saved = await db.task.findMany({ where: { meetingId: meeting.id }, orderBy: { id: "asc" } });
    ok(saved.every(t => t.productionId === prod.id && t.createdByUserId === admin.id), "tasks belong to the meeting's production");
    ok(saved[0].assigneeUserId === admin.id && saved[0].dueDate?.toISOString().startsWith("2026-11-27") && saved[0].priority === "high" && saved[0].description === "Agreed at the meeting", "owner, due date, priority and detail saved");
    ok(saved[1].assigneeUserId === null && saved[1].assigneeName === "Sam (venue)", "owner not on the Hub kept as a name");

    const listed = await json(await a(`/api/meetings/${meeting.id}/actions`));
    ok(listed.length === 2 && listed[0].assigneeUser?.id === admin.id, "the meeting lists its tasks");
    const prodTasks = await json(await a(`/api/tasks?productionId=${prod.id}`));
    ok(prodTasks.find(t => t.title === "Send revised plot to the venue")?.meeting?.title === "Production meeting 1", "each task links back to its meeting");
  } finally {
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
  }
});
