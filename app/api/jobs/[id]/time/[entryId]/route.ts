import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

// Remove a time entry: your own, or anyone's if you're an admin
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const { id, entryId } = await params;
  const e = await prisma.timeEntry.findFirst({ where: { id: parseInt(entryId), jobId: parseInt(id) }, select: { userId: true } });
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (e.userId !== v.userId && v.role !== "admin") return NextResponse.json({ error: "Only your own time" }, { status: 403 });
  await prisma.timeEntry.delete({ where: { id: parseInt(entryId) } });
  return NextResponse.json({ ok: true });
}
