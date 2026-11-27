// The group's companies (entities). Anyone with BD, productions or finance access can read them
// (see proxy.ts); only admins add, rename, reorder or archive them.
import { myCompanyLimit } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ENTITY_SELECT } from "@/lib/entities";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Someone limited to some companies only gets those (e.g. in "which company" pickers)
  const limit = await myCompanyLimit();
  const entities = await prisma.entity.findMany({ where: limit ? { id: { in: limit } } : {}, select: ENTITY_SELECT, orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json(entities);
}

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const name = String((await req.json()).name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (await prisma.entity.findUnique({ where: { name } })) return NextResponse.json({ error: "An entity with that name already exists" }, { status: 409 });
  const max = await prisma.entity.aggregate({ _max: { sortOrder: true } });
  const entity = await prisma.entity.create({ data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 }, select: ENTITY_SELECT });
  return NextResponse.json(entity, { status: 201 });
}
