// A space's labour types: list and add (staff). POST { usual: true } adds the usual names that
// aren't there yet (no rates: fill them in).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { labourFor, labourFields, USUAL_LABOUR } from "@/lib/labourTypes";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  return NextResponse.json(await labourFor(m.space.id));
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.usual) {
    const have = new Set((await prisma.labourType.findMany({ where: { entityId: m.space.id }, select: { name: true } })).map(l => l.name.toLowerCase()));
    const add = USUAL_LABOUR.filter(n => !have.has(n.toLowerCase()));
    if (add.length) await prisma.labourType.createMany({ data: add.map(name => ({ entityId: m.space.id, name })) });
    return NextResponse.json(await labourFor(m.space.id), { status: 201 });
  }
  const f = labourFields(body, true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (await prisma.labourType.count({ where: { entityId: m.space.id, name: f.data.name as string } })) return NextResponse.json({ error: `There's already ${f.data.name}` }, { status: 409 });
  await prisma.labourType.create({ data: { ...(f.data as { name: string }), entityId: m.space.id } });
  return NextResponse.json(await labourFor(m.space.id), { status: 201 });
}
