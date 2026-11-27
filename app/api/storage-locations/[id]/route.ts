// Rename a storage location, or retire / restore it (staff of its space). Retiring needs it empty.
import { NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { storageFor } from "@/lib/setStorage";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const loc = await prisma.storageLocation.findUnique({ where: { id: parseInt((await params).id) || 0 } });
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await memberOfEntity(loc.entityId);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Only staff can change locations" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { name: "The name can't be blank" });
  if (blank) return blank;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name) return NextResponse.json({ error: "Name the location" }, { status: 400 });
    if (name !== loc.name && (await prisma.storageLocation.count({ where: { entityId: loc.entityId, name } }))) return NextResponse.json({ error: `There's already a location called ${name}` }, { status: 409 });
    data.name = name;
  }
  if ("notes" in body) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;
  if (typeof body.archived === "boolean") {
    if (body.archived && (await prisma.storedPiece.count({ where: { locationId: loc.id, outAt: null } }))) return NextResponse.json({ error: `Move the pieces out of ${loc.name} first` }, { status: 400 });
    data.archived = body.archived;
  }
  await prisma.storageLocation.update({ where: { id: loc.id }, data });
  return NextResponse.json(await storageFor(loc.entityId));
}
