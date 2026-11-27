// A meeting's tasks: GET lists the tasks made from it; POST saves the action items a person
// accepted, as tasks on the meeting's production, each linked back to the meeting.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

const TASK_SELECT = {
  id: true, title: true, status: true, priority: true, dueDate: true, assigneeName: true,
  assigneeUser: { select: { id: true, name: true } },
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;
  const tasks = await prisma.task.findMany({ where: { meetingId: Number(id) }, select: TASK_SELECT, orderBy: { createdAt: "asc" } });
  return NextResponse.json(tasks);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== "admin" && user?.role !== "member") return NextResponse.json({ error: "PSG staff only" }, { status: 403 });
  const { id } = await params;
  const rec = await requireRecordAccess("meeting", id);
  if ("error" in rec) return rec.error;
  const meeting = await prisma.meeting.findUnique({ where: { id: Number(id) }, select: { productionId: true } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.actions) || body.actions.length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  if (body.actions.length > 100) return NextResponse.json({ error: "Too many actions at once" }, { status: 400 });
  const data = [];
  for (const [i, a] of body.actions.entries()) {
    const title = typeof a?.title === "string" ? a.title.trim() : "";
    if (!title) return NextResponse.json({ error: `Action ${i + 1} needs a title` }, { status: 400 });
    const due = typeof a.dueDate === "string" ? toDate(a.dueDate) ?? null : null;
    if (due && isNaN(due.getTime())) return NextResponse.json({ error: `Action ${i + 1} has a bad date` }, { status: 400 });
    const assigneeUserId = Number.isInteger(Number(a.assigneeUserId)) && Number(a.assigneeUserId) > 0 ? Number(a.assigneeUserId) : null;
    data.push({
      title: title.slice(0, 200),
      description: typeof a.detail === "string" && a.detail.trim() ? a.detail.trim().slice(0, 2000) : null,
      productionId: meeting.productionId,
      meetingId: Number(id),
      assigneeUserId,
      assigneeName: !assigneeUserId && typeof a.assigneeName === "string" && a.assigneeName.trim() ? a.assigneeName.trim().slice(0, 80) : null,
      dueDate: due,
      priority: ["low", "medium", "high"].includes(a.priority) ? a.priority : "medium",
      createdByUserId: Number(user.id),
    });
  }
  // Owners must be real users
  const ids = [...new Set(data.map(d => d.assigneeUserId).filter((x): x is number => x != null))];
  if (ids.length && (await prisma.user.count({ where: { id: { in: ids } } })) !== ids.length) return NextResponse.json({ error: "Unknown owner" }, { status: 400 });

  await prisma.task.createMany({ data });
  const tasks = await prisma.task.findMany({ where: { meetingId: Number(id) }, select: TASK_SELECT, orderBy: { createdAt: "asc" } });
  return NextResponse.json(tasks, { status: 201 });
}
