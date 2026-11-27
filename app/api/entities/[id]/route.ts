import { NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ENTITY_SELECT, checkSlug, checkColor } from "@/lib/entities";

// Rename, reorder, archive, or set up its space: web address, short name, colour (admins only)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { name: "The name can't be blank" });
  if (blank) return blank;
  const data: { name?: string; archived?: boolean; sortOrder?: number; hasSpace?: boolean; slug?: string | null; shortName?: string | null; color?: string | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const clash = await prisma.entity.findUnique({ where: { name } });
    if (clash && clash.id !== id) return NextResponse.json({ error: "An entity with that name already exists" }, { status: 409 });
    data.name = name;
  }
  if (typeof body.archived === "boolean") data.archived = body.archived;
  if (Number.isInteger(body.sortOrder)) data.sortOrder = body.sortOrder;
  if ("slug" in body) {
    const r = checkSlug(body.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    if (r.slug) {
      const clash = await prisma.entity.findUnique({ where: { slug: r.slug } });
      if (clash && clash.id !== id) return NextResponse.json({ error: "Another company already uses that web address" }, { status: 409 });
    }
    data.slug = r.slug;
  }
  if ("shortName" in body) data.shortName = typeof body.shortName === "string" && body.shortName.trim() ? body.shortName.trim().slice(0, 12) : null;
  if ("color" in body) {
    const c = checkColor(body.color);
    if (c === undefined) return NextResponse.json({ error: "Colour must look like #1a2b3c" }, { status: 400 });
    data.color = c;
  }
  if (typeof body.hasSpace === "boolean") {
    // A space needs a web address
    const slug = "slug" in data ? data.slug : (await prisma.entity.findUnique({ where: { id }, select: { slug: true } }))?.slug;
    if (body.hasSpace && !slug) return NextResponse.json({ error: "Give the space a web address first" }, { status: 400 });
    data.hasSpace = body.hasSpace;
  }
  const entity = await prisma.entity.update({ where: { id }, data, select: ENTITY_SELECT }).catch(() => null);
  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entity);
}

// Delete only an entity nothing uses yet; otherwise archive it, so past deals keep their entity
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = parseInt((await params).id);
  // Anything a company's history or safety records depend on keeps it: archive instead (audit round 2)
  const [deals, productions, jobs, incidents, machines, stock, pieces] = await Promise.all([
    prisma.opportunity.count({ where: { entityId: id } }),
    prisma.production.count({ where: { entityId: id } }),
    prisma.job.count({ where: { entityId: id } }),
    prisma.incident.count({ where: { entityId: id } }),
    prisma.machine.count({ where: { entityId: id } }),
    prisma.stockItem.count({ where: { entityId: id } }),
    prisma.storedPiece.count({ where: { entityId: id } }),
  ]);
  const uses = ([[deals, "deal"], [productions, "production"], [jobs, "job"], [incidents, "accident/incident report"], [machines, "machine or item of kit (with inductions and checks)"], [stock, "stock item"], [pieces, "stored piece"]] as const)
    .filter(([n]) => n).map(([n, w]) => `${n} ${w}${n === 1 || w.endsWith(")") ? "" : "s"}`);
  if (uses.length) {
    return NextResponse.json({ error: `In use by ${uses.join(", ")}. Archive it instead.` }, { status: 409 });
  }
  await prisma.entity.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
