// Record an induction on a machine: one of its trainers (or an admin), with both signatures.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canInduct, matrix, recordInduction } from "@/lib/inductions";
import { machineFor } from "@/lib/machineRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await machineFor((await params).id);
  if ("error" in x) return x.error;
  if (x.m.archived) return NextResponse.json({ error: "This machine is retired" }, { status: 409 });
  if (!(await canInduct(x.v.userId, x.v.role, x.m.id))) return NextResponse.json({ error: `Only ${x.m.name}'s trainers can record inductions on it` }, { status: 403 });
  const me = await prisma.user.findUnique({ where: { id: x.v.userId }, select: { id: true, name: true } });
  const r = await recordInduction(x.m, me!, await req.json().catch(() => ({})));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ induction: r.induction, ...(await matrix(x.v)) }, { status: 201 });
}
