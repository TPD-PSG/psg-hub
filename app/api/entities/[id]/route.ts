import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ENTITY_SELECT } from "@/lib/entities";

// Rename, reorder or archive (admins only)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  const body = await req.json();
  const data: { name?: string; archived?: boolean; sortOrder?: number } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const clash = await prisma.entity.findUnique({ where: { name } });
    if (clash && clash.id !== id) return NextResponse.json({ error: "An entity with that name already exists" }, { status: 409 });
    data.name = name;
  }
  if (typeof body.archived === "boolean") data.archived = body.archived;
  if (Number.isInteger(body.sortOrder)) data.sortOrder = body.sortOrder;
  const entity = await prisma.entity.update({ where: { id }, data, select: ENTITY_SELECT }).catch(() => null);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entity);
}

// Delete only an entity nothing uses yet; otherwise archive it, so past deals keep their entity
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  const [deals, productions] = await Promise.all([
    prisma.opportunity.count({ where: { entityId: id } }),
    prisma.production.count({ where: { entityId: id } }),
  ]);
  if (deals || productions) {
    return NextResponse.json({ error: `In use by ${deals} deal(s) and ${productions} production(s). Archive it instead.` }, { status: 409 });
  }
  await prisma.entity.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
