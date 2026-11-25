import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, contactFields } from "@/lib/jobDesign";

type P = { params: Promise<{ id: string; contactId: string }> };
const find = async (jobId: number, params: P["params"]) => prisma.jobContact.findFirst({ where: { id: parseInt((await params).contactId), jobId }, select: { id: true } });

export async function PATCH(req: Request, { params }: P) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const c = await find(a.id, params);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const f = contactFields(await req.json(), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  return NextResponse.json(await prisma.jobContact.update({ where: { id: c.id }, data: f.data }));
}

export async function DELETE(_req: Request, { params }: P) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const c = await find(a.id, params);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.jobContact.delete({ where: { id: c.id } });
  return NextResponse.json({ ok: true });
}
