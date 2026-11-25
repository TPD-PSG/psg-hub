// People on a build (designer, production manager, client, venue, haulier). PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, contactFields } from "@/lib/jobDesign";

const list = (jobId: number) => prisma.jobContact.findMany({ where: { jobId }, orderBy: [{ createdAt: "asc" }] });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  return NextResponse.json(await list(a.id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const f = contactFields(await req.json(), true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await prisma.jobContact.create({ data: { ...f.data, name: f.data.name as string, role: f.data.role as string, jobId: a.id } });
  return NextResponse.json(await list(a.id), { status: 201 });
}
