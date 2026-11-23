import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRecordAccess } from "@/lib/access";

export async function PUT(req: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("taskList", id);
  if ("error" in rec) return rec.error;
  const { name } = await req.json();
  const list = await prisma.taskList.update({ where: { id: Number(id) }, data: { name } });
  return NextResponse.json(list);
}

export async function DELETE(_: NextRequest, {
 params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await requireRecordAccess("taskList", id);
  if ("error" in rec) return rec.error;
  // Unlink tasks from this list before deleting
  await prisma.task.updateMany({ where: { taskListId: Number(id) }, data: { taskListId: null } });
  await prisma.taskList.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
