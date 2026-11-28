// Change or remove a crew rate. Crew jobs already filled in from it keep their own figures.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { crewRateFields } from "@/lib/crewRates";
import { roleTaken } from "@/lib/crewRateAccess";

const load = (id: number) => (Number.isInteger(id) ? prisma.crewRate.findUnique({ where: { id }, select: { id: true, entityId: true } }) : null);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load(parseInt((await params).id));
  if (!r) return notFound();
  const a = await staffForEntity(r.entityId);
  if ("error" in a) return a.error;
  const f = crewRateFields(await req.json().catch(() => ({})), false);
  if ("error" in f) return bad(f.error);
  if (typeof f.data.role === "string" && (await roleTaken(r.entityId, f.data.role, r.id))) return bad(`There's already a rate for ${f.data.role}`, 409);
  return NextResponse.json(await prisma.crewRate.update({ where: { id: r.id }, data: f.data }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await load(parseInt((await params).id));
  if (!r) return notFound();
  const a = await staffForEntity(r.entityId);
  if ("error" in a) return a.error;
  await prisma.crewRate.delete({ where: { id: r.id } });
  return NextResponse.json({ deleted: true });
}
