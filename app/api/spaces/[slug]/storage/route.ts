// A space's set storage: locations and pieces (GET, optionally ?jobId=), and putting pieces into
// store (POST: several names at once for one build and one location). Staff only to change.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { storageFor, locationIn, nameOf } from "@/lib/setStorage";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  const jobId = Number(new URL(req.url).searchParams.get("jobId")) || undefined;
  const [data, jobs] = await Promise.all([
    storageFor(m.space.id, jobId),
    prisma.job.findMany({ where: { entityId: m.space.id, status: { not: "cancelled" } }, select: { id: true, number: true, title: true }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  return NextResponse.json({ space: m.space, ...data, jobs, me: { staff: m.staff, admin: m.role === "admin" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Only staff can record storage" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pieces = (Array.isArray(body.pieces) ? body.pieces : [])
    .map((p: { name?: unknown; quantity?: unknown }) => ({ name: typeof p?.name === "string" ? p.name.trim().slice(0, 150) : "", quantity: Math.max(1, Math.min(9999, Math.round(Number(p?.quantity) || 1))) }))
    .filter((p: { name: string }) => p.name)
    .slice(0, 50);
  if (!pieces.length) return NextResponse.json({ error: "Name at least one piece" }, { status: 400 });
  const jobId = body.jobId ? Number(body.jobId) : null;
  if (jobId && !(await prisma.job.count({ where: { id: jobId, entityId: m.space.id } }))) return NextResponse.json({ error: "Pick one of this workshop's builds" }, { status: 400 });
  const loc = await locationIn(m.space.id, body.locationId);
  if ("error" in loc) return NextResponse.json({ error: loc.error }, { status: 400 });
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;
  const by = await nameOf(m.userId);
  for (const p of pieces) {
    await prisma.storedPiece.create({
      data: { entityId: m.space.id, jobId, locationId: loc.id, name: p.name, quantity: p.quantity, notes, createdById: m.userId, moves: { create: { kind: "in", location: loc.name, byName: by } } },
    });
  }
  return NextResponse.json(await storageFor(m.space.id), { status: 201 });
}
