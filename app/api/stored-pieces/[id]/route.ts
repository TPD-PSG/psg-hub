// One stored piece (staff of its space). PATCH action: move (to another location) · out (gone
// out: delivered, collected, scrapped; a note says where) · back (back into store) · edit (name,
// quantity, notes, build). DELETE: entered by mistake (whoever added it, or an admin).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberOfEntity } from "@/lib/spaceBoard";
import { storageFor, locationIn, nameOf } from "@/lib/setStorage";

type P = { params: Promise<{ id: string }> };
async function load(p: P) {
  const piece = await prisma.storedPiece.findUnique({ where: { id: parseInt((await p.params).id) || 0 }, include: { location: { select: { name: true } } } });
  if (!piece) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const m = await memberOfEntity(piece.entityId);
  if ("error" in m) return m;
  if (!m.staff) return { error: NextResponse.json({ error: "Only staff can change storage" }, { status: 403 }) };
  return { m, piece };
}

export async function PATCH(req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  const { m, piece } = r;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const by = await nameOf(m.userId);
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
  switch (body.action) {
    case "move": case "back": {
      if (body.action === "move" && piece.outAt) return bad("It has gone out. Bring it back in first.");
      if (body.action === "back" && !piece.outAt) return bad("It's already in store");
      const loc = await locationIn(piece.entityId, body.locationId);
      if ("error" in loc) return bad(loc.error);
      if (body.action === "move" && (!loc.id || loc.id === piece.locationId)) return bad("Pick the location it's moving to");
      await prisma.storedPiece.update({ where: { id: piece.id }, data: { locationId: loc.id, ...(body.action === "back" ? { outAt: null, outNote: null } : {}), moves: { create: { kind: body.action, location: loc.name, note, byName: by } } } });
      break;
    }
    case "out": {
      if (piece.outAt) return bad("It has already gone out");
      if (!note) return bad("Say where it went (e.g. delivered to the Lyceum)");
      await prisma.storedPiece.update({ where: { id: piece.id }, data: { outAt: new Date(), outNote: note, moves: { create: { kind: "out", location: piece.location?.name ?? null, note, byName: by } } } });
      break;
    }
    case "edit": {
      const data: Record<string, unknown> = {};
      if (typeof body.name === "string") { if (!body.name.trim()) return bad("Name the piece"); data.name = body.name.trim().slice(0, 150); }
      if ("quantity" in body) { const q = Math.round(Number(body.quantity)); if (!(q >= 1 && q <= 9999)) return bad("Quantity must be 1 or more"); data.quantity = q; }
      if ("notes" in body) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;
      if ("jobId" in body) {
        const j = body.jobId ? Number(body.jobId) : null;
        if (j && !(await prisma.job.count({ where: { id: j, entityId: piece.entityId } }))) return bad("Pick one of this workshop's builds");
        data.jobId = j;
      }
      await prisma.storedPiece.update({ where: { id: piece.id }, data });
      break;
    }
    default: return bad("Unknown action");
  }
  return NextResponse.json(await storageFor(piece.entityId));
}

export async function DELETE(_req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  if (r.piece.createdById !== r.m.userId && r.m.role !== "admin") return NextResponse.json({ error: "Only whoever added it, or an admin, can delete it" }, { status: 403 });
  await prisma.storedPiece.delete({ where: { id: r.piece.id } });
  return NextResponse.json(await storageFor(r.piece.entityId));
}
